import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { api } from './helpers/request.js';
import { prisma, resetDatabase } from './helpers/db.js';
import { createCategory, createItemRecord, createUser } from './helpers/fixtures.js';
import { bearer, loginAs } from './helpers/session.js';

let owner;
let token;
let categoryA;
let categoryB;
let openItem;
let resolvedItem;

/** 造一批状态各异的帖子 */
async function seedItems() {
  const base = Date.now();
  const at = (minutesAgo) => new Date(base - minutesAgo * 60 * 1000);

  openItem = await createItemRecord({
    userId: owner.id,
    categoryId: categoryA.id,
    title: '丢了黑色雨伞',
    type: 'lost',
    status: 'open',
    createdAt: at(30),
  });

  resolvedItem = await createItemRecord({
    userId: owner.id,
    categoryId: categoryB.id,
    title: '捡到一把钥匙',
    type: 'found',
    status: 'resolved',
    createdAt: at(10),
  });

  await createItemRecord({
    userId: owner.id,
    categoryId: categoryA.id,
    title: '待审核的帖子',
    status: 'pending',
    createdAt: at(5),
  });
  await createItemRecord({
    userId: owner.id,
    categoryId: categoryA.id,
    title: '被驳回的帖子',
    status: 'rejected',
    createdAt: at(3),
  });
  await createItemRecord({
    userId: owner.id,
    categoryId: categoryA.id,
    title: '被下架的帖子',
    status: 'offline',
    createdAt: at(1),
  });
}

beforeEach(async () => {
  await resetDatabase();
  categoryA = await createCategory({ name: '生活用品', sortOrder: 1 });
  categoryB = await createCategory({ name: '钥匙', sortOrder: 2 });
  owner = await createUser({ studentNo: '20240301', name: '发布者' });
  token = await loginAs('20240301');
  await seedItems();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /api/items —— 可见性', () => {
  it('游客只能看到 open 和 resolved', async () => {
    const res = await api().get('/api/items');

    expect(res.status).toBe(200);
    const titles = res.body.data.list.map((item) => item.title);
    expect(titles).toEqual(['捡到一把钥匙', '丢了黑色雨伞']);
    expect(titles).not.toContain('待审核的帖子');
    expect(titles).not.toContain('被下架的帖子');
    expect(res.body.data.pagination.total).toBe(2);
  });

  it('列表按创建时间倒序', async () => {
    const res = await api().get('/api/items');
    const dates = res.body.data.list.map((item) => new Date(item.createdAt).getTime());

    expect(dates[0]).toBeGreaterThan(dates[1]);
  });

  it('登录用户看到的列表内容与游客一致（列表不因登录而多返回数据）', async () => {
    const guest = await api().get('/api/items');
    const authed = await api().get('/api/items').set(bearer(token));

    expect(authed.body.data.list.map((i) => i.id)).toEqual(guest.body.data.list.map((i) => i.id));
  });
});

describe('GET /api/items —— 筛选', () => {
  it('按 type 过滤', async () => {
    const res = await api().get('/api/items?type=found');

    expect(res.body.data.list).toHaveLength(1);
    expect(res.body.data.list[0].type).toBe('found');
  });

  it('按 categoryId 过滤', async () => {
    const res = await api().get(`/api/items?categoryId=${categoryB.id}`);

    expect(res.body.data.list).toHaveLength(1);
    expect(res.body.data.list[0].category.id).toBe(categoryB.id);
  });

  it('按 status 过滤（resolved）', async () => {
    const res = await api().get('/api/items?status=resolved');

    expect(res.body.data.list).toHaveLength(1);
    expect(res.body.data.list[0].id).toBe(resolvedItem.id);
  });

  it('status 传非公开状态 → 400', async () => {
    const res = await api().get('/api/items?status=pending');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(40001);
  });

  it('keyword 命中标题', async () => {
    const res = await api().get(`/api/items?keyword=${encodeURIComponent('雨伞')}`);

    expect(res.body.data.list).toHaveLength(1);
    expect(res.body.data.list[0].id).toBe(openItem.id);
  });

  it('keyword 命中描述', async () => {
    const res = await api().get(`/api/items?keyword=${encodeURIComponent('用于测试的帖子描述')}`);

    expect(res.body.data.pagination.total).toBeGreaterThan(0);
  });

  it('keyword 命中地点', async () => {
    await prisma.item.create({
      data: {
        userId: owner.id,
        categoryId: categoryA.id,
        type: 'lost',
        title: '丢了一个水杯',
        description: '杯子是蓝色的，有贴纸',
        location: '体育馆东门',
        happenedAt: new Date(Date.now() - 3600 * 1000),
        contactType: 'wechat',
        contactValue: 'wx_place',
        status: 'open',
      },
    });

    const res = await api().get(`/api/items?keyword=${encodeURIComponent('东门')}`);

    expect(res.body.data.list).toHaveLength(1);
    expect(res.body.data.list[0].location).toContain('东门');
  });

  it('多个条件组合生效', async () => {
    const res = await api().get(`/api/items?type=lost&categoryId=${categoryA.id}`);

    expect(res.body.data.list).toHaveLength(1);
    expect(res.body.data.list[0].id).toBe(openItem.id);
  });
});

describe('GET /api/items —— 分页', () => {
  it('page / pageSize / total / totalPages 正确', async () => {
    const first = await api().get('/api/items?page=1&pageSize=1');
    const second = await api().get('/api/items?page=2&pageSize=1');

    expect(first.body.data.list).toHaveLength(1);
    expect(first.body.data.pagination).toEqual({
      page: 1,
      pageSize: 1,
      total: 2,
      totalPages: 2,
    });
    expect(second.body.data.list[0].id).toBe(openItem.id);
  });

  it('超出范围返回空列表而不是报错', async () => {
    const res = await api().get('/api/items?page=99&pageSize=10');

    expect(res.status).toBe(200);
    expect(res.body.data.list).toEqual([]);
    expect(res.body.data.pagination.total).toBe(2);
  });

  it('page=0 → 400', async () => {
    const res = await api().get('/api/items?page=0');
    expect(res.status).toBe(400);
  });

  it('pageSize 超过 50 → 400', async () => {
    const res = await api().get('/api/items?pageSize=51');
    expect(res.status).toBe(400);
  });
});

describe('GET /api/items —— 联系方式不外泄', () => {
  it('游客拿到的列表项没有 contactType / contactValue', async () => {
    const res = await api().get('/api/items');

    for (const item of res.body.data.list) {
      expect(item).not.toHaveProperty('contactValue');
      expect(item).not.toHaveProperty('contactType');
      expect(item.hasContact).toBe(true);
    }
  });

  it('登录用户拿到的列表项同样没有联系方式（只有详情才返回）', async () => {
    const res = await api().get('/api/items').set(bearer(token));

    for (const item of res.body.data.list) {
      expect(item).not.toHaveProperty('contactValue');
    }
  });

  it('响应体里完全搜不到联系方式原文', async () => {
    const res = await api().get('/api/items');
    expect(JSON.stringify(res.body)).not.toContain('wx_seed_001');
  });
});
