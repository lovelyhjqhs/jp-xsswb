// 帖子业务逻辑：发布、列表、详情、编辑、状态流转、删除、举报。
import { prisma } from '../db/prisma.js';
import { env } from '../config/env.js';
import { ApiError, CODE } from '../utils/response.js';
import { escapeLikePattern } from '../utils/sql.js';
import { startOfDayCN } from '../utils/time.js';
import { maskName } from '../utils/user.js';
import { assertImageUrlUsable } from './upload.service.js';

/** 每个用户每天最多发布条数 */
export const DAILY_ITEM_LIMIT = 10;

/** 对外可见的状态；其余状态只有作者本人和管理员能看到 */
const PUBLIC_STATUSES = ['open', 'resolved'];

const IMAGE_SELECT = {
  orderBy: { sortOrder: 'asc' },
  select: { id: true, url: true, sortOrder: true },
};

/**
 * 列表用：不含联系方式、不含审核字段。
 * 只取 contactType 用来计算 hasContact 标记（DTO 会把它剥掉，不会外泄）。
 */
const LIST_SELECT = {
  id: true,
  type: true,
  title: true,
  description: true,
  location: true,
  happenedAt: true,
  status: true,
  viewCount: true,
  createdAt: true,
  updatedAt: true,
  resolvedAt: true,
  contactType: true,
  category: { select: { id: true, name: true } },
  user: { select: { id: true, name: true } },
  images: IMAGE_SELECT,
};

/** 详情/我的发布用：多取作者 id、联系方式、驳回原因，由 DTO 决定对外暴露哪些 */
const DETAIL_SELECT = {
  ...LIST_SELECT,
  userId: true,
  contactType: true,
  contactValue: true,
  rejectReason: true,
};

/**
 * 把数据库记录转换成响应体。
 * - 联系方式：只有登录用户（viewer 存在）才返回
 * - 发布者姓名：对其他人脱敏（张*），作者本人与管理员看完整姓名
 * - 驳回原因：只有作者本人或管理员才返回
 */
export function toItemDto(item, viewer = null) {
  const { userId, contactType, contactValue, rejectReason, user, ...rest } = item;

  const isOwner = viewer?.id === userId;
  const isAdmin = viewer?.role === 'admin';

  const dto = {
    ...rest,
    user: user ? (isOwner || isAdmin ? user : { id: user.id, name: maskName(user.name) }) : null,
    hasContact: Boolean(contactType),
  };

  if (viewer) {
    dto.contactType = contactType;
    dto.contactValue = contactValue;
  }
  if ((isOwner || isAdmin) && rejectReason) {
    dto.rejectReason = rejectReason;
  }
  return dto;
}

/** 分类必须存在且处于启用状态 */
async function assertCategoryUsable(categoryId) {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true, enabled: true },
  });
  if (!category) throw ApiError.badRequest('分类不存在');
  if (!category.enabled) throw ApiError.badRequest('该分类已停用，请选择其他分类');
}

/** 校验 1-5 张图片的地址 */
async function assertImagesUsable(urls) {
  for (const url of urls) {
    await assertImageUrlUsable(url);
  }
}

/** 每日发布额度 */
async function assertDailyQuota(userId) {
  const created = await prisma.item.count({
    where: { userId, createdAt: { gte: startOfDayCN() } },
  });
  if (created >= DAILY_ITEM_LIMIT) {
    throw new ApiError(
      CODE.TOO_MANY_REQUESTS,
      `每天最多发布 ${DAILY_ITEM_LIMIT} 条，请明天再试`,
      429,
    );
  }
}

function buildPagination(page, pageSize, total) {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

function buildImageCreate(urls) {
  return urls.map((url, index) => ({ url, sortOrder: index }));
}

/** 发布帖子 */
export async function createItem(user, payload) {
  await assertDailyQuota(user.id);
  await assertCategoryUsable(payload.categoryId);
  await assertImagesUsable(payload.images);

  // 发布即上线；开启审核时先进入 pending
  const status = env.REQUIRE_REVIEW ? 'pending' : 'open';

  const item = await prisma.item.create({
    data: {
      userId: user.id,
      type: payload.type,
      title: payload.title,
      description: payload.description,
      categoryId: payload.categoryId,
      location: payload.location,
      happenedAt: payload.happenedAt,
      contactType: payload.contactType,
      contactValue: payload.contactValue,
      status,
      images: { create: buildImageCreate(payload.images) },
    },
    select: DETAIL_SELECT,
  });

  return toItemDto(item, user);
}

/**
 * 公开列表：只返回 open / resolved，永不返回联系方式。
 * 故意不接收 viewer：列表对所有访客返回同样的字段集合，
 * 联系方式只在详情接口里按登录态决定是否返回。
 */
export async function listItems(query) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 12;

  const where = { status: query.status ?? { in: PUBLIC_STATUSES } };
  if (query.type) where.type = query.type;
  if (query.categoryId) where.categoryId = query.categoryId;

  if (query.keyword) {
    // 转义 % 和 _，避免用户用通配符扫全表
    const keyword = escapeLikePattern(query.keyword);
    // 标题 / 描述 / 地点 三处模糊匹配
    where.OR = [
      { title: { contains: keyword } },
      { description: { contains: keyword } },
      { location: { contains: keyword } },
    ];
  }

  const [total, rows] = await prisma.$transaction([
    prisma.item.count({ where }),
    prisma.item.findMany({
      where,
      select: LIST_SELECT,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    list: rows.map((row) => toItemDto(row)),
    pagination: buildPagination(page, pageSize, total),
  };
}

/** 详情：浏览数 +1；非公开状态仅作者/管理员可见 */
export async function getItemDetail(itemId, viewer = null) {
  const item = await prisma.item.findUnique({ where: { id: itemId }, select: DETAIL_SELECT });

  // 不存在与无权查看返回同一个 404，避免通过状态码探测隐藏帖子
  if (!item) throw ApiError.notFound('帖子不存在或已被删除');

  const isOwner = viewer?.id === item.userId;
  const isAdmin = viewer?.role === 'admin';
  if (!PUBLIC_STATUSES.includes(item.status) && !isOwner && !isAdmin) {
    throw ApiError.notFound('帖子不存在或已被删除');
  }

  // 用原子自增，避免并发下的读-改-写丢失
  const { viewCount } = await prisma.item.update({
    where: { id: itemId },
    data: { viewCount: { increment: 1 } },
    select: { viewCount: true },
  });

  return toItemDto({ ...item, viewCount }, viewer);
}

/**
 * 编辑帖子：仅作者本人，且当前状态必须是 open / rejected。
 * 开启审核时，编辑后重新回到 pending 等管理员复核。
 */
export async function updateItem(itemId, user, payload) {
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: { id: true, userId: true, status: true },
  });

  if (!item) throw ApiError.notFound('帖子不存在或已被删除');
  if (item.userId !== user.id) throw ApiError.forbidden('只能编辑自己发布的帖子');
  if (!['open', 'rejected'].includes(item.status)) {
    throw new ApiError(CODE.CONFLICT, '当前状态不允许编辑', 409);
  }

  if (payload.categoryId) await assertCategoryUsable(payload.categoryId);
  if (payload.images) await assertImagesUsable(payload.images);

  const { images, ...fields } = payload;

  const updated = await prisma.item.update({
    where: { id: itemId },
    data: {
      ...fields,
      // 编辑后重新进入审核或直接上线，同时清空历史驳回原因
      status: env.REQUIRE_REVIEW ? 'pending' : 'open',
      rejectReason: null,
      ...(images ? { images: { deleteMany: {}, create: buildImageCreate(images) } } : {}),
    },
    select: DETAIL_SELECT,
  });

  return toItemDto(updated, user);
}

/** 标记已找回 / 已认领：仅作者本人，且必须是进行中 */
export async function resolveItem(itemId, user) {
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: { id: true, userId: true, status: true },
  });

  if (!item) throw ApiError.notFound('帖子不存在或已被删除');
  if (item.userId !== user.id) throw ApiError.forbidden('只能标记自己发布的帖子');
  if (item.status === 'resolved') {
    throw new ApiError(CODE.CONFLICT, '该帖子已标记为已找回', 409);
  }
  if (item.status !== 'open') {
    throw new ApiError(CODE.CONFLICT, '只有进行中的帖子才能标记为已找回', 409);
  }

  const updated = await prisma.item.update({
    where: { id: itemId },
    data: { status: 'resolved', resolvedAt: new Date() },
    select: DETAIL_SELECT,
  });

  return toItemDto(updated, user);
}

/** 删除帖子：仅作者本人；图片与举报记录随外键级联删除 */
export async function deleteItem(itemId, user) {
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: { id: true, userId: true },
  });

  if (!item) throw ApiError.notFound('帖子不存在或已被删除');
  if (item.userId !== user.id) throw ApiError.forbidden('只能删除自己发布的帖子');

  await prisma.item.delete({ where: { id: itemId } });
}

/** 我的发布：包含全部状态 */
export async function listMyItems(userId, query) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 12;

  const where = { userId };
  if (query.status) where.status = query.status;
  if (query.type) where.type = query.type;

  const [total, rows] = await prisma.$transaction([
    prisma.item.count({ where }),
    prisma.item.findMany({
      where,
      select: DETAIL_SELECT,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    list: rows.map((row) => toItemDto(row, { id: userId, role: 'student' })),
    pagination: buildPagination(page, pageSize, total),
  };
}

/** 举报：同一用户对同一帖子只能举报一次（数据库唯一约束兜底） */
export async function createReport(itemId, reporterId, reason) {
  const item = await prisma.item.findUnique({ where: { id: itemId }, select: { id: true } });
  if (!item) throw ApiError.notFound('帖子不存在或已被删除');

  const existing = await prisma.report.findUnique({
    where: { itemId_reporterId: { itemId, reporterId } },
    select: { id: true },
  });
  if (existing) throw ApiError.conflict('你已举报过该帖子，请等待管理员处理');

  try {
    await prisma.report.create({ data: { itemId, reporterId, reason } });
  } catch (error) {
    // 并发下两个请求都没查到重复记录时，由唯一索引收敛
    if (error.code === 'P2002') {
      throw ApiError.conflict('你已举报过该帖子，请等待管理员处理');
    }
    throw error;
  }

  return { itemId, reason };
}
