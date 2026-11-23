import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { api } from './helpers/request.js';
import { prisma, resetDatabase } from './helpers/db.js';
import { createCategory, createItemRecord, createUser } from './helpers/fixtures.js';
import { bearer, loginAs } from './helpers/session.js';

let admin;
let adminToken;
let author;
let category;

beforeEach(async () => {
  await resetDatabase();
  admin = await createUser({ studentNo: '20240901', name: '管理员', role: 'admin' });
  author = await createUser({ studentNo: '20240910', name: '张三' });
  category = await createCategory({ name: '电子产品' });
  adminToken = await loginAs('20240901');
});

afterAll(async () => {
  await prisma.$disconnect();
});

const makeItem = (overrides = {}) =>
  createItemRecord({ userId: author.id, categoryId: category.id, ...overrides });

describe('GET /api/admin/items', () => {
  it('返回全部状态，并带联系方式、作者学号与举报数', async () => {
    await makeItem({ status: 'pending', title: '待审的' });
    await makeItem({ status: 'open', title: '进行中的' });
    await makeItem({ status: 'offline', title: '已下架的' });

    const response = await api().get('/api/admin/items').set(bearer(adminToken));

    expect(response.status).toBe(200);
    expect(response.body.data.pagination.total).toBe(3);

    const first = response.body.data.list[0];
    expect(first).toHaveProperty('contactValue');
    expect(first).toHaveProperty('rejectReason');
    expect(first.user.studentNo).toBe('20240910');
    expect(first._count.reports).toBe(0);
  });

  it('按状态筛选', async () => {
    await makeItem({ status: 'pending' });
    await makeItem({ status: 'open' });

    const response = await api().get('/api/admin/items?status=pending').set(bearer(adminToken));

    expect(response.body.data.pagination.total).toBe(1);
    expect(response.body.data.list[0].status).toBe('pending');
  });

  it('按关键词筛选（命中标题 / 作者学号）', async () => {
    await makeItem({ title: '丢了黑色雨伞' });
    await makeItem({ title: '捡到钥匙' });

    const byTitle = await api()
      .get(`/api/admin/items?keyword=${encodeURIComponent('雨伞')}`)
      .set(bearer(adminToken));
    expect(byTitle.body.data.pagination.total).toBe(1);

    const byStudentNo = await api()
      .get('/api/admin/items?keyword=20240910')
      .set(bearer(adminToken));
    expect(byStudentNo.body.data.pagination.total).toBe(2);
  });

  it('非法状态 → 400', async () => {
    const response = await api().get('/api/admin/items?status=nope').set(bearer(adminToken));
    expect(response.status).toBe(400);
  });
});

describe('帖子状态流转', () => {
  it('pending → 审核通过 → open', async () => {
    const item = await makeItem({ status: 'pending' });

    const response = await api()
      .post(`/api/admin/items/${item.id}/approve`)
      .set(bearer(adminToken));

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('open');
  });

  it('已上线的帖子不能再审核通过 → 409', async () => {
    const item = await makeItem({ status: 'open' });

    const response = await api()
      .post(`/api/admin/items/${item.id}/approve`)
      .set(bearer(adminToken));

    expect(response.status).toBe(409);
    expect(response.body.message).toContain('不能执行');
  });

  it('驳回必须填原因（缺原因 → 400，原因为空 → 400）', async () => {
    const item = await makeItem({ status: 'pending' });

    const missing = await api().post(`/api/admin/items/${item.id}/reject`).set(bearer(adminToken));
    expect(missing.status).toBe(400);

    const blank = await api()
      .post(`/api/admin/items/${item.id}/reject`)
      .set(bearer(adminToken))
      .send({ reason: ' ' });
    expect(blank.status).toBe(400);
  });

  it('驳回成功后状态与原因都落库', async () => {
    const item = await makeItem({ status: 'pending' });

    const response = await api()
      .post(`/api/admin/items/${item.id}/reject`)
      .set(bearer(adminToken))
      .send({ reason: '图片与描述不符' });

    expect(response.body.data.status).toBe('rejected');
    expect(response.body.data.rejectReason).toBe('图片与描述不符');
  });

  it('下架 → 恢复：恢复后清空驳回原因', async () => {
    const item = await makeItem({ status: 'open' });

    await api().post(`/api/admin/items/${item.id}/offline`).set(bearer(adminToken));
    await prisma.item.update({ where: { id: item.id }, data: { rejectReason: '旧原因' } });

    const restored = await api()
      .post(`/api/admin/items/${item.id}/restore`)
      .set(bearer(adminToken));

    expect(restored.body.data.status).toBe('open');
    expect(restored.body.data.rejectReason).toBeNull();
  });

  it('下架中的帖子不能重复下架 → 409', async () => {
    const item = await makeItem({ status: 'offline' });

    const response = await api()
      .post(`/api/admin/items/${item.id}/offline`)
      .set(bearer(adminToken));

    expect(response.status).toBe(409);
  });

  it('删除任意状态的帖子', async () => {
    const item = await makeItem({ status: 'resolved' });

    const response = await api().delete(`/api/admin/items/${item.id}`).set(bearer(adminToken));

    expect(response.status).toBe(200);
    expect(await prisma.item.count({ where: { id: item.id } })).toBe(0);
  });

  it('操作不存在的帖子 → 404', async () => {
    const response = await api()
      .post('/api/admin/items/999999/approve')
      .set(bearer(adminToken));

    expect(response.status).toBe(404);
  });
});

describe('批量操作', () => {
  it('混合状态时逐条处理，返回成功与失败明细', async () => {
    const pending = await makeItem({ status: 'pending' });
    const openItem = await makeItem({ status: 'open' });

    const response = await api()
      .post('/api/admin/items/batch')
      .set(bearer(adminToken))
      .send({ action: 'approve', ids: [pending.id, openItem.id] });

    expect(response.status).toBe(200);
    expect(response.body.data.succeeded).toBe(1);
    expect(response.body.data.failed).toBe(1);
    expect(response.body.data.failedItems[0].id).toBe(openItem.id);
    expect(response.body.data.failedItems[0].message).toContain('不能执行');
  });

  it('批量驳回必须填原因 → 400', async () => {
    const item = await makeItem({ status: 'pending' });

    const response = await api()
      .post('/api/admin/items/batch')
      .set(bearer(adminToken))
      .send({ action: 'reject', ids: [item.id] });

    expect(response.status).toBe(400);
  });

  it('批量删除', async () => {
    const a = await makeItem({ status: 'open' });
    const b = await makeItem({ status: 'offline' });

    const response = await api()
      .post('/api/admin/items/batch')
      .set(bearer(adminToken))
      .send({ action: 'delete', ids: [a.id, b.id] });

    expect(response.body.data.succeeded).toBe(2);
    expect(await prisma.item.count()).toBe(0);
  });

  it('ids 为空 → 400，超过 100 条 → 400', async () => {
    const empty = await api()
      .post('/api/admin/items/batch')
      .set(bearer(adminToken))
      .send({ action: 'offline', ids: [] });
    expect(empty.status).toBe(400);

    const tooMany = await api()
      .post('/api/admin/items/batch')
      .set(bearer(adminToken))
      .send({ action: 'offline', ids: Array.from({ length: 101 }, (_, i) => i + 1) });
    expect(tooMany.status).toBe(400);
  });
});

describe('后台写操作写入审计日志', () => {
  it('审核通过会留下 admin / action / target 与前后状态', async () => {
    const item = await makeItem({ status: 'pending', title: '待审核的伞' });

    await api().post(`/api/admin/items/${item.id}/approve`).set(bearer(adminToken));

    const log = await prisma.auditLog.findFirst({ where: { action: 'item.approve' } });
    expect(log).not.toBeNull();
    expect(log.adminId).toBe(admin.id);
    expect(log.targetType).toBe('item');
    expect(log.targetId).toBe(item.id);
    expect(log.detail).toEqual({ from: 'pending', to: 'open' });
  });

  it('驳回会记录状态变化，但不把自由文本理由写入审计日志', async () => {
    const item = await makeItem({ status: 'pending' });

    await api()
      .post(`/api/admin/items/${item.id}/reject`)
      .set(bearer(adminToken))
      .send({ reason: '内容不实' });

    const log = await prisma.auditLog.findFirst({ where: { action: 'item.reject' } });
    expect(log.detail).toEqual({ from: 'pending', to: 'rejected' });
  });

  it('删除会记录删除前状态，不把自由文本标题写入审计日志', async () => {
    const item = await makeItem({ status: 'resolved', title: '已找回的钥匙' });

    await api().delete(`/api/admin/items/${item.id}`).set(bearer(adminToken));

    const log = await prisma.auditLog.findFirst({ where: { action: 'item.delete' } });
    expect(log.detail).toEqual({ status: 'resolved' });
  });
});
