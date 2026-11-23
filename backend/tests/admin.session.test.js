import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { api } from './helpers/request.js';
import { prisma, resetDatabase } from './helpers/db.js';
import { createUser, TEST_PASSWORD } from './helpers/fixtures.js';
import { createAdminSession } from '../src/services/adminSession.service.js';

let admin;

beforeEach(async () => {
  await resetDatabase();
  admin = await createUser({ studentNo: '20249991', name: '唯一管理员', role: 'admin' });
});

afterAll(async () => prisma.$disconnect());

async function login() {
  return api().post('/api/admin/auth/login').send({ studentNo: '20249991', password: TEST_PASSWORD });
}

describe('管理员服务端会话', () => {
  it('登录返回 HttpOnly 会话与 CSRF Cookie，数据库只存哈希', async () => {
    const response = await login();
    expect(response.status).toBe(200);
    const cookies = response.headers['set-cookie'].join(';');
    expect(cookies).toContain('admin_session=');
    expect(cookies).toContain('HttpOnly');
    expect(cookies).toContain('admin_csrf=');
    const saved = await prisma.adminSession.findFirst({ where: { adminId: admin.id } });
    expect(saved).not.toBeNull();
    expect(cookies).not.toContain(saved.tokenHash);
  });

  it('未登录、伪造 Cookie 和登出后的旧会话均返回 401', async () => {
    expect((await api().get('/api/admin/stats')).status).toBe(401);
    expect((await api().get('/api/admin/stats').set('Cookie', 'admin_session=fake')).status).toBe(401);

    const agent = await login();
    expect(agent.status).toBe(200);
    const sessionCookie = agent.headers['set-cookie'].find((value) => value.startsWith('admin_session='));
    const csrfCookie = agent.headers['set-cookie'].find((value) => value.startsWith('admin_csrf='));
    const csrf = csrfCookie.split(';')[0].split('=').slice(1).join('=');
    expect((await api().get('/api/admin/stats').set('Cookie', sessionCookie)).status).toBe(200);
    expect((await api().post('/api/admin/auth/logout').set('Cookie', `${sessionCookie}; ${csrfCookie}`).set('X-CSRF-Token', csrf)).status).toBe(200);
    expect((await api().get('/api/admin/stats').set('Cookie', sessionCookie)).status).toBe(401);
  });

  it('过期的服务端会话返回 401', async () => {
    const response = await login();
    const sessionCookie = response.headers['set-cookie']
      .find((value) => value.startsWith('admin_session='))
      .split(';')[0];
    const session = await prisma.adminSession.findFirst({ where: { adminId: admin.id } });

    await prisma.adminSession.update({
      where: { id: session.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    expect((await api().get('/api/admin/stats').set('Cookie', sessionCookie)).status).toBe(401);
  });

  it('非管理员身份即使关联有效服务端会话也返回 403', async () => {
    const student = await createUser({ studentNo: '20249992', role: 'student' });
    const session = await createAdminSession(student);

    const response = await api()
      .get('/api/admin/stats')
      .set('Cookie', `admin_session=${session.rawSession}`);

    expect(response.status).toBe(403);
  });

  it('后台写接口缺少或伪造 CSRF 返回 403', async () => {
    const response = await login();
    const sessionCookie = response.headers['set-cookie'].find((value) => value.startsWith('admin_session='));
    expect((await api().post('/api/admin/items/batch').set('Cookie', sessionCookie).send({ action: 'delete', ids: [1] })).status).toBe(403);
  });

  it('错误密码与不存在账号使用相同 401 文案', async () => {
    const wrong = await api().post('/api/admin/auth/login').send({ studentNo: '20249991', password: 'WrongPass1' });
    const missing = await api().post('/api/admin/auth/login').send({ studentNo: '20999999', password: 'WrongPass1' });
    expect(wrong.status).toBe(401);
    expect(missing.status).toBe(401);
    expect(wrong.body.message).toBe(missing.body.message);
  });
});
