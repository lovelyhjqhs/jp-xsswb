// 中间件测试：临时搭一个最小 Express 应用，直接验证三个鉴权中间件的行为，
// 不依赖后续阶段才会出现的业务接口。
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { adminRequired, authRequired, optionalAuth } from '../src/middlewares/auth.js';
import { errorHandler, notFoundHandler } from '../src/middlewares/errorHandler.js';
import { env } from '../src/config/env.js';
import { prisma, resetDatabase } from './helpers/db.js';
import { createUser } from './helpers/fixtures.js';

function buildApp() {
  const app = express();

  app.get('/optional', optionalAuth, (req, res) => {
    res.json({ code: 0, message: 'ok', data: { userId: req.user?.id ?? null } });
  });

  app.get('/private', authRequired, (req, res) => {
    res.json({ code: 0, message: 'ok', data: { userId: req.user.id } });
  });

  app.get('/admin-only', authRequired, adminRequired, (req, res) => {
    res.json({ code: 0, message: 'ok', data: { role: req.user.role } });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

const app = buildApp();
const bearer = (token) => ({ Authorization: `Bearer ${token}` });

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('optionalAuth', () => {
  it('没有 token 也放行，req.user 为 null', async () => {
    const res = await request(app).get('/optional');

    expect(res.status).toBe(200);
    expect(res.body.data.userId).toBeNull();
  });

  it('有合法 token 时解析出用户', async () => {
    const user = await createUser({ studentNo: '20240031' });
    const token = jwt.sign({ sub: String(user.id) }, env.JWT_SECRET, { expiresIn: '1h' });

    const res = await request(app).get('/optional').set(bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.data.userId).toBe(user.id);
  });

  it('token 无效时按游客放行，不报错', async () => {
    const res = await request(app).get('/optional').set(bearer('broken.token.value'));

    expect(res.status).toBe(200);
    expect(res.body.data.userId).toBeNull();
  });
});

describe('authRequired', () => {
  it('无 token → 401', async () => {
    const res = await request(app).get('/private');

    expect(res.status).toBe(401);
    expect(res.body.code).toBe(40101);
  });

  it('有效 token → 放行并挂载 req.user', async () => {
    const user = await createUser({ studentNo: '20240032' });
    const token = jwt.sign({ sub: String(user.id) }, env.JWT_SECRET, { expiresIn: '1h' });

    const res = await request(app).get('/private').set(bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.data.userId).toBe(user.id);
  });

  it('token 里的用户已被删除 → 401', async () => {
    const user = await createUser({ studentNo: '20240033' });
    const token = jwt.sign({ sub: String(user.id) }, env.JWT_SECRET, { expiresIn: '1h' });
    await prisma.user.delete({ where: { id: user.id } });

    const res = await request(app).get('/private').set(bearer(token));

    expect(res.status).toBe(401);
    expect(res.body.message).toContain('账号不存在');
  });
});

describe('adminRequired', () => {
  it('学生访问管理员接口 → 403', async () => {
    const student = await createUser({ studentNo: '20240034', role: 'student' });
    const token = jwt.sign({ sub: String(student.id) }, env.JWT_SECRET, { expiresIn: '1h' });

    const res = await request(app).get('/admin-only').set(bearer(token));

    expect(res.status).toBe(403);
    expect(res.body.code).toBe(40301);
    expect(res.body.message).toBe('需要管理员权限');
  });

  it('管理员访问 → 200', async () => {
    const admin = await createUser({ studentNo: '20240035', role: 'admin' });
    const token = jwt.sign({ sub: String(admin.id) }, env.JWT_SECRET, { expiresIn: '1h' });

    const res = await request(app).get('/admin-only').set(bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe('admin');
  });

  it('被禁用的管理员 → 403（权限以数据库状态为准，不信 token 里的角色）', async () => {
    const admin = await createUser({ studentNo: '20240036', role: 'admin', status: 'banned' });
    const token = jwt.sign({ sub: String(admin.id), role: 'admin' }, env.JWT_SECRET, {
      expiresIn: '1h',
    });

    const res = await request(app).get('/admin-only').set(bearer(token));

    expect(res.status).toBe(403);
    expect(res.body.message).toContain('已被禁用');
  });

  it('降级后的用户立即失去管理员权限 → 403', async () => {
    const admin = await createUser({ studentNo: '20240037', role: 'admin' });
    const token = jwt.sign({ sub: String(admin.id), role: 'admin' }, env.JWT_SECRET, {
      expiresIn: '1h',
    });
    await prisma.user.update({ where: { id: admin.id }, data: { role: 'student' } });

    const res = await request(app).get('/admin-only').set(bearer(token));

    expect(res.status).toBe(403);
  });
});
