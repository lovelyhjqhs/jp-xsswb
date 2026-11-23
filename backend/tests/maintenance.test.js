// 定时任务：90 天未处理的 open 帖子自动归档
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { prisma, resetDatabase } from './helpers/db.js';
import { createCategory, createItemRecord, createUser } from './helpers/fixtures.js';
import { archiveStaleItems, ARCHIVE_AFTER_DAYS } from '../src/services/maintenance.service.js';
import { clearExpiredGuestCredentials, pruneAuditLogs } from '../src/services/maintenance.service.js';
import { api } from './helpers/request.js';

let author;
let category;

const DAY_MS = 24 * 60 * 60 * 1000;

beforeEach(async () => {
  await resetDatabase();
  author = await createUser({ studentNo: '20240910', name: '张三' });
  category = await createCategory({ name: '电子产品' });
});

afterAll(async () => {
  await prisma.$disconnect();
});

/** 造一条指定天数前发布的帖子 */
async function createAgedItem(daysAgo, status = 'open') {
  const createdAt = new Date(Date.now() - daysAgo * DAY_MS);
  return createItemRecord({
    userId: author.id,
    categoryId: category.id,
    status,
    title: `${daysAgo} 天前的帖子`,
    createdAt,
  });
}

describe('archiveStaleItems', () => {
  it('默认阈值为 90 天', () => {
    expect(ARCHIVE_AFTER_DAYS).toBe(90);
  });

  it('把超过 90 天仍为 open 的帖子改成 offline', async () => {
    const stale = await createAgedItem(120);
    const fresh = await createAgedItem(10);

    const result = await archiveStaleItems();

    expect(result.matched).toBe(1);
    expect(result.archived).toBe(1);

    const archived = await prisma.item.findUnique({ where: { id: stale.id } });
    const untouched = await prisma.item.findUnique({ where: { id: fresh.id } });
    expect(archived.status).toBe('offline');
    expect(untouched.status).toBe('open');
  });

  it('只动 open：已找回、待审核、已下架的都不碰', async () => {
    const resolved = await createAgedItem(200, 'resolved');
    const pending = await createAgedItem(200, 'pending');
    const offline = await createAgedItem(200, 'offline');
    await createAgedItem(200, 'open');

    const result = await archiveStaleItems();

    expect(result.archived).toBe(1);
    expect((await prisma.item.findUnique({ where: { id: resolved.id } })).status).toBe('resolved');
    expect((await prisma.item.findUnique({ where: { id: pending.id } })).status).toBe('pending');
    expect((await prisma.item.findUnique({ where: { id: offline.id } })).status).toBe('offline');
  });

  it('dry-run 只统计不修改', async () => {
    const stale = await createAgedItem(120);

    const result = await archiveStaleItems({ dryRun: true });

    expect(result.matched).toBe(1);
    expect(result.archived).toBe(0);
    expect((await prisma.item.findUnique({ where: { id: stale.id } })).status).toBe('open');
  });

  it('支持自定义天数', async () => {
    await createAgedItem(40);
    await createAgedItem(70);

    const result = await archiveStaleItems({ days: 60 });

    expect(result.archived).toBe(1);
  });

  it('没有命中时不会写审计日志', async () => {
    await archiveStaleItems();

    expect(await prisma.auditLog.count()).toBe(0);
  });

  it('归档会写一条「系统任务」审计日志（没有操作人）', async () => {
    await createAgedItem(120);

    await archiveStaleItems();

    const log = await prisma.auditLog.findFirst({ where: { action: 'system.archive' } });
    expect(log).not.toBeNull();
    expect(log.adminId).toBeNull();
    expect(log.targetType).toBe('item');
    expect(log.detail.archived).toBe(1);
  });

  it('天数不合法直接抛错', async () => {
    await expect(archiveStaleItems({ days: 0 })).rejects.toThrow('正整数');
    await expect(archiveStaleItems({ days: 1.5 })).rejects.toThrow('正整数');
  });

  it('返回命中样本，便于人工核对', async () => {
    const stale = await createAgedItem(120);

    const result = await archiveStaleItems({ dryRun: true });

    expect(result.sample.map((item) => item.id)).toContain(stale.id);
  });
});

describe('隐私数据保留', () => {
  it('查询凭证过期时清除凭证和幂等哈希，但保留投稿用于审核记录', async () => {
    const response = await api().post('/api/public/canteen-feedback')
      .set('Idempotency-Key', 'maintenance-expiry-key-001')
      .field('submitMode', 'anonymous')
      .field('content', '过期凭证清理测试内容');
    expect(response.status).toBe(201);
    const queryNo = response.body.data.queryNo;
    await prisma.canteenFeedback.update({
      where: { queryNo },
      data: { queryExpiresAt: new Date(Date.now() - 1000) },
    });

    const result = await clearExpiredGuestCredentials();
    const saved = await prisma.canteenFeedback.findUnique({ where: { queryNo } });
    expect(result.cleared).toBe(1);
    expect(saved).toEqual(expect.objectContaining({ queryCredentialHash: null, idempotencyKeyHash: null, contentFingerprint: null }));
    expect((await api().post('/api/public/query/status').send({ queryNo, queryCredential: response.body.data.queryCredential })).status).toBe(404);
  });

  it('超过保留期的操作日志删除，清理动作只留下安全摘要', async () => {
    await prisma.auditLog.create({ data: { action: 'test.old', targetType: 'test', createdAt: new Date(Date.now() - 40 * DAY_MS) } });
    const result = await pruneAuditLogs({ days: 30 });
    expect(result.deleted).toBe(1);
    const retained = await prisma.auditLog.findFirst({ where: { action: 'system.audit_retention' } });
    expect(retained.detail).toEqual({ days: 30, count: 1 });
  });
});
