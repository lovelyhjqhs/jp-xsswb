// 运维任务：把长期没人处理的帖子自动归档
//
// 规则：状态仍是 open 且发布超过 N 天（默认 90）→ 改为 offline。
// 已找回（resolved）的不动，待审核/已驳回的也不动（它们本来就不在前台展示）。
import { prisma } from '../db/prisma.js';
import { env } from '../config/env.js';
import { logAudit } from './audit.service.js';

export const ARCHIVE_AFTER_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 归档过期帖子。
 * @param {object} [options]
 * @param {number} [options.days] 超过多少天算过期
 * @param {boolean} [options.dryRun] 只统计不修改
 * @param {Date} [options.now] 注入当前时间，便于测试
 */
export async function archiveStaleItems({ days = ARCHIVE_AFTER_DAYS, dryRun = false, now = new Date() } = {}) {
  if (!Number.isInteger(days) || days < 1) {
    throw new Error('days 必须是正整数');
  }

  const cutoff = new Date(now.getTime() - days * DAY_MS);
  const where = { status: 'open', createdAt: { lt: cutoff } };

  const [matched, sample] = await Promise.all([
    prisma.item.count({ where }),
    prisma.item.findMany({
      where,
      select: { id: true, title: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
      take: 20,
    }),
  ]);

  if (dryRun || matched === 0) {
    return { days, cutoff, dryRun, matched, archived: 0, sample };
  }

  const { count } = await prisma.item.updateMany({ where, data: { status: 'offline' } });

  // 系统任务的审计日志没有操作人（adminId 为空），前端会显示为「系统任务」
  await logAudit({
    adminId: null,
    action: 'system.archive',
    targetType: 'item',
    targetId: null,
    detail: { days, cutoff: cutoff.toISOString(), archived: count },
  });

  return { days, cutoff, dryRun, matched, archived: count, sample };
}

/** Clear expired guest query/idempotency hashes while retaining moderation records. */
export async function clearExpiredGuestCredentials({ now = new Date() } = {}) {
  const models = [prisma.item, prisma.canteenFeedback, prisma.mailboxMessage, prisma.lostFoundInquiry];
  const results = await Promise.all(models.map((model) => model.updateMany({
    where: { queryExpiresAt: { lt: now }, OR: [{ queryCredentialHash: { not: null } }, { idempotencyKeyHash: { not: null } }, { contentFingerprint: { not: null } }] },
    data: { queryCredentialHash: null, idempotencyKeyHash: null, contentFingerprint: null },
  })));
  const cleared = results.reduce((total, result) => total + result.count, 0);
  if (cleared) await logAudit({ adminId: null, action: 'system.expire_guest_credentials', targetType: 'guest_submissions', detail: { count: cleared } });
  return { cleared };
}

/** Retain operational audit events for a configurable, bounded period. */
export async function pruneAuditLogs({ days = env.AUDIT_LOG_RETENTION_DAYS, now = new Date() } = {}) {
  if (!Number.isInteger(days) || days < 30 || days > 3650) throw new Error('日志保留天数必须在 30 至 3650 天之间');
  const cutoff = new Date(now.getTime() - days * DAY_MS);
  const { count } = await prisma.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
  if (count) await logAudit({ adminId: null, action: 'system.audit_retention', targetType: 'audit_log', detail: { days, count } });
  return { days, cutoff, deleted: count };
}
