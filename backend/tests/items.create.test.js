import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { api } from './helpers/request.js';
import { prisma, resetDatabase } from './helpers/db.js';
import { createCategory, createUser } from './helpers/fixtures.js';
import { bearer, loginAs } from './helpers/session.js';
import { createItemViaApi, itemPayload, makePng, uploadImage, uploadImageUrl } from './helpers/item.js';
import { resetAllLoginFailures } from '../src/middlewares/loginRateLimit.js';

let owner;
let token;
let category;

beforeEach(async () => {
  await resetDatabase();
  resetAllLoginFailures();
  category = await createCategory({ name: '电子产品' });
  owner = await createUser({ studentNo: '20240201', name: '发布者' });
  token = await loginAs('20240201');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /api/items —— 成功', () => {
  it('发布成功：状态 open、图片入库、联系方式对本人可见', async () => {
    const res = await createItemViaApi(token, category.id, { title: '丢了 AirPods' });

    expect(res.status).toBe(201);
    expect(res.body.code).toBe(0);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        title: '丢了 AirPods',
        type: 'lost',
        status: 'open',
        hasContact: true,
        contactValue: 'wx_test_001',
      }),
    );
    expect(res.body.data.images).toHaveLength(1);
    expect(res.body.data.category).toEqual(expect.objectContaining({ id: category.id }));

    const saved = await prisma.itemImage.count({ where: { itemId: res.body.data.id } });
    expect(saved).toBe(1);
  });

  it('支持 5 张图片并保持顺序', async () => {
    const urls = [];
    for (let i = 0; i < 5; i += 1) {
      urls.push(await uploadImageUrl(token));
    }

    const res = await api()
      .post('/api/items')
      .set(bearer(token))
      .send(itemPayload(category.id, { images: urls }));

    expect(res.status).toBe(201);
    expect(res.body.data.images.map((image) => image.url)).toEqual(urls);
    expect(res.body.data.images.map((image) => image.sortOrder)).toEqual([0, 1, 2, 3, 4]);
  });

  it('招领类型可以正常发布', async () => {
    const res = await createItemViaApi(token, category.id, { type: 'found', title: '捡到一张饭卡' });

    expect(res.status).toBe(201);
    expect(res.body.data.type).toBe('found');
  });
});

describe('POST /api/items —— 权限与边界', () => {
  it('未登录 → 401', async () => {
    const url = await uploadImageUrl(token);
    const res = await api().post('/api/items').send(itemPayload(category.id, { images: [url] }));

    expect(res.status).toBe(401);
  });

  it('不传图片 → 400', async () => {
    const res = await api().post('/api/items').set(bearer(token)).send(itemPayload(category.id));

    expect(res.status).toBe(400);
    expect(res.body.data.some((e) => e.field === 'images')).toBe(true);
  });

  it('图片为空数组 → 400', async () => {
    const res = await api()
      .post('/api/items')
      .set(bearer(token))
      .send(itemPayload(category.id, { images: [] }));

    expect(res.status).toBe(400);
  });

  it('超过 5 张图片 → 400', async () => {
    const url = await uploadImageUrl(token);
    const res = await api()
      .post('/api/items')
      .set(bearer(token))
      .send(itemPayload(category.id, { images: Array(6).fill(url) }));

    expect(res.status).toBe(400);
    expect(res.body.data.some((e) => e.field === 'images')).toBe(true);
  });

  it('图片地址不属于本站上传目录 → 400', async () => {
    const res = await api()
      .post('/api/items')
      .set(bearer(token))
      .send(itemPayload(category.id, { images: ['https://evil.example.com/a.jpg'] }));

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('图片地址不合法');
  });

  it('图片文件不存在 → 400', async () => {
    const fake = `/uploads/2024/01/${'a'.repeat(32)}.webp`;
    const res = await api()
      .post('/api/items')
      .set(bearer(token))
      .send(itemPayload(category.id, { images: [fake] }));

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('图片不存在');
  });

  it('分类不存在 → 400', async () => {
    const url = await uploadImageUrl(token);
    const res = await api()
      .post('/api/items')
      .set(bearer(token))
      .send(itemPayload(99999, { images: [url] }));

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('分类不存在');
  });

  it('分类已停用 → 400', async () => {
    const disabled = await createCategory({ name: '已停用分类', enabled: false });
    const url = await uploadImageUrl(token);
    const res = await api()
      .post('/api/items')
      .set(bearer(token))
      .send(itemPayload(disabled.id, { images: [url] }));

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('已停用');
  });
});

describe('POST /api/items —— 字段校验', () => {
  let url;

  beforeEach(async () => {
    url = await uploadImageUrl(token);
  });

  const post = (overrides) =>
    api()
      .post('/api/items')
      .set(bearer(token))
      .send(itemPayload(category.id, { images: [url], ...overrides }));

  it('type 非法 → 400', async () => {
    const res = await post({ type: 'other' });
    expect(res.status).toBe(400);
    expect(res.body.data.some((e) => e.field === 'type')).toBe(true);
  });

  it('标题过短 → 400', async () => {
    const res = await post({ title: '丢' });
    expect(res.status).toBe(400);
    expect(res.body.data.some((e) => e.field === 'title')).toBe(true);
  });

  it('标题过长 → 400', async () => {
    const res = await post({ title: '标'.repeat(61) });
    expect(res.status).toBe(400);
  });

  it('描述过短 → 400', async () => {
    const res = await post({ description: '丢了' });
    expect(res.status).toBe(400);
    expect(res.body.data.some((e) => e.field === 'description')).toBe(true);
  });

  it('地点过短 → 400', async () => {
    const res = await post({ location: '图' });
    expect(res.status).toBe(400);
  });

  it('发生时间在未来 → 400', async () => {
    const res = await post({ happenedAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString() });
    expect(res.status).toBe(400);
    expect(res.body.data.some((e) => e.field === 'happenedAt')).toBe(true);
  });

  it('手机号格式不正确 → 400', async () => {
    const res = await post({ contactType: 'phone', contactValue: '12345' });
    expect(res.status).toBe(400);
    expect(res.body.data.some((e) => e.field === 'contactValue')).toBe(true);
  });

  it('QQ 号格式不正确 → 400', async () => {
    const res = await post({ contactType: 'qq', contactValue: 'abc123' });
    expect(res.status).toBe(400);
    expect(res.body.data.some((e) => e.field === 'contactValue')).toBe(true);
  });

  it('未知字段被忽略，不会写进数据库', async () => {
    const res = await post({ status: 'resolved', viewCount: 9999 });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('open');
    expect(res.body.data.viewCount).toBe(0);
  });
});

describe('POST /api/items —— 每日发布上限', () => {
  it('第 11 条返回 429', async () => {
    // 直接塞 10 条，避免测试里真跑十次上传
    for (let i = 0; i < 10; i += 1) {
      await prisma.item.create({
        data: {
          userId: owner.id,
          categoryId: category.id,
          type: 'lost',
          title: `历史帖子 ${i}`,
          description: '历史数据描述内容',
          location: '老地点',
          happenedAt: new Date(Date.now() - 86400000),
          contactType: 'wechat',
          contactValue: 'wx_old',
          status: 'open',
        },
      });
    }

    const url = await uploadImageUrl(token);
    const res = await api()
      .post('/api/items')
      .set(bearer(token))
      .send(itemPayload(category.id, { images: [url] }));

    expect(res.status).toBe(429);
    expect(res.body.code).toBe(42901);
    expect(res.body.message).toContain('每天最多发布 10 条');
  });

  it('额度按天重置：昨天的帖子不占用今天的额度', async () => {
    const yesterday = new Date(Date.now() - 24 * 3600 * 1000);
    for (let i = 0; i < 10; i += 1) {
      await prisma.item.create({
        data: {
          userId: owner.id,
          categoryId: category.id,
          type: 'lost',
          title: `昨天发的 ${i}`,
          description: '昨天发布的描述内容',
          location: '老地点',
          happenedAt: yesterday,
          contactType: 'wechat',
          contactValue: 'wx_old',
          status: 'open',
          createdAt: yesterday,
        },
      });
    }

    const res = await createItemViaApi(token, category.id);

    expect(res.status).toBe(201);
  });
});

describe('上传与发布的联通性', () => {
  it('上传返回的 URL 可以直接用于发帖', async () => {
    const uploaded = await uploadImage(token, { buffer: await makePng(600, 600) });
    const res = await api()
      .post('/api/items')
      .set(bearer(token))
      .send(itemPayload(category.id, { images: [uploaded.body.data.url] }));

    expect(res.status).toBe(201);
    expect(res.body.data.images[0].url).toBe(uploaded.body.data.url);
  });
});
