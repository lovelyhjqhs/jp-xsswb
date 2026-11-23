import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';

import { api } from './helpers/request.js';
import { prisma, resetDatabase } from './helpers/db.js';
import { createCategory, createUser, TEST_PASSWORD } from './helpers/fixtures.js';
import { makePng } from './helpers/item.js';
import { PRIVATE_UPLOAD_ROOT } from '../src/config/paths.js';
import { resolveStoredImagePath } from '../src/services/upload.service.js';
import { logAudit } from '../src/services/audit.service.js';
import { getPublicSitemapEntries } from '../src/services/public.service.js';

let admin;
let adminCookies;
let csrf;
let category;

beforeEach(async () => {
  await resetDatabase();
  admin = await createUser({ studentNo: '20249990', name: '安全测试管理员', role: 'admin' });
  category = await createCategory();
  const login = await api().post('/api/admin/auth/login').send({ studentNo: admin.studentNo, password: TEST_PASSWORD });
  expect(login.status).toBe(200);
  const sessionCookie = login.headers['set-cookie'].find((cookie) => cookie.startsWith('admin_session=')).split(';')[0];
  const csrfCookie = login.headers['set-cookie'].find((cookie) => cookie.startsWith('admin_csrf=')).split(';')[0];
  csrf = csrfCookie.slice('admin_csrf='.length);
  adminCookies = `${sessionCookie}; ${csrfCookie}`;
});

afterAll(async () => prisma.$disconnect());

async function submitLostFoundImage() {
  const response = await api()
    .post('/api/public/lost-found/items')
    .set('Idempotency-Key', `security-item-key-${Date.now()}`)
    .field('type', 'lost')
    .field('title', '遗失蓝色水杯')
    .field('description', '在图书馆附近遗失的蓝色水杯。')
    .field('area', 'A')
    .field('categoryId', String(category.id))
    .field('location', '图书馆门口')
    .field('happenedAt', new Date(Date.now() - 60_000).toISOString())
    .attach('attachments', await makePng(), { filename: 'private-name.png', contentType: 'image/png' });
  expect(response.status).toBe(201);
  return prisma.item.findUnique({ where: { queryNo: response.body.data.queryNo }, include: { images: true } });
}

describe('游客投稿附件访问边界', () => {
  it('缺少幂等键时拒绝创建投稿', async () => {
    const response = await api().post('/api/public/canteen-feedback')
      .field('submitMode', 'anonymous')
      .field('content', '缺失幂等键的投稿不应保存');
    expect(response.status).toBe(400);
    expect(await prisma.canteenFeedback.count()).toBe(0);
  });

  it('相同幂等键的并发投稿只创建一条记录并返回同一查询编号', async () => {
    const submit = () => api().post('/api/public/canteen-feedback')
      .set('Idempotency-Key', 'security-race-key-20261110')
      .field('submitMode', 'anonymous')
      .field('content', '并发重复投稿幂等性验证内容');
    const [first, second] = await Promise.all([submit(), submit()]);
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.body.data.queryNo).toBe(second.body.data.queryNo);
    expect(await prisma.canteenFeedback.count({ where: { content: '并发重复投稿幂等性验证内容' } })).toBe(1);
  });

  it('附件物理存入私有目录，未登录拒绝读取，管理员会话可读取', async () => {
    const item = await submitLostFoundImage();
    const privateUrl = item.attachments[0].url;
    expect(privateUrl).toMatch(/^\/private-uploads\/\d{4}\/\d{2}\/[a-f0-9]{32}\.webp$/);
    expect(privateUrl).not.toContain('private-name');

    const [, year, month, filename] = /^\/private-uploads\/(\d{4})\/(\d{2})\/([a-f0-9]{32}\.webp)$/.exec(privateUrl);
    const directStatic = await api().get(privateUrl.replace('/private-uploads/', '/uploads/'));
    expect(directStatic.status).toBe(404);

    const denied = await api().get(`/api/admin/private-attachments/${year}/${month}/${filename}`);
    expect(denied.status).toBe(401);

    const allowed = await api().get(`/api/admin/private-attachments/${year}/${month}/${filename}`).set('Cookie', adminCookies);
    expect(allowed.status).toBe(200);
    expect(allowed.headers['content-type']).toContain('image/webp');
    expect(allowed.headers['cache-control']).toBe('private, no-store');
    expect(PRIVATE_UPLOAD_ROOT).toBeTruthy();
  });

  it('操作日志丢弃姓名、联系方式和自由文本，只保存状态类摘要', async () => {
    await logAudit({
      adminId: admin.id,
      action: 'test.privacy',
      targetType: 'test',
      detail: { from: 'pending_review', to: 'approved', name: '不应写入', contactValue: '123456', reason: '自由文本不应进入日志' },
    });
    const row = await prisma.auditLog.findFirst({ where: { action: 'test.privacy' } });
    expect(row.detail).toEqual({ from: 'pending_review', to: 'approved' });
  });

  it('失物图片仅在管理员通过后经所属记录接口公开，归档后立即拒绝', async () => {
    const item = await submitLostFoundImage();
    const image = item.images[0];
    const imagePath = `/api/public/lost-found/${item.id}/images/${image.id}`;
    expect((await api().get(imagePath)).status).toBe(404);

    const approved = await api().post(`/api/admin/items/${item.id}/approve`)
      .set('Cookie', adminCookies)
      .set('X-CSRF-Token', csrf);
    expect(approved.status).toBe(200);
    const detail = await api().get(`/api/public/lost-found/${item.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.images[0].url).toBe(imagePath);
    const storedImagePath = resolveStoredImagePath(image.url);
    expect(storedImagePath).toBeTruthy();
    await expect(fs.access(storedImagePath)).resolves.toBeUndefined();
    const publicImage = await api().get(imagePath);
    expect(publicImage.status, JSON.stringify(publicImage.body)).toBe(200);
    expect(publicImage.headers['content-type']).toContain('image/webp');
    expect(publicImage.headers['cache-control']).toBe('no-store');

    const cleaned = await api().post(`/api/admin/items/${item.id}/clean`)
      .set('Cookie', adminCookies)
      .set('X-CSRF-Token', csrf);
    expect(cleaned.status).toBe(200);

    const archived = await api().post(`/api/admin/items/${item.id}/archive`)
      .set('Cookie', adminCookies)
      .set('X-CSRF-Token', csrf);
    expect(archived.status).toBe(200);
    expect((await api().get(imagePath)).status).toBe(404);
  });

  it('已归还记录立即从游客列表、详情、图片和站点地图隐藏', async () => {
    const item = await submitLostFoundImage();
    const image = item.images[0];
    const imagePath = `/api/public/lost-found/${item.id}/images/${image.id}`;
    const approved = await api().post(`/api/admin/items/${item.id}/approve`)
      .set('Cookie', adminCookies)
      .set('X-CSRF-Token', csrf);
    expect(approved.status).toBe(200);
    await prisma.item.update({ where: { id: item.id }, data: { status: 'resolved', resolvedAt: new Date() } });

    const list = await api().get('/api/public/lost-found');
    expect(list.status).toBe(200);
    expect(list.body.data.list.some((entry) => entry.id === item.id)).toBe(false);
    expect((await api().get(`/api/public/lost-found/${item.id}`)).status).toBe(404);
    expect((await api().get(imagePath)).status).toBe(404);
    expect((await getPublicSitemapEntries()).some((entry) => entry.path === `/lost-found/${item.id}`)).toBe(false);
  });
});
