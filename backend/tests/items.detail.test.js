import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { api } from './helpers/request.js';
import { prisma, resetDatabase } from './helpers/db.js';
import { createCategory, createItemRecord, createUser } from './helpers/fixtures.js';
import { bearer, loginAs } from './helpers/session.js';

let owner;
let ownerToken;
let otherToken;
let category;

beforeEach(async () => {
  await resetDatabase();
  category = await createCategory({ name: '电子产品' });
  owner = await createUser({ studentNo: '20240401', name: '作者' });
  await createUser({ studentNo: '20240402', name: '路人' });
  ownerToken = await loginAs('20240401');
  otherToken = await loginAs('20240402');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /api/items/:id —— 联系方式可见性', () => {
  it('游客看不到联系方式，但能看到 hasContact 标记', async () => {
    const item = await createItemRecord({
      userId: owner.id,
      categoryId: category.id,
      contactType: 'wechat',
      contactValue: 'wx_secret_001',
    });

    const res = await api().get(`/api/items/${item.id}`);

    expect(res.status).toBe(200);
    expect(res.body.data).not.toHaveProperty('contactValue');
    expect(res.body.data).not.toHaveProperty('contactType');
    expect(res.body.data.hasContact).toBe(true);
    expect(JSON.stringify(res.body)).not.toContain('wx_secret_001');
  });

  it('游客看到的发布者姓名已脱敏', async () => {
    const item = await createItemRecord({ userId: owner.id, categoryId: category.id });

    const res = await api().get(`/api/items/${item.id}`);

    // 作者名为「作者」，脱敏后为「作*」
    expect(res.body.data.user.name).toBe('作*');
    expect(res.body.data.user.id).toBe(owner.id);
  });

  it('作者本人看到完整姓名', async () => {
    const item = await createItemRecord({ userId: owner.id, categoryId: category.id });

    const res = await api().get(`/api/items/${item.id}`).set(bearer(ownerToken));

    expect(res.body.data.user.name).toBe('作者');
  });

  it('登录用户（非作者）能看到联系方式', async () => {
    const item = await createItemRecord({
      userId: owner.id,
      categoryId: category.id,
      contactType: 'qq',
      contactValue: '123456789',
    });

    const res = await api().get(`/api/items/${item.id}`).set(bearer(otherToken));

    expect(res.body.data.contactType).toBe('qq');
    expect(res.body.data.contactValue).toBe('123456789');
  });

  it('作者本人能看到联系方式', async () => {
    const item = await createItemRecord({
      userId: owner.id,
      categoryId: category.id,
      contactType: 'phone',
      contactValue: '13800138000',
    });

    const res = await api().get(`/api/items/${item.id}`).set(bearer(ownerToken));

    expect(res.body.data.contactValue).toBe('13800138000');
  });

  it('拿无效 token 访问按游客处理，不返回联系方式', async () => {
    const item = await createItemRecord({
      userId: owner.id,
      categoryId: category.id,
      contactValue: 'wx_secret_002',
    });

    const res = await api()
      .get(`/api/items/${item.id}`)
      .set('Authorization', 'Bearer broken.token.value');

    expect(res.status).toBe(200);
    expect(res.body.data).not.toHaveProperty('contactValue');
  });
});

describe('GET /api/items/:id —— 浏览数', () => {
  it('每次访问浏览数 +1', async () => {
    const item = await createItemRecord({ userId: owner.id, categoryId: category.id });

    const first = await api().get(`/api/items/${item.id}`);
    const second = await api().get(`/api/items/${item.id}`);

    expect(first.body.data.viewCount).toBe(1);
    expect(second.body.data.viewCount).toBe(2);

    const saved = await prisma.item.findUnique({ where: { id: item.id } });
    expect(saved.viewCount).toBe(2);
  });
});

describe('GET /api/items/:id —— 非公开状态', () => {
  it('pending：游客 404，他人 404，作者可见', async () => {
    const item = await createItemRecord({
      userId: owner.id,
      categoryId: category.id,
      status: 'pending',
    });

    const guest = await api().get(`/api/items/${item.id}`);
    const stranger = await api().get(`/api/items/${item.id}`).set(bearer(otherToken));
    const author = await api().get(`/api/items/${item.id}`).set(bearer(ownerToken));

    expect(guest.status).toBe(404);
    expect(stranger.status).toBe(404);
    expect(author.status).toBe(200);
    expect(author.body.data.status).toBe('pending');
  });

  it('被驳回的帖子：作者能看到驳回原因，他人看不到', async () => {
    const item = await createItemRecord({
      userId: owner.id,
      categoryId: category.id,
      status: 'rejected',
    });
    await prisma.item.update({
      where: { id: item.id },
      data: { rejectReason: '图片与描述不符' },
    });

    const author = await api().get(`/api/items/${item.id}`).set(bearer(ownerToken));
    const stranger = await api().get(`/api/items/${item.id}`).set(bearer(otherToken));

    expect(author.body.data.rejectReason).toBe('图片与描述不符');
    expect(stranger.status).toBe(404);
  });

  it('管理员可以看到非公开帖子', async () => {
    await createUser({ studentNo: '20240409', role: 'admin' });
    const adminToken = await loginAs('20240409');
    const item = await createItemRecord({
      userId: owner.id,
      categoryId: category.id,
      status: 'offline',
    });

    const res = await api().get(`/api/items/${item.id}`).set(bearer(adminToken));

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('offline');
  });
});

describe('GET /api/items/:id —— 异常输入', () => {
  it('帖子不存在 → 404', async () => {
    const res = await api().get('/api/items/999999');

    expect(res.status).toBe(404);
    expect(res.body.code).toBe(40401);
  });

  it('id 不是数字 → 400', async () => {
    const res = await api().get('/api/items/abc');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(40001);
  });
});
