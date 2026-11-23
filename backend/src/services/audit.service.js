// 管理操作审计日志
//
// 约定：所有 admin 写操作都必须调用 logAudit，记录「谁、对什么、做了什么」。
// detail 里不要放密码等敏感信息（例如重置密码只记录发生了，不记录新密码）。
import { prisma } from '../db/prisma.js';

const SAFE_DETAIL_KEYS = new Set([
  'from', 'to', 'days', 'cutoff', 'archived', 'mediaIds', 'itemId', 'targetItemId',
  'count', 'threshold', 'status', 'publicAllowed', 'visibility', 'sortOrder', 'enabled',
  'imported', 'total', 'duplicates', 'skipped', 'invalid', 'itemStatusBefore',
]);

function safeAuditDetail(value, depth = 0) {
  if (depth > 3 || value == null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.slice(0, 100).map((entry) => safeAuditDetail(entry, depth + 1));
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => SAFE_DETAIL_KEYS.has(key))
      .map(([key, entry]) => [key, safeAuditDetail(entry, depth + 1)]),
  );
}

/**
 * 写一条审计日志。
 * @param {object} params
 * @param {number|null} params.adminId 操作人；null 表示系统任务（如自动归档）
 * @param {string} params.action 动作标识，如 item.approve / user.ban / system.archive
 * @param {string} params.targetType item / user / report / category / whitelist
 * @param {number|null} params.targetId 目标 id
 * @param {object|null} params.detail 结构化明细
 * @param {object} [client] Prisma 客户端（事务内可传入 tx）
 */
export async function logAudit(
  { adminId, action, targetType, targetId = null, detail = null },
  client = prisma,
) {
  await client.auditLog.create({
    data: { adminId, action, targetType, targetId, detail: safeAuditDetail(detail) },
  });
}

/** 审计日志列表（按时间倒序） */
export async function listAuditLogs({ page = 1, pageSize = 20, action, targetType }) {
  const where = {};
  if (action) where.action = action;
  if (targetType) where.targetType = targetType;

  const [total, rows] = await prisma.$transaction([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        action: true,
        targetType: true,
        targetId: true,
        detail: true,
        createdAt: true,
        admin: { select: { id: true, name: true, studentNo: true } },
      },
    }),
  ]);

  return {
    list: rows,
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  };
}
