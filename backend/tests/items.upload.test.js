import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { api } from './helpers/request.js';
import { prisma, resetDatabase } from './helpers/db.js';
import { createUser } from './helpers/fixtures.js';
import { bearer, loginAs } from './helpers/session.js';
import { makePng, uploadImage } from './helpers/item.js';
import { UPLOAD_ROOT } from '../src/config/paths.js';

let token;

beforeEach(async () => {
  await resetDatabase();
  await createUser({ studentNo: '20240101' });
  token = await loginAs('20240101');
});

afterAll(async () => {
  await prisma.$disconnect();
});

/** /uploads/2026/10/xxx.webp → 磁盘绝对路径 */
function toDiskPath(url) {
  return path.join(UPLOAD_ROOT, url.replace(/^\/uploads\//, ''));
}

describe('POST /api/upload', () => {
  it('未登录 → 401（避免被当成匿名图床）', async () => {
    const res = await api()
      .post('/api/upload')
      .attach('image', await makePng(), { filename: 'a.png', contentType: 'image/png' });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe(40101);
  });

  it('上传 png 成功，返回随机文件名与 webp 格式', async () => {
    const res = await uploadImage(token);

    expect(res.status).toBe(201);
    expect(res.body.code).toBe(0);
    expect(res.body.data.url).toMatch(/^\/uploads\/\d{4}\/\d{2}\/[a-f0-9]{32}\.webp$/);
    expect(res.body.data.format).toBe('webp');
    expect(res.body.data.size).toBeGreaterThan(0);
  });

  it('文件真实落盘，且最长边被压到 1280', async () => {
    const png = await makePng(2000, 1200);
    const res = await uploadImage(token, { buffer: png });

    const filePath = toDiskPath(res.body.data.url);
    const stat = await fs.stat(filePath);
    expect(stat.size).toBeGreaterThan(0);

    const meta = await sharp(filePath).metadata();
    expect(meta.format).toBe('webp');
    expect(Math.max(meta.width, meta.height)).toBe(1280);
    expect(meta.width).toBe(1280);
    expect(meta.height).toBe(768);
  });

  it('小于 1280 的图片不会被放大', async () => {
    const res = await uploadImage(token, { buffer: await makePng(300, 200) });

    const meta = await sharp(toDiskPath(res.body.data.url)).metadata();
    expect(meta.width).toBe(300);
    expect(meta.height).toBe(200);
  });

  it('两个同名文件会得到不同的随机文件名', async () => {
    const png = await makePng();
    const first = await uploadImage(token, { buffer: png, filename: 'same.png' });
    const second = await uploadImage(token, { buffer: png, filename: 'same.png' });

    expect(first.body.data.url).not.toBe(second.body.data.url);
  });

  it('非图片类型 → 400', async () => {
    const res = await api()
      .post('/api/upload')
      .set(bearer(token))
      .attach('image', Buffer.from('hello'), { filename: 'a.txt', contentType: 'text/plain' });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('仅支持 jpg / png / webp');
  });

  it('超过 5MB → 400', async () => {
    const big = Buffer.alloc(6 * 1024 * 1024, 1);
    const res = await uploadImage(token, { buffer: big, filename: 'big.png' });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('5MB');
  });

  it('伪装成 image/png 的坏文件 → 400（靠 sharp 解析兜底，不信 mimetype）', async () => {
    const res = await uploadImage(token, {
      buffer: Buffer.from('这不是图片'),
      filename: 'fake.png',
      contentType: 'image/png',
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('图片无法安全解析');
  });

  it('没有带文件 → 400', async () => {
    const res = await api().post('/api/upload').set(bearer(token)).send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('请选择要上传的图片');
  });
});
