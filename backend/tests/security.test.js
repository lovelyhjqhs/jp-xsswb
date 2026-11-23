// 安全加固相关测试：响应头、CORS 白名单、限流、LIKE 转义、越权、接口文档
import express from 'express';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { api } from './helpers/request.js';
import { prisma, resetDatabase } from './helpers/db.js';
import { createCategory, createItemRecord, createUser } from './helpers/fixtures.js';
import { bearer, loginAs } from './helpers/session.js';
import { createRateLimiter } from '../src/middlewares/rateLimit.js';

let admin;
let adminToken;
let student;
let studentToken;
let category;

beforeEach(async () => {
  await resetDatabase();
  admin = await createUser({ studentNo: '20240901', name: '管理员', role: 'admin' });
  student = await createUser({ studentNo: '20240902', name: '学生甲' });
  category = await createCategory({ name: '电子产品' });
  adminToken = await loginAs('20240901');
  studentToken = await loginAs('20240902');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('安全响应头（helmet）', () => {
  it('包含 nosniff / frame-options / referrer-policy，且隐藏 x-powered-by', async () => {
    const response = await api().get('/api/health');

    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(response.headers['referrer-policy']).toBe('no-referrer');
    expect(response.headers['x-powered-by']).toBeUndefined();
    // 图片需要跨域加载，所以 CORP 必须是 cross-origin
    expect(response.headers['cross-origin-resource-policy']).toBe('cross-origin');
  });
});

describe('CORS 白名单', () => {
  it('白名单来源会拿到 CORS 响应头', async () => {
    const response = await api().get('/api/categories').set('Origin', 'http://localhost:5173');

    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('非白名单来源不返回 CORS 头（浏览器会拦下）', async () => {
    const response = await api().get('/api/categories').set('Origin', 'https://evil.example.com');

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('预检请求只允许约定的方法与请求头', async () => {
    const response = await api()
      .options('/api/items')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'authorization,content-type');

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-methods']).toContain('POST');
    expect(response.headers['access-control-allow-headers'].toLowerCase()).toContain('authorization');
  });

  it('没有 Origin 的请求（curl / 服务端调用）不受影响', async () => {
    const response = await api().get('/api/categories');

    expect(response.status).toBe(200);
  });
});

describe('全局限流', () => {
  it('超过额度返回 429 + 业务错误码 + Retry-After', async () => {
    // 单独搭一个极小限额的应用，避免影响其他用例
    const app = express();
    app.get('/ping', createRateLimiter({ windowMs: 60_000, max: 2 }), (_req, res) => {
      res.json({ code: 0, message: 'ok', data: null });
    });

    expect((await request(app).get('/ping')).status).toBe(200);
    expect((await request(app).get('/ping')).status).toBe(200);

    const blocked = await request(app).get('/ping');

    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe(42901);
    expect(blocked.headers['retry-after']).toBeDefined();
  });
});

describe('LIKE 通配符转义', () => {
  it('搜索 % 不会返回全部帖子', async () => {
    await createItemRecord({ userId: student.id, categoryId: category.id, title: '正常标题' });

    const response = await api().get(`/api/items?keyword=${encodeURIComponent('%')}`);

    expect(response.status).toBe(200);
    expect(response.body.data.pagination.total).toBe(0);
  });

  it('搜索 _ 不会变成单字符通配', async () => {
    await createItemRecord({ userId: student.id, categoryId: category.id, title: 'abc' });

    const response = await api().get(`/api/items?keyword=${encodeURIComponent('_')}`);

    expect(response.body.data.pagination.total).toBe(0);
  });

  it('正常关键词仍然能匹配', async () => {
    await createItemRecord({ userId: student.id, categoryId: category.id, title: '丢了雨伞' });

    const response = await api().get(`/api/items?keyword=${encodeURIComponent('雨伞')}`);

    expect(response.body.data.pagination.total).toBe(1);
  });

  it('后台用户搜索同样做了转义', async () => {
    const response = await api()
      .get(`/api/admin/users?keyword=${encodeURIComponent('%')}`)
      .set(bearer(adminToken));

    expect(response.body.data.pagination.total).toBe(0);
  });
});

describe('越权防护', () => {
  it('管理员不能重置其他管理员的密码', async () => {
    const another = await createUser({ studentNo: '20240903', name: '另一个管理员', role: 'admin' });

    const response = await api()
      .post(`/api/admin/users/${another.id}/reset-password`)
      .set(bearer(adminToken));

    expect(response.status).toBe(403);
    expect(response.body.message).toContain('不能重置其他管理员');
  });

  it('管理员可以重置自己的密码', async () => {
    const response = await api()
      .post(`/api/admin/users/${admin.id}/reset-password`)
      .set(bearer(adminToken));

    expect(response.status).toBe(200);
    expect(response.body.data.tempPassword).toBeTruthy();
  });

  it('学生不能通过改自己的 role 提权', async () => {
    // 注册接口会丢弃 role 字段
    await api()
      .post('/api/auth/register')
      .send({
        studentNo: '20240999',
        name: '想提权',
        password: 'Passw0rd123',
        confirmPassword: 'Passw0rd123',
        role: 'admin',
        status: 'active',
      });

    const created = await prisma.user.findUnique({ where: { studentNo: '20240999' } });
    expect(created.role).toBe('student');
  });

  it('学生改不了别人的帖子（水平越权）', async () => {
    const others = await createUser({ studentNo: '20240904', name: '别人' });
    const item = await createItemRecord({ userId: others.id, categoryId: category.id });

    const responses = await Promise.all([
      api().put(`/api/items/${item.id}`).set(bearer(studentToken)).send({ title: '篡改标题' }),
      api().delete(`/api/items/${item.id}`).set(bearer(studentToken)),
      api().patch(`/api/items/${item.id}/resolve`).set(bearer(studentToken)),
    ]);

    for (const response of responses) {
      expect(response.status).toBe(403);
    }
    expect(await prisma.item.count({ where: { id: item.id } })).toBe(1);
  });

  it('学生调不了任何后台写接口（垂直越权）', async () => {
    const responses = await Promise.all([
      api().post(`/api/admin/items/${1}/approve`).set(bearer(studentToken)),
      api().patch(`/api/admin/users/${admin.id}/status`).set(bearer(studentToken)).send({ status: 'banned' }),
      api().post('/api/admin/categories').set(bearer(studentToken)).send({ name: '越权分类' }),
    ]);

    for (const response of responses) {
      expect(response.status).toBe(403);
    }
    expect(await prisma.category.count({ where: { name: '越权分类' } })).toBe(0);
  });
});

describe('接口文档', () => {
  it('/api/docs 返回 HTML 页面，并带严格 CSP', async () => {
    const response = await api().get('/api/docs');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.headers['content-security-policy']).toContain("default-src 'none'");
    expect(response.text).toContain('校园失物招领 API');
    // 页面里不应出现脚本标签（零 JS 设计）
    expect(response.text).not.toContain('<script');
  });

  it('/api/docs/openapi.json 是可解析的规范，覆盖主要接口', async () => {
    const response = await api().get('/api/docs/openapi.json');

    expect(response.status).toBe(200);
    expect(response.body.openapi).toMatch(/^3\./);
    expect(Object.keys(response.body.paths)).toEqual(
      expect.arrayContaining(['/admin/auth/login', '/public/news', '/admin/items', '/upload']),
    );
  });

  it('/api/docs/openapi.yaml 可以直接下载（给 Postman/Apifox 导入）', async () => {
    const response = await api().get('/api/docs/openapi.yaml');

    expect(response.status).toBe(200);
    expect(response.text).toContain('openapi: 3.0.3');
  });
});

describe('错误响应不泄漏内部细节', () => {
  it('不存在的路由返回统一 JSON 结构，且不含堆栈', async () => {
    const response = await api().get('/api/definitely-not-exists');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      code: 40401,
      message: expect.stringContaining('请求的资源不存在'),
      data: null,
    });
    expect(response.text).not.toContain('at ');
  });

  it('非法 JSON 请求体返回 400 而不是 500', async () => {
    const response = await api()
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"studentNo": "1",');

    expect(response.status).toBe(400);
    expect(response.body.code).toBe(40001);
  });
});
