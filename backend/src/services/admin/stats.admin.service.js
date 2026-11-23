// 数据概览：核心指标 + 近 30 天发布趋势
import { prisma } from '../../db/prisma.js';
import { startOfDayCN } from '../../utils/time.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/** 把时间转成东八区的 YYYY-MM-DD，用于按天分桶 */
function toDayKey(date) {
  return new Date(date.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

/**
 * 概览指标。
 * 找回率 = 已找回 / (进行中 + 已找回)，排除待审核/已驳回/已下架，
 * 因为这些帖子还没进入正常流转，算进去会低估真实的找回比例。
 */
export async function getOverviewStats() {
  const now = new Date();
  const weekStart = startOfDayCN(new Date(now.getTime() - 6 * DAY_MS));

  const [totalItems, pendingItems, weeklyNew, openItems, resolvedItems, totalUsers, bannedUsers, pendingCanteen, pendingMailbox, pendingInquiries, pendingPublicItems, recentOperations] =
    await Promise.all([
      prisma.item.count(),
      prisma.item.count({ where: { status: 'pending' } }),
      prisma.item.count({ where: { createdAt: { gte: weekStart } } }),
      prisma.item.count({ where: { status: 'open' } }),
      prisma.item.count({ where: { status: 'resolved' } }),
      prisma.user.count(),
      prisma.user.count({ where: { status: 'banned' } }),
      prisma.canteenFeedback.count({ where: { status: 'pending_review', deletedAt: null } }),
      prisma.mailboxMessage.count({ where: { status: { in: ['pending_review', 'processing'] }, deletedAt: null } }),
      prisma.lostFoundInquiry.count({ where: { status: { in: ['pending_review', 'processing'] }, deletedAt: null } }),
      prisma.item.count({ where: { status: 'pending', deletedAt: null } }),
      prisma.auditLog.findMany({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 8, select: { id: true, action: true, targetType: true, targetId: true, createdAt: true, admin: { select: { id: true, name: true, studentNo: true } } } }),
    ]);

  const circulationBase = openItems + resolvedItems;

  return {
    totalItems,
    pendingItems,
    weeklyNew,
    openItems,
    resolvedItems,
    resolvedRate: circulationBase === 0 ? 0 : Number((resolvedItems / circulationBase).toFixed(4)),
    totalUsers,
    bannedUsers,
    pendingReports: await prisma.report.count({ where: { status: 'pending' } }),
    pendingSubmissions: pendingCanteen + pendingMailbox + pendingInquiries + pendingPublicItems,
    pendingCanteen,
    pendingMailbox,
    pendingInquiries,
    recentOperations,
  };
}

/** 近 N 天每日发布量（含今天），没有数据的那天补 0 */
export async function getPublishTrend(days = 30) {
  const start = startOfDayCN(new Date(Date.now() - (days - 1) * DAY_MS));

  const rows = await prisma.item.findMany({
    where: { createdAt: { gte: start } },
    select: { createdAt: true },
  });

  const buckets = new Map();
  for (let i = 0; i < days; i += 1) {
    buckets.set(toDayKey(new Date(start.getTime() + i * DAY_MS)), 0);
  }
  for (const row of rows) {
    const key = toDayKey(row.createdAt);
    if (buckets.has(key)) buckets.set(key, buckets.get(key) + 1);
  }

  return [...buckets.entries()].map(([date, count]) => ({ date, count }));
}
