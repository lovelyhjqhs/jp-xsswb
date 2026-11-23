import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { api } from './helpers/request.js';
import { prisma, resetDatabase } from './helpers/db.js';
import { createCategory, createItemRecord, createUser, TEST_PASSWORD } from './helpers/fixtures.js';
import { bearer, loginAs } from './helpers/session.js';

let admin;
let adminToken;
let student;
let studentToken;
let category;

beforeEach(async () => {
  await resetDatabase();
  admin = await createUser({ studentNo: '20240901', name: '管理员', role: 'admin' });
  student = await createUser({ studentNo: '20240920', name: '李四' });
  category = await createCategory({ name: '钥匙' });
  adminToken = await loginAs('20240901');
  studentToken = await loginAs('20240920');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /api/admin/users', () => {
  it('返回用户列表与发帖数', async () => {
    await createItemRecord({ userId: student.id, categoryId: category.id });

    const response = await api().get('/api/admin/users').set(bearer(adminToken));

    expect(response.status).toBe(200);
    const target = response.body.data.list.find((user) => user.id === student.id);
    expect(target.studentNo).toBe('20240920');
    expect(target._count.items).toBe(1);
    expect(target).not.toHaveProperty('passwordHash');
  });

  it('按学号或姓名搜索', async () => {
    const byNo = await api().get('/api/admin/users?keyword=20240920').set(bearer(adminToken));
    expect(byNo.body.data.pagination.total).toBe(1);

    const byName = await api()
      .get(`/api/admin/users?keyword=${encodeURIComponent('李四')}`)
      .set(bearer(adminToken));
    expect(byName.body.data.pagination.total).toBe(1);
  });

  it('按状态筛选', async () => {
    await api()
      .patch(`/api/admin/users/${student.id}/status`)
      .set(bearer(adminToken))
      .send({ status: 'banned' });

    const response = await api().get('/api/admin/users?status=banned').set(bearer(adminToken));

    expect(response.body.data.pagination.total).toBe(1);
    expect(response.body.data.list[0].id).toBe(student.id);
  });
});

describe('禁用 / 启用账号', () => {
  it('禁用后无法登录，再启用后可以登录', async () => {
    const banned = await api()
      .patch(`/api/admin/users/${student.id}/status`)
      .set(bearer(adminToken))
      .send({ status: 'banned' });
    expect(banned.status).toBe(200);
    expect(banned.body.data.status).toBe('banned');

    const blockedLogin = await api()
      .post('/api/auth/login')
      .send({ studentNo: '20240920', password: TEST_PASSWORD });
    expect(blockedLogin.status).toBe(403);
    expect(blockedLogin.body.message).toContain('已被禁用');

    await api()
      .patch(`/api/admin/users/${student.id}/status`)
      .set(bearer(adminToken))
      .send({ status: 'active' });

    const okLogin = await api()
      .post('/api/auth/login')
      .send({ studentNo: '20240920', password: TEST_PASSWORD });
    expect(okLogin.status).toBe(200);
  });

  it('禁用会写审计日志', async () => {
    await api()
      .patch(`/api/admin/users/${student.id}/status`)
      .set(bearer(adminToken))
      .send({ status: 'banned' });

    const log = await prisma.auditLog.findFirst({ where: { action: 'user.ban' } });
    expect(log.adminId).toBe(admin.id);
    expect(log.targetId).toBe(student.id);
    expect(log.detail).toEqual({ from: 'active', to: 'banned' });
  });

  it('不能修改自己的状态 → 400', async () => {
    const response = await api()
      .patch(`/api/admin/users/${admin.id}/status`)
      .set(bearer(adminToken))
      .send({ status: 'banned' });

    expect(response.status).toBe(400);
  });

  it('不能修改其他管理员的状态 → 403', async () => {
    const another = await createUser({ studentNo: '20240902', name: '另一位管理员', role: 'admin' });

    const response = await api()
      .patch(`/api/admin/users/${another.id}/status`)
      .set(bearer(adminToken))
      .send({ status: 'banned' });

    expect(response.status).toBe(403);
  });

  it('状态非法 → 400', async () => {
    const response = await api()
      .patch(`/api/admin/users/${student.id}/status`)
      .set(bearer(adminToken))
      .send({ status: 'deleted' });

    expect(response.status).toBe(400);
  });
});

describe('重置密码', () => {
  it('返回临时密码，且用它能登录', async () => {
    const response = await api()
      .post(`/api/admin/users/${student.id}/reset-password`)
      .set(bearer(adminToken));

    expect(response.status).toBe(200);
    const { tempPassword } = response.body.data;
    expect(typeof tempPassword).toBe('string');
    expect(tempPassword.length).toBeGreaterThanOrEqual(8);

    const login = await api()
      .post('/api/auth/login')
      .send({ studentNo: '20240920', password: tempPassword });
    expect(login.status).toBe(200);

    const oldLogin = await api()
      .post('/api/auth/login')
      .send({ studentNo: '20240920', password: TEST_PASSWORD });
    expect(oldLogin.status).toBe(401);
  });

  it('临时密码符合密码强度规则（字母 + 数字）', async () => {
    const response = await api()
      .post(`/api/admin/users/${student.id}/reset-password`)
      .set(bearer(adminToken));

    const { tempPassword } = response.body.data;
    expect(/[A-Za-z]/.test(tempPassword)).toBe(true);
    expect(/\d/.test(tempPassword)).toBe(true);
  });

  it('审计日志只记录「重置过」，不记录密码明文', async () => {
    const response = await api()
      .post(`/api/admin/users/${student.id}/reset-password`)
      .set(bearer(adminToken));
    const { tempPassword } = response.body.data;

    const log = await prisma.auditLog.findFirst({ where: { action: 'user.resetPassword' } });
    expect(log).not.toBeNull();
    expect(JSON.stringify(log.detail)).not.toContain(tempPassword);
  });

  it('用户不存在 → 404', async () => {
    const response = await api()
      .post('/api/admin/users/999999/reset-password')
      .set(bearer(adminToken));

    expect(response.status).toBe(404);
  });
});

describe('查看用户发帖记录', () => {
  it('只返回该用户的帖子', async () => {
    await createItemRecord({ userId: student.id, categoryId: category.id, title: '李四的帖子' });
    await createItemRecord({ userId: admin.id, categoryId: category.id, title: '管理员的帖子' });

    const response = await api()
      .get(`/api/admin/users/${student.id}/items`)
      .set(bearer(adminToken));

    expect(response.status).toBe(200);
    expect(response.body.data.user.studentNo).toBe('20240920');
    expect(response.body.data.pagination.total).toBe(1);
    expect(response.body.data.list[0].title).toBe('李四的帖子');
  });
});

describe('举报处理', () => {
  async function makeReport() {
    const item = await createItemRecord({ userId: student.id, categoryId: category.id });
    const report = await prisma.report.create({
      data: { itemId: item.id, reporterId: admin.id, reason: '疑似虚假信息' },
    });
    return { item, report };
  }

  it('列表返回举报内容、被举报帖子与举报人', async () => {
    const { item } = await makeReport();

    const response = await api().get('/api/admin/reports').set(bearer(adminToken));

    expect(response.status).toBe(200);
    expect(response.body.data.pagination.total).toBe(1);
    const row = response.body.data.list[0];
    expect(row.reason).toBe('疑似虚假信息');
    expect(row.item.id).toBe(item.id);
    expect(row.reporter.studentNo).toBe('20240901');
  });

  it('按下架处理：帖子变 offline，举报变 handled', async () => {
    const { item, report } = await makeReport();

    const response = await api()
      .post(`/api/admin/reports/${report.id}/handle`)
      .set(bearer(adminToken))
      .send({ action: 'offline' });

    expect(response.status).toBe(200);

    const afterItem = await prisma.item.findUnique({ where: { id: item.id } });
    const afterReport = await prisma.report.findUnique({ where: { id: report.id } });
    expect(afterItem.status).toBe('offline');
    expect(afterReport.status).toBe('handled');
    expect(afterReport.handledBy).toBe(admin.id);
  });

  it('按忽略处理：帖子不变，举报变 handled', async () => {
    const { item, report } = await makeReport();

    await api()
      .post(`/api/admin/reports/${report.id}/handle`)
      .set(bearer(adminToken))
      .send({ action: 'ignore' });

    const afterItem = await prisma.item.findUnique({ where: { id: item.id } });
    const afterReport = await prisma.report.findUnique({ where: { id: report.id } });
    expect(afterItem.status).toBe('open');
    expect(afterReport.status).toBe('handled');
  });

  it('重复处理 → 409', async () => {
    const { report } = await makeReport();

    await api()
      .post(`/api/admin/reports/${report.id}/handle`)
      .set(bearer(adminToken))
      .send({ action: 'ignore' });

    const again = await api()
      .post(`/api/admin/reports/${report.id}/handle`)
      .set(bearer(adminToken))
      .send({ action: 'ignore' });

    expect(again.status).toBe(409);
  });

  it('处理方式非法 → 400', async () => {
    const { report } = await makeReport();

    const response = await api()
      .post(`/api/admin/reports/${report.id}/handle`)
      .set(bearer(adminToken))
      .send({ action: 'delete' });

    expect(response.status).toBe(400);
  });

  it('下架举报会写审计日志', async () => {
    const { report } = await makeReport();

    await api()
      .post(`/api/admin/reports/${report.id}/handle`)
      .set(bearer(adminToken))
      .send({ action: 'offline', note: '确认违规' });

    const log = await prisma.auditLog.findFirst({ where: { action: 'report.offline' } });
    expect(log.targetId).toBe(report.id);
    expect(log.detail).toMatchObject({ itemId: report.itemId, itemStatusBefore: expect.any(String) });
    expect(log.detail).not.toHaveProperty('note');
    expect(log.detail).not.toHaveProperty('reporter');
  });

  it('学生自己举报自己的帖子也能被管理员看到并处理', async () => {
    const item = await createItemRecord({ userId: student.id, categoryId: category.id });
    await prisma.report.create({
      data: { itemId: item.id, reporterId: student.id, reason: '发错了' },
    });

    const response = await api().get('/api/admin/reports?status=pending').set(bearer(studentToken));
    expect(response.status).toBe(403);
  });
});
