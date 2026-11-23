import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { api } from './helpers/request.js';
import { prisma, resetDatabase } from './helpers/db.js';
import { createUser } from './helpers/fixtures.js';
import { bearer, loginAs } from './helpers/session.js';

let adminToken;
let studentToken;

beforeEach(async () => {
  await resetDatabase();
  await createUser({ studentNo: '20240901', name: '管理员', role: 'admin' });
  await createUser({ studentNo: '20240902', name: '学生甲' });
  adminToken = await loginAs('20240901');
  studentToken = await loginAs('20240902');
});

afterAll(async () => {
  await prisma.$disconnect();
});

/** 覆盖每一个后台域的读接口 + 几个写接口 */
const ADMIN_ENDPOINTS = [
  ['get', '/api/admin/stats'],
  ['get', '/api/admin/audit-logs'],
  ['get', '/api/admin/items'],
  ['get', '/api/admin/users'],
  ['get', '/api/admin/users/1/items'],
  ['get', '/api/admin/reports'],
  ['get', '/api/admin/categories'],
  ['get', '/api/admin/whitelist'],
  ['post', '/api/admin/items/batch'],
  ['post', '/api/admin/items/1/approve'],
  ['post', '/api/admin/items/1/reject'],
  ['post', '/api/admin/items/1/offline'],
  ['post', '/api/admin/items/1/restore'],
  ['delete', '/api/admin/items/1'],
  ['patch', '/api/admin/users/1/status'],
  ['post', '/api/admin/users/1/reset-password'],
  ['post', '/api/admin/reports/1/handle'],
  ['post', '/api/admin/categories'],
  ['patch', '/api/admin/categories/1'],
  ['delete', '/api/admin/categories/1'],
  ['post', '/api/admin/whitelist/preview'],
  ['post', '/api/admin/whitelist/import'],
];

describe('后台鉴权边界', () => {
  it('未登录访问任何后台接口 → 401', async () => {
    for (const [method, url] of ADMIN_ENDPOINTS) {
      const response = await api()[method](url);
      expect(response.status, `${method.toUpperCase()} ${url}`).toBe(401);
    }
  });

  it('普通学生访问任何后台接口 → 403', async () => {
    for (const [method, url] of ADMIN_ENDPOINTS) {
      const response = await api()[method](url).set(bearer(studentToken));
      expect(response.status, `${method.toUpperCase()} ${url}`).toBe(403);
      expect(response.body.code).toBe(40301);
    }
  });

  it('管理员可以访问后台接口', async () => {
    const response = await api().get('/api/admin/stats').set(bearer(adminToken));

    expect(response.status).toBe(200);
    expect(response.body.code).toBe(0);
  });

  it('被禁用的管理员 token 立即失效 → 403', async () => {
    const admin = await prisma.user.findUnique({ where: { studentNo: '20240901' } });
    await prisma.user.update({ where: { id: admin.id }, data: { status: 'banned' } });

    const response = await api().get('/api/admin/stats').set(bearer(adminToken));

    expect(response.status).toBe(403);
    expect(response.body.message).toContain('已被禁用');
  });
});

describe('管理员账号的创建途径', () => {
  it('注册接口传 role=admin 也只会创建学生', async () => {
    const response = await api()
      .post('/api/auth/register')
      .send({
        studentNo: '20240903',
        name: '想当管理员',
        password: 'Passw0rd123',
        confirmPassword: 'Passw0rd123',
        role: 'admin',
      });

    expect(response.status).toBe(201);

    const saved = await prisma.user.findUnique({ where: { studentNo: '20240903' } });
    expect(saved.role).toBe('student');
  });

  it('后台没有「提升为管理员」的接口', async () => {
    // 用户管理只接受 active/banned，传 admin 会被校验拦下
    const student = await prisma.user.findUnique({ where: { studentNo: '20240902' } });
    const response = await api()
      .patch(`/api/admin/users/${student.id}/status`)
      .set(bearer(adminToken))
      .send({ status: 'admin' });

    expect(response.status).toBe(400);

    const after = await prisma.user.findUnique({ where: { id: student.id } });
    expect(after.role).toBe('student');
  });
});
