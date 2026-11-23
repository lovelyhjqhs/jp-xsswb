import { prisma } from '../../db/prisma.js';
import { ApiError, CODE } from '../../utils/response.js';
import { logAudit } from '../audit.service.js';

function privateAttachmentDto(url) {
  const match = /^\/(?:private-uploads|uploads)\/(\d{4})\/(\d{2})\/([a-f0-9]{32})\.webp$/.exec(url ?? '');
  if (!match) return null;
  return `/api/admin/private-attachments/${match[1]}/${match[2]}/${match[3]}.webp`;
}

const TYPES = {
  canteen_feedback: { model: 'canteenFeedback', targetType: 'canteen_feedback', label: '食堂意见' },
  mailbox: { model: 'mailboxMessage', targetType: 'mailbox_message', label: '学生信箱' },
  lost_found_inquiry: { model: 'lostFoundInquiry', targetType: 'lost_found_inquiry', label: '失物线索' },
  lost_found_item: { model: 'item', targetType: 'item', label: '失物登记' },
};

const ITEM_STATUS_TO_SUBMISSION = { pending: 'pending_review', open: 'approved', resolved: 'processed', cleaned: 'archived', rejected: 'rejected', offline: 'archived' };
const SUBMISSION_TO_ITEM_STATUS = { pending_review: 'pending', approved: 'open', processing: 'open', processed: 'resolved', rejected: 'rejected', archived: 'offline', deleted: 'offline' };
const ALLOWED_FROM = {
  approve: ['pending_review', 'rejected', 'approved'],
  reject: ['pending_review', 'approved', 'processing'],
  process: ['approved', 'processing'],
  archive: ['pending_review', 'approved', 'rejected', 'processing', 'processed'],
  restore: ['deleted', 'archived'],
};

function typeConfig(type) {
  const config = TYPES[type];
  if (!config) throw ApiError.badRequest('投稿类型不合法');
  return config;
}

function pageData(page, pageSize, total) {
  return { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

function normalizeStatus(type, status) {
  if (!status || type !== 'lost_found_item') return status;
  if (status === 'deleted') return null;
  return SUBMISSION_TO_ITEM_STATUS[status] || status;
}

const commonSelect = {
  id: true, queryNo: true, contactType: true, contactValue: true, status: true,
  attachments: true, adminReply: true, internalNote: true, submittedAt: true,
  processedAt: true, updatedAt: true, deletedAt: true,
};
const canteenSelect = { ...commonSelect, submitMode: true, className: true, name: true, content: true, publicContent: true, publicAllowed: true, reportMonth: true };
const mailboxSelect = { ...commonSelect, submitMode: true, className: true, name: true, subject: true, categoryId: true, content: true, publicContent: true, publicAllowed: true };

function itemSelect() {
  return {
    id: true, queryNo: true, type: true, title: true, description: true, features: true,
    area: true, itemNo: true, categoryId: true, location: true, happenedAt: true,
    contactType: true, contactValue: true, status: true, publicAllowed: true, attachments: true,
    rejectReason: true, submittedAt: true, createdAt: true, updatedAt: true,
    deletedAt: true,
    user: { select: { id: true, studentNo: true, name: true } },
  };
}

export async function listSubmissions({ type, status, page = 1, pageSize = 20, keyword }) {
  const config = typeConfig(type);
  const model = prisma[config.model];
  const where = { deletedAt: status === 'deleted' ? { not: null } : null };
  const dbStatus = normalizeStatus(type, status);
  if (dbStatus) where.status = dbStatus;
  if (keyword) {
    if (type === 'lost_found_item') {
      where.OR = [{ queryNo: { contains: keyword } }, { title: { contains: keyword } }, { description: { contains: keyword } }, { itemNo: { contains: keyword } }];
    } else if (type === 'canteen_feedback') {
      where.OR = [{ queryNo: { contains: keyword } }, { content: { contains: keyword } }, { name: { contains: keyword } }, { className: { contains: keyword } }];
    } else if (type === 'mailbox') {
      where.OR = [{ queryNo: { contains: keyword } }, { subject: { contains: keyword } }, { content: { contains: keyword } }, { name: { contains: keyword } }];
    } else {
      where.OR = [{ queryNo: { contains: keyword } }, { message: { contains: keyword } }, { contactValue: { contains: keyword } }];
    }
  }
  const select = type === 'lost_found_item' ? itemSelect() : (type === 'lost_found_inquiry' ? { ...commonSelect, message: true, item: { select: { id: true, itemNo: true, title: true, status: true } } } : type === 'canteen_feedback' ? canteenSelect : mailboxSelect);
  const [total, rows] = await prisma.$transaction([
    model.count({ where }),
    model.findMany({ where, select, orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * pageSize, take: pageSize }),
  ]);
  return { type, list: rows.map((row) => ({ ...row, attachments: Array.isArray(row.attachments) ? row.attachments.map((attachment) => ({ ...attachment, url: privateAttachmentDto(attachment.url) })).filter((attachment) => attachment.url) : [], status: type === 'lost_found_item' && row.deletedAt ? 'deleted' : type === 'lost_found_item' ? (ITEM_STATUS_TO_SUBMISSION[row.status] || row.status) : row.status })), pagination: pageData(page, pageSize, total) };
}

function statusForAction(type, action) {
  if (type === 'lost_found_item') {
    return { approve: 'open', reject: 'rejected', process: 'resolved', archive: 'offline', restore: 'pending' }[action];
  }
  return { approve: 'approved', reject: 'rejected', process: 'processed', archive: 'archived', restore: 'pending_review' }[action];
}

export async function changeSubmission({ type, id, action, adminId, reason, reply, publicContent, publicAllowed }) {
  const config = typeConfig(type);
  const model = prisma[config.model];
  const existingSelect = type === 'lost_found_item'
    ? { id: true, status: true, title: true, publicAllowed: true, deletedAt: true }
    : type === 'lost_found_inquiry'
      ? { id: true, status: true, queryNo: true, deletedAt: true }
    : { id: true, status: true, publicAllowed: true, publicContent: true, queryNo: true, deletedAt: true };
  const existing = await model.findUnique({ where: { id }, select: existingSelect });
  if (!existing) throw ApiError.notFound(`${config.label}不存在`);
  const currentStatus = type === 'lost_found_item' ? (ITEM_STATUS_TO_SUBMISSION[existing.status] || existing.status) : existing.status;
  if (action === 'delete') {
    if (type === 'lost_found_item') await model.update({ where: { id }, data: { status: 'offline', publicAllowed: false, deletedAt: new Date() } });
    else await model.update({ where: { id }, data: { status: 'deleted', deletedAt: new Date(), ...(type === 'lost_found_inquiry' ? {} : { publicAllowed: false }) } });
    await logAudit({ adminId, action: `public.${type}.delete`, targetType: config.targetType, targetId: id, detail: { from: existing.status } });
    return { id, type, action, status: 'deleted' };
  }
  const nextStatus = statusForAction(type, action);
  if (!nextStatus) throw ApiError.badRequest('不支持的投稿操作');
  if (!ALLOWED_FROM[action].includes(currentStatus)) {
    throw new ApiError(CODE.CONFLICT, `当前状态「${currentStatus}」不能执行该操作`, 409);
  }
  if (action === 'reject' && (!reason || reason.trim().length < 2)) throw ApiError.badRequest('驳回必须填写原因');
  const data = { status: nextStatus };
  if (action === 'restore') {
    data.deletedAt = null;
    if (type !== 'lost_found_inquiry') data.publicAllowed = false;
  }
  if (action === 'reject') data[type === 'lost_found_item' ? 'rejectReason' : 'internalNote'] = reason.trim();
  if (action === 'process' && type !== 'lost_found_item') { data.processedAt = new Date(); if (reply !== undefined) data.adminReply = reply || null; }
  if (publicContent !== undefined && (type === 'canteen_feedback' || type === 'mailbox')) {
    data.publicContent = publicContent || null;
  }
  if (action === 'approve') {
    if (type === 'mailbox' || type === 'canteen_feedback') {
      data.publicAllowed = publicAllowed === undefined ? Boolean(existing.publicAllowed) : Boolean(publicAllowed);
    }
    if (type === 'lost_found_item') data.publicAllowed = true;
    if (type !== 'lost_found_item' && !data.publicAllowed && publicContent === undefined) data.publicContent = null;
  }
  if (action === 'archive' && type !== 'lost_found_inquiry') data.publicAllowed = false;
  const resultSelect = type === 'lost_found_item'
    ? { id: true, status: true, publicAllowed: true, queryNo: true }
    : type === 'lost_found_inquiry'
      ? { id: true, status: true, queryNo: true, processedAt: true }
      : { id: true, status: true, publicAllowed: true, publicContent: true, queryNo: true, processedAt: true };
  const updated = await model.update({ where: { id }, data, select: resultSelect });
  await logAudit({ adminId, action: `public.${type}.${action}`, targetType: config.targetType, targetId: id, detail: { from: currentStatus, to: nextStatus } });
  return { ...updated, status: type === 'lost_found_item' ? (ITEM_STATUS_TO_SUBMISSION[updated.status] || updated.status) : updated.status, type, action };
}
