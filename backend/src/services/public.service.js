import { prisma } from '../db/prisma.js';
import { ApiError } from '../utils/response.js';
import { escapeLikePattern } from '../utils/sql.js';
import { createHash, timingSafeEqual } from 'node:crypto';

const PAGE_SIZE = 12;
const PUBLISHED = 'published';
const PUBLIC_SUBMISSION_STATUSES = { in: ['approved', 'processed'] };
const pagination = (page, pageSize, total) => ({ page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
const monthStart = (value) => (value ? new Date(`${value}-01T00:00:00.000Z`) : undefined);
const monthEnd = (value) => {
  if (!value) return undefined;
  const [year, month] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
};
const publicMedia = (media) => {
  if (!media || media.visibility !== 'public' || media.deletedAt) return null;
  return { id: media.id, url: media.url, altText: media.altText, mimeType: media.mimeType, width: media.width, height: media.height };
};

function matchesCredential(storedHash, presentedHash) {
  if (typeof storedHash !== 'string' || !/^[a-f0-9]{64}$/i.test(storedHash)) return false;
  const stored = Buffer.from(storedHash, 'hex');
  const presented = Buffer.from(presentedHash, 'hex');
  return stored.length === presented.length && timingSafeEqual(stored, presented);
}

export async function getProfile() {
  const profile = await prisma.departmentProfile.findFirst({
    where: { profileKey: 'main', status: PUBLISHED, deletedAt: null },
    orderBy: { publishedAt: 'desc' },
    select: {
      id: true,
      history: true,
      organization: true,
      spirit: true,
      publishedAt: true,
      logo: {
        select: {
          id: true,
          url: true,
          altText: true,
          mimeType: true,
          width: true,
          height: true,
          visibility: true,
          deletedAt: true,
        },
      },
    },
  });
  if (!profile) return null;
  return { ...profile, logo: publicMedia(profile.logo) };
}

export async function listNews(query = {}) {
  const page = query.page ?? 1; const pageSize = query.pageSize ?? PAGE_SIZE;
  const where = { status: PUBLISHED, deletedAt: null };
  if (query.categoryId) where.categoryId = query.categoryId;
  if (query.keyword) { const keyword = escapeLikePattern(query.keyword); where.OR = [{ title: { contains: keyword } }, { summary: { contains: keyword } }, { body: { contains: keyword } }]; }
  if (query.dateFrom || query.dateTo) { where.publishedAt = {}; if (query.dateFrom) where.publishedAt.gte = query.dateFrom; if (query.dateTo) where.publishedAt.lte = query.dateTo; }
  const select = { id: true, slug: true, title: true, summary: true, publishedAt: true, category: { select: { id: true, name: true, slug: true } }, cover: { select: { id: true, url: true, altText: true, mimeType: true, width: true, height: true, visibility: true, deletedAt: true } } };
  const [total, rows] = await prisma.$transaction([prisma.news.count({ where }), prisma.news.findMany({ where, select, orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * pageSize, take: pageSize })]);
  return { list: rows.map((row) => ({ ...row, cover: publicMedia(row.cover) })), pagination: pagination(page, pageSize, total) };
}

export async function getNews(idOrSlug) {
  const numericId = /^\d+$/.test(String(idOrSlug)) ? Number(idOrSlug) : null;
  const row = await prisma.news.findFirst({ where: { ...(numericId ? { id: numericId } : { slug: String(idOrSlug) }), status: PUBLISHED, deletedAt: null }, select: { id: true, slug: true, title: true, summary: true, body: true, publishedAt: true, category: { select: { id: true, name: true, slug: true } }, cover: { select: { id: true, url: true, altText: true, mimeType: true, width: true, height: true, visibility: true, deletedAt: true } } } });
  if (!row) throw ApiError.notFound('动态不存在或暂未公开');
  return { ...row, cover: publicMedia(row.cover) };
}

export async function listCanteenReports(query = {}) {
  const page = query.page ?? 1; const pageSize = query.pageSize ?? PAGE_SIZE; const where = { status: PUBLISHED, deletedAt: null }; const range = {};
  if (query.monthFrom) range.gte = monthStart(query.monthFrom); if (query.monthTo) range.lte = monthEnd(query.monthTo); if (Object.keys(range).length) where.reportMonth = range;
  const select = { id: true, reportMonth: true, surveySummary: true, feedbackSummary: true, publishedAt: true };
  const [total, rows] = await prisma.$transaction([prisma.canteenMonthlyReport.count({ where }), prisma.canteenMonthlyReport.findMany({ where, select, orderBy: [{ reportMonth: 'desc' }, { id: 'desc' }], skip: (page - 1) * pageSize, take: pageSize })]);
  return { list: rows, pagination: pagination(page, pageSize, total) };
}

export async function getCanteenReport(month) {
  const report = await prisma.canteenMonthlyReport.findFirst({ where: { reportMonth: monthStart(month), status: PUBLISHED, deletedAt: null }, select: { id: true, reportMonth: true, surveySummary: true, feedbackSummary: true, publishedAt: true, photos: { orderBy: { sortOrder: 'asc' }, select: { media: { select: { id: true, url: true, altText: true, mimeType: true, width: true, height: true, visibility: true, deletedAt: true } } } } } });
  if (!report) throw ApiError.notFound('该月份食堂月报不存在或暂未公开');
  const feedback = await prisma.canteenFeedback.findMany({ where: { reportMonth: monthStart(month), publicAllowed: true, publicContent: { not: null }, status: PUBLIC_SUBMISSION_STATUSES, deletedAt: null }, select: { id: true, publicContent: true, submittedAt: true }, orderBy: { submittedAt: 'desc' }, take: 50 });
  return { ...report, photos: report.photos.map((photo) => publicMedia(photo.media)).filter(Boolean), feedback: feedback.filter((item) => item.publicContent).map((item) => ({ id: item.id, content: item.publicContent, submittedAt: item.submittedAt })) };
}

const itemSelect = { id: true, itemNo: true, area: true, type: true, title: true, description: true, features: true, location: true, happenedAt: true, status: true, createdAt: true, updatedAt: true, resolvedAt: true, category: { select: { id: true, name: true } }, images: { orderBy: { sortOrder: 'asc' }, select: { id: true, url: true, sortOrder: true } } };
const itemDto = (item) => ({ id: item.id, itemNo: item.itemNo || `LF-${String(item.id).padStart(6, '0')}`, area: item.area, itemType: item.type, type: item.type, title: item.title, description: item.description, features: item.features || item.description, location: item.location, happenedAt: item.happenedAt, status: item.status, category: item.category, images: item.images.map((image) => ({ id: image.id, url: image.url.startsWith('/private-uploads/') ? `/api/public/lost-found/${item.id}/images/${image.id}` : image.url, altText: `${item.title} 图片 ${image.sortOrder + 1}` })), createdAt: item.createdAt, updatedAt: item.updatedAt, resolvedAt: item.resolvedAt });

export async function getPublicLostFoundImage(itemId, imageId) {
  const image = await prisma.itemImage.findFirst({
    where: {
      id: imageId,
      itemId,
      item: { publicAllowed: true, deletedAt: null, status: 'open' },
    },
    select: { url: true },
  });
  if (!image) throw ApiError.notFound('图片不存在或暂未公开');
  return image.url;
}

export async function getPublicSitemapEntries() {
  const [profile, news, reports, items] = await Promise.all([
    prisma.departmentProfile.findFirst({ where: { profileKey: 'main', status: PUBLISHED, deletedAt: null }, select: { publishedAt: true } }),
    prisma.news.findMany({ where: { status: PUBLISHED, deletedAt: null }, select: { slug: true, publishedAt: true }, orderBy: { publishedAt: 'desc' } }),
    prisma.canteenMonthlyReport.findMany({ where: { status: PUBLISHED, deletedAt: null }, select: { reportMonth: true, publishedAt: true }, orderBy: { reportMonth: 'desc' } }),
    prisma.item.findMany({ where: { publicAllowed: true, deletedAt: null, status: 'open' }, select: { id: true, updatedAt: true }, orderBy: { updatedAt: 'desc' } }),
  ]);
  return [
    { path: '/', lastmod: profile?.publishedAt },
    { path: '/about', lastmod: profile?.publishedAt },
    { path: '/news', lastmod: news[0]?.publishedAt },
    { path: '/canteen', lastmod: reports[0]?.publishedAt },
    { path: '/lost-found', lastmod: items[0]?.updatedAt },
    { path: '/mailbox', lastmod: undefined },
    ...news.map((entry) => ({ path: `/news/${encodeURIComponent(entry.slug)}`, lastmod: entry.publishedAt })),
    ...reports.map((entry) => ({ path: `/canteen/${entry.reportMonth.toISOString().slice(0, 7)}`, lastmod: entry.publishedAt })),
    ...items.map((entry) => ({ path: `/lost-found/${entry.id}`, lastmod: entry.updatedAt })),
  ];
}

export async function listLostFound(query = {}) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? PAGE_SIZE;
  // 已归还/已清理记录立即退出公开检索；管理员仍可在后台查看留存记录。
  const statusMap = { published: 'open', claimed_returned: 'resolved', cleaned: 'offline' };
  const requestedStatus = query.status ? statusMap[query.status] || query.status : null;
  const where = { publicAllowed: true, deletedAt: null, status: 'open' };
  if (requestedStatus && requestedStatus !== 'open') where.id = -1;
  if (query.area) where.area = query.area; if (query.type) where.type = query.type; if (query.categoryId) where.categoryId = query.categoryId;
  if (query.keyword) { const keyword = escapeLikePattern(query.keyword); where.OR = [{ title: { contains: keyword } }, { description: { contains: keyword } }, { features: { contains: keyword } }, { location: { contains: keyword } }, { itemNo: { contains: keyword } }]; }
  if (query.features) where.features = { contains: escapeLikePattern(query.features) };
  if (query.itemNo) {
    const generatedId = /^LF-(\d+)$/i.exec(query.itemNo)?.[1];
    if (generatedId) {
      const id = Number(generatedId);
      if (!Number.isSafeInteger(id) || id < 1) throw ApiError.badRequest('编号格式不正确');
      where.id = id;
    } else if (/^\d+$/.test(query.itemNo)) {
      const id = Number(query.itemNo);
      if (!Number.isSafeInteger(id) || id < 1) throw ApiError.badRequest('编号格式不正确');
      where.id = id;
    } else {
      where.itemNo = query.itemNo;
    }
  }
  if (query.dateFrom || query.dateTo) {
    where.happenedAt = {};
    if (query.dateFrom) where.happenedAt.gte = query.dateFrom;
    if (query.dateTo) {
      const dateTo = new Date(query.dateTo);
      // 日期筛选按自然日包含结束日，避免 YYYY-MM-DD 被解析为当天 00:00 后排除整天记录。
      dateTo.setUTCHours(23, 59, 59, 999);
      where.happenedAt.lte = dateTo;
    }
  }
  const [total, rows] = await prisma.$transaction([prisma.item.count({ where }), prisma.item.findMany({ where, select: itemSelect, orderBy: [{ happenedAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * pageSize, take: pageSize })]);
  return { list: rows.map(itemDto), pagination: pagination(page, pageSize, total) };
}

export async function getLostFound(id) {
  const item = await prisma.item.findFirst({ where: { id, deletedAt: null, publicAllowed: true, status: 'open' }, select: itemSelect });
  if (!item) throw ApiError.notFound('失物记录不存在或暂未公开');
  await prisma.item.update({ where: { id }, data: { viewCount: { increment: 1 } } });
  return itemDto(item);
}

export async function listPublicMailbox(query = {}) {
  const page = query.page ?? 1; const pageSize = query.pageSize ?? PAGE_SIZE; const where = { publicAllowed: true, status: PUBLIC_SUBMISSION_STATUSES, deletedAt: null, publicContent: { not: null } };
  if (query.categoryId) where.categoryId = query.categoryId; if (query.keyword) { const keyword = escapeLikePattern(query.keyword); where.OR = [{ subject: { contains: keyword } }, { publicContent: { contains: keyword } }]; }
  if (query.dateFrom || query.dateTo) { where.submittedAt = {}; if (query.dateFrom) where.submittedAt.gte = query.dateFrom; if (query.dateTo) where.submittedAt.lte = query.dateTo; }
  const [total, rows] = await prisma.$transaction([prisma.mailboxMessage.count({ where }), prisma.mailboxMessage.findMany({ where, select: { id: true, subject: true, publicContent: true, submittedAt: true, category: { select: { id: true, name: true, slug: true } } }, orderBy: { submittedAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize })]);
  return { list: rows.filter((row) => row.publicContent?.trim()).map((row) => ({ id: row.id, subject: row.subject, publicContent: row.publicContent, content: row.publicContent, submittedAt: row.submittedAt, category: row.category })), pagination: pagination(page, pageSize, total) };
}

export async function listPublicCategories(kind) {
  if (kind === 'lost_found') {
    const categories = await prisma.category.findMany({ where: { enabled: true }, select: { id: true, name: true, sortOrder: true }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] });
    return categories.map((category) => ({ ...category, kind: 'lost_found', slug: String(category.id) }));
  }
  return prisma.siteCategory.findMany({ where: { enabled: true, ...(kind ? { kind } : {}) }, select: { id: true, kind: true, name: true, slug: true, sortOrder: true }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] });
}

export async function getPublicSubmissionStatus({ queryNo, queryCredential }) {
  const credentialHash = createHash('sha256').update(queryCredential).digest('hex');
  const [canteen, mailbox, inquiry, item] = await prisma.$transaction([
    prisma.canteenFeedback.findUnique({ where: { queryNo }, select: { queryNo: true, queryCredentialHash: true, queryExpiresAt: true, status: true, publicAllowed: true, publicContent: true, adminReply: true, submittedAt: true, updatedAt: true, processedAt: true, deletedAt: true } }),
    prisma.mailboxMessage.findUnique({ where: { queryNo }, select: { queryNo: true, queryCredentialHash: true, queryExpiresAt: true, status: true, publicAllowed: true, publicContent: true, adminReply: true, submittedAt: true, updatedAt: true, processedAt: true, deletedAt: true } }),
    prisma.lostFoundInquiry.findUnique({ where: { queryNo }, select: { queryNo: true, queryCredentialHash: true, queryExpiresAt: true, status: true, adminReply: true, submittedAt: true, updatedAt: true, processedAt: true, deletedAt: true } }),
    prisma.item.findUnique({ where: { queryNo }, select: { queryNo: true, queryCredentialHash: true, queryExpiresAt: true, status: true, submittedAt: true, updatedAt: true, resolvedAt: true, publicAllowed: true, deletedAt: true } }),
  ]);
  const record = [canteen, mailbox, inquiry, item].find(Boolean);
  if (!record || record.deletedAt || !matchesCredential(record.queryCredentialHash, credentialHash)) throw ApiError.notFound('查询编号或查询凭证无效');
  if (record.queryExpiresAt && record.queryExpiresAt <= new Date()) throw ApiError.gone('查询凭证已过期，请联系管理员');
  const status = record === item ? ({ pending: 'pending_review', open: 'approved', resolved: 'processed', cleaned: 'archived', rejected: 'rejected', offline: 'archived' }[record.status] || record.status) : record.status;
  // 凭证已经证明这是投稿人本人查询，允许查看管理员给该投稿的回复；
  // 公开正文仍需 publicAllowed，避免把未公开内容展示到公开列表或详情。
  const publicReply = ['processing', 'processed'].includes(record.status) && record.adminReply
    ? record.adminReply
    : (record.publicAllowed && ['approved', 'processed'].includes(record.status) ? record.publicContent : null);
  return { queryNo: record.queryNo, status, publicReply: publicReply || null, submittedAt: record.submittedAt, updatedAt: record.updatedAt, processedAt: record.processedAt || record.resolvedAt || null };
}
