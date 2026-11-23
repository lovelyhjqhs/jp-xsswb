import { prisma } from '../../db/prisma.js';
import { ApiError } from '../../utils/response.js';
import { logAudit } from '../audit.service.js';

const CONTENT_STATES = ['draft', 'pending_review', 'published', 'rejected', 'archived', 'deleted'];
const ensureState = (status) => {
  if (status && !CONTENT_STATES.includes(status)) throw ApiError.badRequest('内容状态不合法');
  return status;
};
const pageData = (page, pageSize, total) => ({ page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) });

function actionTarget(action) {
  if (!['publish', 'withdraw', 'archive', 'delete', 'restore', 'reject'].includes(action)) throw ApiError.badRequest('内容操作不支持');
  return { publish: 'published', withdraw: 'draft', archive: 'archived', delete: 'deleted', restore: 'draft', reject: 'rejected' }[action];
}

async function changeContent({ model, id, action, adminId, label }) {
  const row = await prisma[model].findUnique({ where: { id }, select: { id: true, status: true, deletedAt: true } });
  if (!row) throw ApiError.notFound(`${label}不存在`);
  const next = actionTarget(action);
  const data = { status: next, ...(next === 'published' ? { publishedAt: new Date(), deletedAt: null } : {}), ...(next === 'deleted' ? { deletedAt: new Date() } : {}), ...(action === 'restore' ? { deletedAt: null } : {}) };
  const result = await prisma[model].update({ where: { id }, data });
  await logAudit({ adminId, action: `site.${model}.${action}`, targetType: model, targetId: id, detail: { from: row.status, to: next } });
  return result;
}

export async function getProfile() {
  return prisma.departmentProfile.findFirst({ where: { profileKey: 'main' }, orderBy: { id: 'asc' } });
}

export async function saveProfile({ payload, adminId }) {
  if (!payload.history || !payload.organization || !payload.spirit) throw ApiError.badRequest('历史沿革、组织架构和精神风貌均不能为空');
  const existing = await prisma.departmentProfile.findFirst({ where: { profileKey: 'main' }, select: { id: true } });
  const row = existing
    ? await prisma.departmentProfile.update({ where: { id: existing.id }, data: { history: payload.history, organization: payload.organization, spirit: payload.spirit, status: 'draft', updatedBy: adminId, deletedAt: null } })
    : await prisma.departmentProfile.create({ data: { profileKey: 'main', history: payload.history, organization: payload.organization, spirit: payload.spirit, status: 'draft', updatedBy: adminId } });
  await logAudit({ adminId, action: 'site.department_profile.save', targetType: 'department_profile', targetId: row.id });
  return row;
}

export async function changeProfile(action, adminId) {
  const row = await prisma.departmentProfile.findFirst({ where: { profileKey: 'main' }, select: { id: true } });
  if (!row) throw ApiError.notFound('部门概况不存在');
  return changeContent({ model: 'departmentProfile', id: row.id, action, adminId, label: '部门概况' });
}

const newsSelect = { id: true, slug: true, title: true, categoryId: true, summary: true, body: true, coverMediaId: true, status: true, publishedAt: true, createdBy: true, createdAt: true, updatedAt: true, deletedAt: true, category: { select: { id: true, name: true, slug: true } }, cover: { select: { id: true, url: true, altText: true, mimeType: true, width: true, height: true, visibility: true } } };

export async function listNews({ page = 1, pageSize = 20, status, keyword }) {
  ensureState(status);
  const where = { ...(status ? { status } : {}), ...(keyword ? { OR: [{ title: { contains: keyword } }, { summary: { contains: keyword } }, { body: { contains: keyword } }] } : {}) };
  const [total, list] = await prisma.$transaction([prisma.news.count({ where }), prisma.news.findMany({ where, select: newsSelect, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * pageSize, take: pageSize })]);
  return { list, pagination: pageData(page, pageSize, total) };
}

export async function getNews(id) {
  const row = await prisma.news.findUnique({ where: { id }, select: newsSelect });
  if (!row) throw ApiError.notFound('动态不存在');
  return row;
}

export async function saveNews({ id, payload, adminId }) {
  if (payload.categoryId) {
    const category = await prisma.siteCategory.findFirst({ where: { id: payload.categoryId, kind: 'news', enabled: true }, select: { id: true } });
    if (!category) throw ApiError.badRequest('动态分类不存在或已停用');
  }
  if (payload.coverMediaId) {
    const media = await prisma.siteMedia.findFirst({ where: { id: payload.coverMediaId, kind: 'image', deletedAt: null }, select: { id: true } });
    if (!media) throw ApiError.badRequest('封面图片不存在或已删除');
  }
  const data = { slug: payload.slug, title: payload.title, categoryId: payload.categoryId || null, summary: payload.summary, body: payload.body, coverMediaId: payload.coverMediaId || null, ...(id ? {} : { createdBy: adminId }), ...(id ? { status: 'draft', deletedAt: null } : { status: 'draft' }) };
  let row;
  try { row = id ? await prisma.news.update({ where: { id }, data, select: newsSelect }) : await prisma.news.create({ data, select: newsSelect }); }
  catch (error) { if (error.code === 'P2002') throw ApiError.conflict('动态 slug 已存在'); throw error; }
  await logAudit({ adminId, action: `site.news.${id ? 'update' : 'create'}`, targetType: 'news', targetId: row.id });
  return row;
}

export async function changeNews(action, id, adminId) { return changeContent({ model: 'news', id, action, adminId, label: '动态' }); }

const reportSelect = { id: true, reportMonth: true, surveySummary: true, feedbackSummary: true, status: true, publishedAt: true, createdBy: true, createdAt: true, updatedAt: true, deletedAt: true, photos: { orderBy: { sortOrder: 'asc' }, select: { sortOrder: true, media: true } } };

export async function listReports({ page = 1, pageSize = 20, status }) {
  ensureState(status);
  const where = status ? { status } : {};
  const [total, list] = await prisma.$transaction([prisma.canteenMonthlyReport.count({ where }), prisma.canteenMonthlyReport.findMany({ where, select: reportSelect, orderBy: [{ reportMonth: 'desc' }, { id: 'desc' }], skip: (page - 1) * pageSize, take: pageSize })]);
  return { list, pagination: pageData(page, pageSize, total) };
}

export async function saveReport({ id, payload, adminId }) {
  if (!/^\d{4}-\d{2}$/.test(payload.reportMonth)) throw ApiError.badRequest('月份格式应为 YYYY-MM');
  const data = { reportMonth: new Date(`${payload.reportMonth}-01T00:00:00.000Z`), surveySummary: payload.surveySummary, feedbackSummary: payload.feedbackSummary, ...(id ? { status: 'draft', deletedAt: null } : { status: 'draft', createdBy: adminId }) };
  let row;
  try { row = id ? await prisma.canteenMonthlyReport.update({ where: { id }, data, select: reportSelect }) : await prisma.canteenMonthlyReport.create({ data, select: reportSelect }); }
  catch (error) { if (error.code === 'P2002') throw ApiError.conflict('该月份月报已存在'); throw error; }
  await logAudit({ adminId, action: `site.canteen_report.${id ? 'update' : 'create'}`, targetType: 'canteen_monthly_report', targetId: row.id });
  return row;
}

export async function changeReport(action, id, adminId) { return changeContent({ model: 'canteenMonthlyReport', id, action, adminId, label: '食堂月报' }); }

export async function setReportPhotos({ reportId, mediaIds, adminId }) {
  const report = await prisma.canteenMonthlyReport.findUnique({ where: { id: reportId }, select: { id: true } });
  if (!report) throw ApiError.notFound('食堂月报不存在');
  const uniqueIds = [...new Set(mediaIds)];
  const media = await prisma.siteMedia.findMany({ where: { id: { in: uniqueIds }, kind: 'image', deletedAt: null }, select: { id: true } });
  if (media.length !== uniqueIds.length) throw ApiError.badRequest('存在无效或已删除的图片');
  await prisma.$transaction(async (tx) => {
    await tx.canteenReportMedia.deleteMany({ where: { reportId } });
    if (uniqueIds.length) await tx.canteenReportMedia.createMany({ data: uniqueIds.map((mediaId, index) => ({ reportId, mediaId, sortOrder: index })) });
  });
  await logAudit({ adminId, action: 'site.canteen_report.photos', targetType: 'canteen_monthly_report', targetId: reportId, detail: { mediaIds: uniqueIds } });
  return prisma.canteenReportMedia.findMany({ where: { reportId }, orderBy: { sortOrder: 'asc' }, include: { media: true } });
}

export async function recycleBin({ page = 1, pageSize = 50 }) {
  const [news, reports, profile, mailbox, feedback, inquiries, items, media] = await Promise.all([
    prisma.news.findMany({ where: { deletedAt: { not: null } }, select: { id: true, title: true, status: true, deletedAt: true } }),
    prisma.canteenMonthlyReport.findMany({ where: { deletedAt: { not: null } }, select: { id: true, reportMonth: true, status: true, deletedAt: true } }),
    prisma.departmentProfile.findMany({ where: { deletedAt: { not: null } }, select: { id: true, profileKey: true, status: true, deletedAt: true } }),
    prisma.mailboxMessage.findMany({ where: { deletedAt: { not: null } }, select: { id: true, subject: true, status: true, deletedAt: true } }),
    prisma.canteenFeedback.findMany({ where: { deletedAt: { not: null } }, select: { id: true, queryNo: true, status: true, deletedAt: true } }),
    prisma.lostFoundInquiry.findMany({ where: { deletedAt: { not: null } }, select: { id: true, queryNo: true, status: true, deletedAt: true } }),
    prisma.item.findMany({ where: { deletedAt: { not: null } }, select: { id: true, title: true, status: true, deletedAt: true } }),
    prisma.siteMedia.findMany({ where: { deletedAt: { not: null } }, select: { id: true, url: true, altText: true, deletedAt: true } }),
  ]);
  const all = [...news.map((row) => ({ ...row, type: 'news' })), ...reports.map((row) => ({ ...row, type: 'canteen_report' })), ...profile.map((row) => ({ ...row, type: 'department_profile' })), ...mailbox.map((row) => ({ ...row, type: 'mailbox' })), ...feedback.map((row) => ({ ...row, type: 'canteen_feedback' })), ...inquiries.map((row) => ({ ...row, type: 'lost_found_inquiry' })), ...items.map((row) => ({ ...row, type: 'item' })), ...media.map((row) => ({ ...row, type: 'media' }))].sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt));
  return { list: all.slice((page - 1) * pageSize, page * pageSize), pagination: pageData(page, pageSize, all.length) };
}

export async function restoreDeleted(type, id, adminId) {
  const models = { news: 'news', canteen_report: 'canteenMonthlyReport', department_profile: 'departmentProfile', mailbox: 'mailboxMessage', canteen_feedback: 'canteenFeedback', lost_found_inquiry: 'lostFoundInquiry', item: 'item', media: 'siteMedia' };
  const model = models[type];
  if (!model) throw ApiError.badRequest('回收站类型不合法');
  const row = await prisma[model].findUnique({ where: { id }, select: { id: true, deletedAt: true } });
  if (!row || !row.deletedAt) throw ApiError.notFound('回收站记录不存在');
  if (model === 'siteMedia') {
    const updatedMedia = await prisma.siteMedia.update({ where: { id }, data: { deletedAt: null, visibility: 'private' } });
    await logAudit({ adminId, action: 'site.recycle.restore', targetType: type, targetId: id });
    return updatedMedia;
  }
  const data = model === 'item'
    ? { deletedAt: null, status: 'pending', publicAllowed: false }
    : { deletedAt: null, status: ['mailbox', 'canteen_feedback', 'lost_found_inquiry'].includes(type) ? 'pending_review' : 'draft' };
  const updated = await prisma[model].update({ where: { id }, data });
  await logAudit({ adminId, action: `site.recycle.restore`, targetType: type, targetId: id });
  return updated;
}
