import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import { prisma } from '../db/prisma.js';
import { env } from '../config/env.js';
import { ApiError, CODE } from '../utils/response.js';
import { logAudit } from './audit.service.js';
import { processAndSavePrivateImage, removeProcessedImage } from './upload.service.js';

const TEN_MINUTES = 10 * 60 * 1000;
const queryExpiresAt = () => new Date(Date.now() + env.PUBLIC_QUERY_TTL_DAYS * 24 * 60 * 60 * 1000);
const STATUS_TEXT = {
  pending_review: '待审核',
  approved: '已通过',
  processing: '处理中',
  processed: '已处理',
  rejected: '已驳回',
  archived: '已归档',
  deleted: '已删除',
  pending: '待审核',
  open: '已通过',
  resolved: '已处理',
  offline: '已归档',
};

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const privateHash = (value) => createHmac('sha256', env.JWT_SECRET).update(value).digest('hex');
const sameHash = (left, right) => {
  const leftBuffer = Buffer.from(left || '', 'hex');
  const rightBuffer = Buffer.from(right || '', 'hex');
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
};
function canonicalize(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        if (value[key] !== undefined) result[key] = canonicalize(value[key]);
        return result;
      }, {});
  }
  return value;
}

const stableFingerprint = (scope, payload) => privateHash(`${scope}:${JSON.stringify(canonicalize(payload))}`);
const ipHash = (value) => (value ? privateHash(value).slice(0, 32) : null);

function queryNo() {
  // 查询编号不携带时间、ID 等可推断信息；跨表检查后保持全站唯一。
  return `JP-${randomBytes(14).toString('hex').toUpperCase()}`;
}

function credentialFor(key, no) {
  if (key) return createHmac('sha256', env.JWT_SECRET).update(`${key}:${no}`).digest('base64url');
  return randomBytes(32).toString('base64url');
}

async function uniqueReceipt() {
  let nextNo = queryNo();
  for (let attempts = 0; attempts < 5; attempts += 1) {
    const [item, canteen, mailbox, inquiry] = await Promise.all([
      prisma.item.findUnique({ where: { queryNo: nextNo }, select: { id: true } }),
      prisma.canteenFeedback.findUnique({ where: { queryNo: nextNo }, select: { id: true } }),
      prisma.mailboxMessage.findUnique({ where: { queryNo: nextNo }, select: { id: true } }),
      prisma.lostFoundInquiry.findUnique({ where: { queryNo: nextNo }, select: { id: true } }),
    ]);
    if (!item && !canteen && !mailbox && !inquiry) return nextNo;
    nextNo = queryNo();
  }
  throw new ApiError(CODE.SERVER_ERROR, '暂时无法生成查询编号，请稍后重试', 500);
}

function receipt({ queryNo: no, credential, status, resourceType, queryExpiresAt: expiresAt = null, duplicate = false }) {
  return {
    queryNo: no,
    queryCredential: credential,
    status,
    statusText: STATUS_TEXT[status] || '待审核',
    resourceType,
    duplicate,
    queryExpiresAt: expiresAt,
    notice: '查询凭证只在本次提交结果中显示，请立即保存。遗失后无法恢复。',
  };
}

async function saveAttachments(files = []) {
  if (!files?.length) return [];
  const saved = [];
  try {
    for (const file of files) {
      const image = await processAndSavePrivateImage(file.buffer);
      saved.push({
        url: image.url,
        altText: '游客投稿附件',
        mimeType: 'image/webp',
        byteSize: image.size,
        width: image.width,
        height: image.height,
      });
    }
  } catch (error) {
    await cleanupAttachments(saved);
    throw error;
  }
  return saved;
}

async function cleanupAttachments(attachments = []) {
  await Promise.allSettled(attachments.map((attachment) => removeProcessedImage(attachment.url)));
}

function contextMeta(context) {
  const detail = {
    channel: 'public_submission',
    ipHash: ipHash(context?.ip),
  };
  if (context?.requestId) detail.requestId = context.requestId;
  return detail;
}

function assertHoneypot(body) {
  if (body.website) throw ApiError.badRequest('提交失败，请检查表单后重试');
}

function assertKey(key) {
  if (!key) throw ApiError.badRequest('提交凭证缺失，请刷新页面后重试');
  if (!/^[A-Za-z0-9._:-]{8,200}$/.test(key)) {
    throw ApiError.badRequest('幂等键格式不合法');
  }
}

async function existingByIdempotency(model, idempotencyKeyHash, fingerprint, key, resourceType) {
  if (!idempotencyKeyHash) return null;
  const existing = await prisma[model].findFirst({
    where: { idempotencyKeyHash },
    select: { queryNo: true, queryCredentialHash: true, contentFingerprint: true, status: true, queryExpiresAt: true },
  });
  if (!existing) return null;
  if (existing.contentFingerprint !== fingerprint) throw ApiError.conflict('幂等键已用于其他内容，请更换后重试');
  const credential = credentialFor(key, existing.queryNo);
  if (!sameHash(sha256(credential), existing.queryCredentialHash)) {
    // Older records may use a random credential and cannot be replayed safely.
    throw ApiError.conflict('该请求已提交，请使用首次返回的查询凭证');
  }
  return receipt({ queryNo: existing.queryNo, credential, status: existing.status, queryExpiresAt: existing.queryExpiresAt, resourceType, duplicate: true });
}

async function replayAfterIdempotencyRace(error, model, idempotencyKeyHash, fingerprint, key, resourceType) {
  if (error?.code !== 'P2002' || !idempotencyKeyHash) return null;
  return existingByIdempotency(model, idempotencyKeyHash, fingerprint, key, resourceType);
}

async function assertRecentDuplicate(model, fingerprint) {
  const existing = await prisma[model].findFirst({
    where: { contentFingerprint: fingerprint, submittedAt: { gte: new Date(Date.now() - TEN_MINUTES) } },
    select: { queryNo: true },
  });
  if (existing) throw ApiError.conflict('检测到相同内容的近期投稿，请勿重复提交');
}

async function getCanteenMonth(value) {
  if (!value) return null;
  return new Date(`${value}-01T00:00:00.000Z`);
}

async function usableMailboxCategory(categoryId) {
  if (categoryId) {
    const category = await prisma.siteCategory.findFirst({ where: { id: categoryId, kind: 'mailbox', enabled: true }, select: { id: true } });
    if (!category) throw ApiError.badRequest('信箱分类不存在或已停用');
    return category.id;
  }
  const category = await prisma.siteCategory.findFirst({ where: { kind: 'mailbox', enabled: true }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }], select: { id: true } });
  return category?.id ?? null;
}

async function usableItemCategory(categoryId) {
  if (categoryId) {
    const category = await prisma.category.findFirst({ where: { id: categoryId, enabled: true }, select: { id: true } });
    if (!category) throw ApiError.badRequest('物品分类不存在或已停用');
    return category.id;
  }
  const category = await prisma.category.findFirst({ where: { enabled: true }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }], select: { id: true } });
  if (!category) throw ApiError.badRequest('暂未配置物品分类');
  return category.id;
}

function keyAndFingerprint(body, key, scope, extra = {}) {
  assertKey(key);
  const idempotencyKeyHash = key ? sha256(key) : null;
  const fingerprintPayload = { ...body, website: undefined, idempotencyKey: undefined, ...extra };
  if (body.submitMode === 'anonymous') {
    fingerprintPayload.className = undefined;
    fingerprintPayload.name = undefined;
  }
  const fingerprint = stableFingerprint(scope, fingerprintPayload);
  return { idempotencyKeyHash, fingerprint };
}

export async function createCanteenFeedback(body, files, context = {}) {
  assertHoneypot(body);
  const key = body.idempotencyKey || context.idempotencyKey;
  const { idempotencyKeyHash, fingerprint } = keyAndFingerprint(body, key, 'canteen-feedback');
  const replay = await existingByIdempotency('canteenFeedback', idempotencyKeyHash, fingerprint, key, 'canteen_feedback');
  if (replay) return replay;
  await assertRecentDuplicate('canteenFeedback', fingerprint);
  const no = await uniqueReceipt();
  const credential = credentialFor(key, no);
  const attachments = await saveAttachments(files);
  let row;
  try {
    row = await prisma.canteenFeedback.create({
      data: {
        reportMonth: await getCanteenMonth(body.reportMonth), submitMode: body.submitMode,
        className: body.submitMode === 'signed' ? (body.className || null) : null,
        name: body.submitMode === 'signed' ? (body.name || null) : null,
        contactType: body.contactType || null, contactValue: body.contactValue || null,
        content: body.content, attachments, status: 'pending_review', publicAllowed: false,
        queryNo: no, queryCredentialHash: sha256(credential), idempotencyKeyHash, contentFingerprint: fingerprint,
        queryExpiresAt: queryExpiresAt(),
      }, select: { id: true, queryNo: true, status: true, queryExpiresAt: true },
    });
  } catch (error) {
    await cleanupAttachments(attachments);
    const replay = await replayAfterIdempotencyRace(error, 'canteenFeedback', idempotencyKeyHash, fingerprint, key, 'canteen_feedback');
    if (replay) return replay;
    throw error;
  }
  await logAudit({ adminId: null, action: 'public.canteen_feedback.submit', targetType: 'canteen_feedback', targetId: row.id, detail: contextMeta(context) });
  return receipt({ queryNo: row.queryNo, credential, status: row.status, queryExpiresAt: row.queryExpiresAt, resourceType: 'canteen_feedback' });
}

export async function createMailboxMessage(body, files, context = {}) {
  assertHoneypot(body);
  const key = body.idempotencyKey || context.idempotencyKey;
  const categoryId = await usableMailboxCategory(body.categoryId);
  const { idempotencyKeyHash, fingerprint } = keyAndFingerprint(body, key, 'mailbox', { categoryId });
  const replay = await existingByIdempotency('mailboxMessage', idempotencyKeyHash, fingerprint, key, 'mailbox');
  if (replay) return replay;
  await assertRecentDuplicate('mailboxMessage', fingerprint);
  const no = await uniqueReceipt(); const credential = credentialFor(key, no); const attachments = await saveAttachments(files);
  let row;
  try {
    row = await prisma.mailboxMessage.create({
      data: {
        submitMode: body.submitMode,
        className: body.submitMode === 'signed' ? (body.className || null) : null,
        name: body.submitMode === 'signed' ? (body.name || null) : null,
        contactType: body.contactType || null, contactValue: body.contactValue || null,
        subject: body.subject, categoryId, content: body.content, publicAllowed: Boolean(body.publicAllowed), attachments,
      status: 'pending_review', queryNo: no, queryCredentialHash: sha256(credential), idempotencyKeyHash,
      contentFingerprint: fingerprint, submittedAt: new Date(),
      queryExpiresAt: queryExpiresAt(),
      }, select: { id: true, queryNo: true, status: true, queryExpiresAt: true },
    });
  } catch (error) {
    await cleanupAttachments(attachments);
    const replay = await replayAfterIdempotencyRace(error, 'mailboxMessage', idempotencyKeyHash, fingerprint, key, 'mailbox');
    if (replay) return replay;
    throw error;
  }
  await logAudit({ adminId: null, action: 'public.mailbox.submit', targetType: 'mailbox_message', targetId: row.id, detail: contextMeta(context) });
  return receipt({ queryNo: row.queryNo, credential, status: row.status, queryExpiresAt: row.queryExpiresAt, resourceType: 'mailbox' });
}

export async function createLostFoundItem(body, files, context = {}) {
  assertHoneypot(body);
  const key = body.idempotencyKey || context.idempotencyKey;
  const categoryId = await usableItemCategory(body.categoryId);
  const { idempotencyKeyHash, fingerprint } = keyAndFingerprint(body, key, 'lost-found-item', { categoryId });
  const replay = await existingByIdempotency('item', idempotencyKeyHash, fingerprint, key, 'lost_found_item');
  if (replay) return replay;
  await assertRecentDuplicate('item', fingerprint);
  const no = await uniqueReceipt(); const credential = credentialFor(key, no); const attachments = await saveAttachments(files);
  let item;
  try {
    item = await prisma.item.create({
      data: {
        userId: null, type: body.type, title: body.title, description: body.description,
        features: body.features || null, area: body.area || null, categoryId, location: body.location,
        happenedAt: body.happenedAt, contactType: body.contactType || null, contactValue: body.contactValue || null,
        status: 'pending', publicAllowed: false, queryNo: no, queryCredentialHash: sha256(credential),
        idempotencyKeyHash, contentFingerprint: fingerprint, attachments,
        queryExpiresAt: queryExpiresAt(),
        images: { create: attachments.map((file, index) => ({ url: file.url, sortOrder: index })) },
      }, select: { id: true, queryNo: true, status: true, queryExpiresAt: true },
    });
  } catch (error) {
    await cleanupAttachments(attachments);
    const replay = await replayAfterIdempotencyRace(error, 'item', idempotencyKeyHash, fingerprint, key, 'lost_found_item');
    if (replay) return replay;
    throw error;
  }
  await logAudit({ adminId: null, action: 'public.lost_found_item.submit', targetType: 'item', targetId: item.id, detail: contextMeta(context) });
  return receipt({ queryNo: item.queryNo, credential, status: item.status === 'pending' ? 'pending_review' : item.status, queryExpiresAt: item.queryExpiresAt, resourceType: 'lost_found_item' });
}

export async function createLostFoundInquiry(itemId, body, files, context = {}) {
  assertHoneypot(body);
  const item = await prisma.item.findFirst({ where: { id: itemId, publicAllowed: true, status: 'open' }, select: { id: true } });
  if (!item) throw ApiError.notFound('失物记录不存在或暂未公开');
  const key = body.idempotencyKey || context.idempotencyKey;
  const { idempotencyKeyHash, fingerprint } = keyAndFingerprint(body, key, 'lost-found-inquiry', { itemId });
  const replay = await existingByIdempotency('lostFoundInquiry', idempotencyKeyHash, fingerprint, key, 'lost_found_inquiry');
  if (replay) return replay;
  await assertRecentDuplicate('lostFoundInquiry', fingerprint);
  const no = await uniqueReceipt(); const credential = credentialFor(key, no); const attachments = await saveAttachments(files);
  let inquiry;
  try {
    inquiry = await prisma.lostFoundInquiry.create({
      data: {
        itemId, message: body.message, contactType: body.contactType || null, contactValue: body.contactValue || null,
        attachments, status: 'pending_review', queryNo: no, queryCredentialHash: sha256(credential), idempotencyKeyHash, contentFingerprint: fingerprint,
        queryExpiresAt: queryExpiresAt(),
      }, select: { id: true, queryNo: true, status: true, queryExpiresAt: true },
    });
  } catch (error) {
    await cleanupAttachments(attachments);
    const replay = await replayAfterIdempotencyRace(error, 'lostFoundInquiry', idempotencyKeyHash, fingerprint, key, 'lost_found_inquiry');
    if (replay) return replay;
    throw error;
  }
  await logAudit({ adminId: null, action: 'public.lost_found_inquiry.submit', targetType: 'lost_found_inquiry', targetId: inquiry.id, detail: contextMeta(context) });
  return receipt({ queryNo: inquiry.queryNo, credential, status: inquiry.status, queryExpiresAt: inquiry.queryExpiresAt, resourceType: 'lost_found_inquiry' });
}

