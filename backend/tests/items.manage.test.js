import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { api } from './helpers/request.js';
import { prisma, resetDatabase } from './helpers/db.js';
import { createCategory, createItemRecord, createUser } from './helpers/fixtures.js';
import { bearer, loginAs } from './helpers/session.js';
import { createItemViaApi, uploadImageUrl } from './helpers/item.js';

let owner;
let ownerToken;
let otherToken;
let category;

beforeEach(async () => {
  await resetDatabase();
  category = await createCategory({ name: '电子产品' });
  owner = await createUser({ studentNo: '20240501', name: '作者' });
  await createUser({ studentNo: '20240502', name: '路人' });
  ownerToken = await loginAs('20240501');
  otherToken = await loginAs('20240502');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('PUT /api/items/:id', () => {
  it('作者修改标题成功', async () => {
    const created = await createItemViaApi(ownerToken, category.id);

    const res = await api()
      .put(`/api/items/${created.body.data.id}`)
      .set(bearer(ownerToken))
      .send({ title: '改了标题' });

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('改了标题');
    // 未提交的字段保持不变
    expect(res.body.data.location).toBe(created.body.data.location);
    expect(res.body.data.status).toBe('open');
  });

  it('他人修改 → 403', async () => {
    const created = await createItemViaApi(ownerToken, category.id);

    const res = await api()
      .put(`/api/items/${created.body.data.id}`)
      .set(bearer(otherToken))
      .send({ title: '我要改别人的帖子' });

    expect(res.status).toBe(403);
    expect(res.body.message).toContain('只能编辑自己发布的帖子');
  });

  it('未登录修改 → 401', async () => {
    const created = await createItemViaApi(ownerToken, category.id);

    const res = await api()
      .put(`/api/items/${created.body.data.id}`)
      .send({ title: '匿名修改' });

    expect(res.status).toBe(401);
  });

  it('已找回的帖子不可编辑 → 409', async () => {
    const item = await createItemRecord({
      userId: owner.id,
      categoryId: category.id,
      status: 'resolved',
    });

    const res = await api()
      .put(`/api/items/${item.id}`)
      .set(bearer(ownerToken))
      .send({ title: '再改一次' });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('当前状态不允许编辑');
  });

  it('被驳回的帖子可以编辑', async () => {
    const item = await createItemRecord({
      userId: owner.id,
      categoryId: category.id,
      status: 'rejected',
    });

    const res = await api()
      .put(`/api/items/${item.id}`)
      .set(bearer(ownerToken))
      .send({ title: '按要求改好了' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('open');
  });

  it('替换图片：旧图记录被删除，只保留新图', async () => {
    const created = await createItemViaApi(ownerToken, category.id);
    const newUrl = await uploadImageUrl(ownerToken);

    const res = await api()
      .put(`/api/items/${created.body.data.id}`)
      .set(bearer(ownerToken))
      .send({ images: [newUrl] });

    expect(res.status).toBe(200);
    expect(res.body.data.images).toHaveLength(1);
    expect(res.body.data.images[0].url).toBe(newUrl);

    const count = await prisma.itemImage.count({ where: { itemId: created.body.data.id } });
    expect(count).toBe(1);
  });

  it('只改联系方式类型不传内容 → 400', async () => {
    const item = await createItemRecord({ userId: owner.id, categoryId: category.id });

    const res = await api()
      .put(`/api/items/${item.id}`)
      .set(bearer(ownerToken))
      .send({ contactType: 'qq' });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('请求参数校验失败');
  });

  it('联系方式成对提交且格式非法 → 400', async () => {
    const item = await createItemRecord({ userId: owner.id, categoryId: category.id });

    const res = await api()
      .put(`/api/items/${item.id}`)
      .set(bearer(ownerToken))
      .send({ contactType: 'phone', contactValue: 'abc' });

    expect(res.status).toBe(400);
    expect(res.body.data.some((e) => e.field === 'contactValue')).toBe(true);
  });

  it('改成已停用的分类 → 400', async () => {
    const disabled = await createCategory({ name: '停用分类', enabled: false });
    const item = await createItemRecord({ userId: owner.id, categoryId: category.id });

    const res = await api()
      .put(`/api/items/${item.id}`)
      .set(bearer(ownerToken))
      .send({ categoryId: disabled.id });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('已停用');
  });

  it('帖子不存在 → 404', async () => {
    const res = await api()
      .put('/api/items/999999')
      .set(bearer(ownerToken))
      .send({ title: '不存在' });

    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/items/:id/resolve', () => {
  it('作者标记已找回：状态与时间都更新', async () => {
    const item = await createItemRecord({ userId: owner.id, categoryId: category.id });

    const res = await api().patch(`/api/items/${item.id}/resolve`).set(bearer(ownerToken));

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('resolved');

    const saved = await prisma.item.findUnique({ where: { id: item.id } });
    expect(saved.resolvedAt).toBeInstanceOf(Date);
  });

  it('他人标记 → 403', async () => {
    const item = await createItemRecord({ userId: owner.id, categoryId: category.id });

    const res = await api().patch(`/api/items/${item.id}/resolve`).set(bearer(otherToken));

    expect(res.status).toBe(403);
  });

  it('重复标记 → 409', async () => {
    const item = await createItemRecord({
      userId: owner.id,
      categoryId: category.id,
      status: 'resolved',
    });

    const res = await api().patch(`/api/items/${item.id}/resolve`).set(bearer(ownerToken));

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('已标记为已找回');
  });

  it('待审核的帖子不能标记 → 409', async () => {
    const item = await createItemRecord({
      userId: owner.id,
      categoryId: category.id,
      status: 'pending',
    });

    const res = await api().patch(`/api/items/${item.id}/resolve`).set(bearer(ownerToken));

    expect(res.status).toBe(409);
  });

  it('未登录 → 401', async () => {
    const item = await createItemRecord({ userId: owner.id, categoryId: category.id });

    const res = await api().patch(`/api/items/${item.id}/resolve`);

    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/items/:id', () => {
  it('作者删除成功，帖子与图片一并清除', async () => {
    const created = await createItemViaApi(ownerToken, category.id);
    const itemId = created.body.data.id;

    const res = await api().delete(`/api/items/${itemId}`).set(bearer(ownerToken));

    expect(res.status).toBe(200);

    const detail = await api().get(`/api/items/${itemId}`);
    expect(detail.status).toBe(404);

    expect(await prisma.itemImage.count({ where: { itemId } })).toBe(0);
  });

  it('他人删除 → 403，帖子仍在', async () => {
    const created = await createItemViaApi(ownerToken, category.id);

    const res = await api()
      .delete(`/api/items/${created.body.data.id}`)
      .set(bearer(otherToken));

    expect(res.status).toBe(403);
    expect(await prisma.item.count({ where: { id: created.body.data.id } })).toBe(1);
  });

  it('未登录删除 → 401', async () => {
    const item = await createItemRecord({ userId: owner.id, categoryId: category.id });

    const res = await api().delete(`/api/items/${item.id}`);

    expect(res.status).toBe(401);
  });

  it('删除不存在的帖子 → 404', async () => {
    const res = await api().delete('/api/items/999999').set(bearer(ownerToken));

    expect(res.status).toBe(404);
  });
});
