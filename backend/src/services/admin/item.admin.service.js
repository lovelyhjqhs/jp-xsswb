// 内容管理：帖子列表、状态流转、删除、批量操作
import { prisma } from '../../db/prisma.js';
import { ApiError, CODE } from '../../utils/response.js';
import { escapeLikePattern } from '../../utils/sql.js';
import { logAudit } from '../audit.service.js';

const STATUS_LABELS = {
  pending: '待审核',
  open: '进行中',
  resolved: '已找回',
  cleaned: '已清理',
  rejected: '已驳回',
  offline: '已下架',
};

/** 后台列表要看到联系方式、发布者学号、举报数，与前台列表的字段集不同 */
const ADMIN_ITEM_SELECT = {
  id: true,
  type: true,
  title: true,
  description: true,
  itemNo: true,
  area: true,
  features: true,
  location: true,
  happenedAt: true,
  status: true,
  rejectReason: true,
  viewCount: true,
  createdAt: true,
  updatedAt: true,
  resolvedAt: true,
  contactType: true,
  contactValue: true,
  internalNote: true,
  category: { select: { id: true, name: true } },
  user: { select: { id: true, studentNo: true, name: true, status: true } },
  images: { select: { id: true, url: true }, orderBy: { sortOrder: 'asc' } },
  _count: { select: { reports: true } },
};

/**
 * 状态流转规则。
 * 「驳回」允许从 open/resolved 发起：驳回后作者可以编辑再提交（前台对 rejected 开放编辑），
 * 而「下架」只是隐藏，作者不能自己改回来。两者的区别就在这里。
 */
const TRANSITIONS = {
  approve: { from: ['pending', 'rejected'], to: 'open', audit: 'item.approve', label: '审核通过' },
  reject: { from: ['pending', 'open', 'resolved'], to: 'rejected', audit: 'item.reject', label: '驳回' },
  offline: {
    from: ['open', 'resolved', 'pending', 'rejected'],
    to: 'offline',
    audit: 'item.offline',
    label: '下架',
  },
  restore: { from: ['offline', 'rejected'], to: 'open', audit: 'item.restore', label: '恢复' },
  clean: { from: ['open', 'resolved'], to: 'cleaned', audit: 'item.clean', label: '标记已清理' },
  archive: { from: ['cleaned'], to: 'offline', audit: 'item.archive', label: '归档' },
};

export const ITEM_ACTIONS = Object.keys(TRANSITIONS);

function buildPagination(page, pageSize, total) {
  return { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

/** 后台帖子列表：所有状态可见，可按状态/类型/关键词筛选 */
export async function listItemsForAdmin(query) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;

  const where = {};
  if (query.status) where.status = query.status;
  if (query.type) where.type = query.type;
  if (query.area) where.area = query.area;
  if (query.categoryId) where.categoryId = query.categoryId;
  if (query.itemNo) where.itemNo = query.itemNo;
  if (query.dateFrom || query.dateTo) {
    where.happenedAt = {};
    if (query.dateFrom) where.happenedAt.gte = query.dateFrom;
    if (query.dateTo) {
      const dateTo = new Date(query.dateTo);
      dateTo.setUTCHours(23, 59, 59, 999);
      where.happenedAt.lte = dateTo;
    }
  }
  if (query.keyword) {
    // 转义 LIKE 通配符，避免「搜一个 % 就扫全表」
    const keyword = escapeLikePattern(query.keyword);
    where.OR = [
      { title: { contains: keyword } },
      { description: { contains: keyword } },
      { features: { contains: keyword } },
      { itemNo: { contains: keyword } },
      { location: { contains: keyword } },
      { user: { studentNo: { contains: keyword } } },
      { user: { name: { contains: keyword } } },
    ];
  }

  const [total, rows] = await prisma.$transaction([
    prisma.item.count({ where }),
    prisma.item.findMany({
      where,
      select: ADMIN_ITEM_SELECT,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return { list: rows, pagination: buildPagination(page, pageSize, total) };
}

/** 单个帖子的状态流转（含审计日志） */
export async function changeItemStatus({ itemId, action, adminId, reason }) {
  const config = TRANSITIONS[action];
  if (!config) throw ApiError.badRequest(`不支持的操作：${action}`);

  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: { id: true, title: true, status: true },
  });
  if (!item) throw ApiError.notFound('帖子不存在或已被删除');

  if (!config.from.includes(item.status)) {
    throw new ApiError(
      CODE.CONFLICT,
      `该帖子当前是「${STATUS_LABELS[item.status]}」，不能执行「${config.label}」`,
      409,
    );
  }

  const updated = await prisma.item.update({
    where: { id: itemId },
    data: {
      status: config.to,
      // 游客投稿在审核前明确不公开；审核通过/恢复后才进入公开台账。
      ...(action === 'approve' || action === 'restore' ? { publicAllowed: true } : {}),
      ...(action === 'offline' || action === 'archive' || action === 'clean' ? { publicAllowed: false } : {}),
      // 驳回必须带原因；通过与恢复时清空历史原因
      ...(action === 'reject' ? { rejectReason: reason } : {}),
      ...(action === 'approve' || action === 'restore' ? { rejectReason: null } : {}),
    },
    select: ADMIN_ITEM_SELECT,
  });

  await logAudit({
    adminId,
    action: config.audit,
    targetType: 'item',
    targetId: itemId,
    detail: {
      from: item.status,
      to: config.to,
    },
  });

  return updated;
}

/** 管理员删除任意帖子 */
export async function deleteItemAsAdmin({ itemId, adminId, softDelete = false }) {
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: { id: true, title: true, status: true },
  });
  if (!item) throw ApiError.notFound('帖子不存在或已被删除');

  if (softDelete) await prisma.item.update({ where: { id: itemId }, data: { deletedAt: new Date(), status: 'offline', publicAllowed: false } });
  else await prisma.item.delete({ where: { id: itemId } });

  await logAudit({
    adminId,
    action: 'item.delete',
    targetType: 'item',
    targetId: itemId,
    detail: { title: item.title, status: item.status },
  });
}

/**
 * 批量操作：逐条执行，单条失败不影响其他条，最后返回成功/失败明细。
 * 不用事务包住整批，是因为「批量下架 50 条，其中 1 条状态不对」时，
 * 另外 49 条应该照常生效。
 */
export async function batchChangeItems({ action, ids, reason, adminId, softDelete = false }) {
  const uniqueIds = [...new Set(ids)];
  const succeeded = [];
  const failed = [];

  for (const itemId of uniqueIds) {
    try {
      if (action === 'delete') {
        await deleteItemAsAdmin({ itemId, adminId, softDelete });
      } else {
        await changeItemStatus({ itemId, action, adminId, reason });
      }
      succeeded.push(itemId);
    } catch (error) {
        failed.push({ id: itemId, message: error instanceof ApiError ? error.message : '操作失败，请重试' });
    }
  }

  return {
    action,
    requested: uniqueIds.length,
    succeeded: succeeded.length,
    failed: failed.length,
    failedItems: failed,
  };
}
