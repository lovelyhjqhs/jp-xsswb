// REQUIRE_REVIEW=true（先审后发）时的行为。
// 该开关在 src/config/env.js 加载时固定，因此必须在动态 import 之前打桩，
// 本文件不写任何业务模块的静态 import。
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

let api;
let prisma;
let resetDatabase;
let createUser;
let createCategory;
let loginAs;
let bearer;
let uploadImageUrl;

let ownerToken;
let categoryId;

beforeAll(async () => {
  vi.stubEnv('REQUIRE_REVIEW', 'true');

  const [appModule, dbModule, dbHelpers, fixtures, session, itemHelpers, supertestModule] =
    await Promise.all([
      import('../src/app.js'),
      import('../src/db/prisma.js'),
      import('./helpers/db.js'),
      import('./helpers/fixtures.js'),
      import('./helpers/session.js'),
      import('./helpers/item.js'),
      import('supertest'),
    ]);

  const request = supertestModule.default;
  api = () => request(appModule.createApp());
  prisma = dbModule.prisma;
  resetDatabase = dbHelpers.resetDatabase;
  createUser = fixtures.createUser;
  createCategory = fixtures.createCategory;
  loginAs = session.loginAs;
  bearer = session.bearer;
  uploadImageUrl = itemHelpers.uploadImageUrl;
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await prisma?.$disconnect();
});

beforeEach(async () => {
  await resetDatabase();
  const category = await createCategory({ name: '电子产品' });
  categoryId = category.id;
  await createUser({ studentNo: '20240701', name: '投稿者' });
  ownerToken = await loginAs('20240701');
});

describe('REQUIRE_REVIEW=true：发布进入待审核', () => {
  it('新建帖子状态是 pending，并提示等待审核', async () => {
    const url = await uploadImageUrl(ownerToken);
    const res = await api().post('/api/items').set(bearer(ownerToken)).send({
      type: 'lost',
      title: '丢了水壶',
      description: '蓝色保温杯，杯身有贴纸',
      categoryId,
      location: '教学楼 B 座',
      happenedAt: new Date(Date.now() - 3600 * 1000).toISOString(),
      contactType: 'wechat',
      contactValue: 'wx_pending_001',
      images: [url],
    });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('pending');
    expect(res.body.message).toContain('审核');
  });

  it('待审核的帖子不出现在公开列表', async () => {
    const created = await api()
      .post('/api/items')
      .set(bearer(ownerToken))
      .send({
        type: 'lost',
        title: '丢了水壶',
        description: '蓝色保温杯，杯身有贴纸',
        categoryId,
        location: '教学楼 B 座',
        happenedAt: new Date(Date.now() - 3600 * 1000).toISOString(),
        contactType: 'wechat',
        contactValue: 'wx_pending_002',
        images: [await uploadImageUrl(ownerToken)],
      });

    const list = await api().get('/api/items');
    expect(list.body.data.list.map((item) => item.id)).not.toContain(created.body.data.id);
  });

  it('作者能在「我的发布」看到待审核的帖子', async () => {
    await api()
      .post('/api/items')
      .set(bearer(ownerToken))
      .send({
        type: 'found',
        title: '捡到钥匙',
        description: '一串钥匙，有三把，在食堂门口捡的',
        categoryId,
        location: '第一食堂',
        happenedAt: new Date(Date.now() - 7200 * 1000).toISOString(),
        contactType: 'qq',
        contactValue: '12345678',
        images: [await uploadImageUrl(ownerToken)],
      });

    const mine = await api().get('/api/me/items').set(bearer(ownerToken));

    expect(mine.body.data.pagination.total).toBe(1);
    expect(mine.body.data.list[0].status).toBe('pending');
  });

  it('编辑后仍回到 pending 并清空驳回原因', async () => {
    const created = await api()
      .post('/api/items')
      .set(bearer(ownerToken))
      .send({
        type: 'lost',
        title: '丢了耳机',
        description: '白色 TWS 耳机，充电盒有划痕',
        categoryId,
        location: '操场看台',
        happenedAt: new Date(Date.now() - 3600 * 1000).toISOString(),
        contactType: 'wechat',
        contactValue: 'wx_pending_003',
        images: [await uploadImageUrl(ownerToken)],
      });

    const itemId = created.body.data.id;
    await prisma.item.update({
      where: { id: itemId },
      data: { status: 'rejected', rejectReason: '描述太简单' },
    });

    const res = await api()
      .put(`/api/items/${itemId}`)
      .set(bearer(ownerToken))
      .send({ description: '白色 TWS 耳机，充电盒右上角有明显划痕，丢失时间约下午三点' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('pending');
    expect(res.body.data).not.toHaveProperty('rejectReason');
    expect(res.body.message).toContain('审核');
  });
});
