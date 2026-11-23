import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { api } from './helpers/request.js';
import { prisma, resetDatabase } from './helpers/db.js';
import { createCategory, createItemRecord, createUser } from './helpers/fixtures.js';
import { bearer, loginAs } from './helpers/session.js';

let owner;
let other;
let ownerToken;
let otherToken;
let category;

beforeEach(async () => {
  await resetDatabase();
  category = await createCategory({ name: '证件卡类', sortOrder: 1 });
  owner = await createUser({ studentNo: '20240601', name: '作者' });
  other = await createUser({ studentNo: '20240602', name: '路人' });
  ownerToken = await loginAs('20240601');
  otherToken = await loginAs('20240602');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /api/me/items', () => {
  it('未登录 → 401', async () => {
    const res = await api().get('/api/me/items');
    expect(res.status).toBe(401);
  });

  it('返回自己的全部状态，不包含他人的帖子', async () => {
    await createItemRecord({ userId: owner.id, categoryId: category.id, status: 'open' });
    await createItemRecord({ userId: owner.id, categoryId: category.id, status: 'pending' });
    await createItemRecord({ userId: owner.id, categoryId: category.id, status: 'rejected' });
    await createItemRecord({ userId: owner.id, categoryId: category.id, status: 'offline' });
    await createItemRecord({ userId: other.id, categoryId: category.id, status: 'open' });

    const res = await api().get('/api/me/items').set(bearer(ownerToken));

    expect(res.status).toBe(200);
    expect(res.body.data.pagination.total).toBe(4);
    expect(res.body.data.list.every((item) => item.user.id === owner.id)).toBe(true);
    expect(res.body.data.list.map((item) => item.status).sort()).toEqual([
      'offline',
      'open',
      'pending',
      'rejected',
    ]);
  });

  it('按状态筛选', async () => {
    await createItemRecord({ userId: owner.id, categoryId: category.id, status: 'open' });
    await createItemRecord({ userId: owner.id, categoryId: category.id, status: 'rejected' });

    const res = await api().get('/api/me/items?status=rejected').set(bearer(ownerToken));

    expect(res.body.data.list).toHaveLength(1);
    expect(res.body.data.list[0].status).toBe('rejected');
  });

  it('自己的帖子在「我的发布」里能看到联系方式与驳回原因', async () => {
    const item = await createItemRecord({
      userId: owner.id,
      categoryId: category.id,
      status: 'rejected',
      contactValue: 'wx_mine_001',
    });
    await prisma.item.update({ where: { id: item.id }, data: { rejectReason: '描述太模糊' } });

    const res = await api().get('/api/me/items').set(bearer(ownerToken));

    expect(res.body.data.list[0].contactValue).toBe('wx_mine_001');
    expect(res.body.data.list[0].rejectReason).toBe('描述太模糊');
  });

  it('状态取值非法 → 400', async () => {
    const res = await api().get('/api/me/items?status=unknown').set(bearer(ownerToken));
    expect(res.status).toBe(400);
  });
});

describe('POST /api/items/:id/report', () => {
  it('举报成功返回 201', async () => {
    const item = await createItemRecord({ userId: owner.id, categoryId: category.id });

    const res = await api()
      .post(`/api/items/${item.id}/report`)
      .set(bearer(otherToken))
      .send({ reason: '信息与实际不符' });

    expect(res.status).toBe(201);
    expect(res.body.code).toBe(0);

    const saved = await prisma.report.findFirst({ where: { itemId: item.id } });
    expect(saved.reporterId).toBe(other.id);
    expect(saved.status).toBe('pending');
  });

  it('同一用户重复举报 → 409', async () => {
    const item = await createItemRecord({ userId: owner.id, categoryId: category.id });

    await api()
      .post(`/api/items/${item.id}/report`)
      .set(bearer(otherToken))
      .send({ reason: '第一个理由' });

    const second = await api()
      .post(`/api/items/${item.id}/report`)
      .set(bearer(otherToken))
      .send({ reason: '第二个理由' });

    expect(second.status).toBe(409);
    expect(second.body.message).toContain('已举报过');
    expect(await prisma.report.count({ where: { itemId: item.id } })).toBe(1);
  });

  it('不同用户可以分别举报同一帖子', async () => {
    const third = await createUser({ studentNo: '20240603', name: '第三人' });
    const thirdToken = await loginAs('20240603');
    const item = await createItemRecord({ userId: owner.id, categoryId: category.id });

    await api().post(`/api/items/${item.id}/report`).set(bearer(otherToken)).send({ reason: '理由一' });
    const res = await api()
      .post(`/api/items/${item.id}/report`)
      .set(bearer(thirdToken))
      .send({ reason: '理由二' });

    expect(res.status).toBe(201);
    expect(await prisma.report.count({ where: { itemId: item.id } })).toBe(2);
    expect(third.id).toBeGreaterThan(0);
  });

  it('举报理由过短 → 400', async () => {
    const item = await createItemRecord({ userId: owner.id, categoryId: category.id });

    const res = await api()
      .post(`/api/items/${item.id}/report`)
      .set(bearer(otherToken))
      .send({ reason: '假' });

    expect(res.status).toBe(400);
    expect(res.body.data.some((e) => e.field === 'reason')).toBe(true);
  });

  it('举报不存在的帖子 → 404', async () => {
    const res = await api()
      .post('/api/items/999999/report')
      .set(bearer(otherToken))
      .send({ reason: '不存在的帖子' });

    expect(res.status).toBe(404);
  });

  it('未登录举报 → 401', async () => {
    const item = await createItemRecord({ userId: owner.id, categoryId: category.id });

    const res = await api().post(`/api/items/${item.id}/report`).send({ reason: '匿名举报' });

    expect(res.status).toBe(401);
  });
});

describe('GET /api/categories', () => {
  it('公开可访问，按 sortOrder 排序，不返回停用的分类', async () => {
    await createCategory({ name: '书籍文具', sortOrder: 3 });
    await createCategory({ name: '电子产品', sortOrder: 2 });
    await createCategory({ name: '已停用', sortOrder: 4, enabled: false });

    const res = await api().get('/api/categories');

    expect(res.status).toBe(200);
    const names = res.body.data.map((item) => item.name);
    expect(names).toEqual(['证件卡类', '电子产品', '书籍文具']);
    expect(names).not.toContain('已停用');
  });

  it('无需登录', async () => {
    const res = await api().get('/api/categories');
    expect(res.status).toBe(200);
  });
});
