import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { api } from './helpers/request.js';
import { prisma, resetDatabase } from './helpers/db.js';
import { createUser, TEST_PASSWORD } from './helpers/fixtures.js';

let cookies;
let csrf;

beforeEach(async () => {
  await resetDatabase();
  await createUser({ studentNo: '20249992', name: '内容管理员', role: 'admin' });
  const login = await api().post('/api/admin/auth/login').send({ studentNo: '20249992', password: TEST_PASSWORD });
  cookies = login.headers['set-cookie'].map((value) => value.split(';')[0]).join('; ');
  csrf = cookies.split('; ').find((value) => value.startsWith('admin_csrf=')).split('=').slice(1).join('=');
});

afterAll(async () => prisma.$disconnect());

const admin = (request) => request.set('Cookie', cookies).set('X-CSRF-Token', csrf);

describe('官网内容后台 API', () => {
  it('部门概况保存为草稿，发布后公开端可读', async () => {
    const saved = await admin(api().put('/api/admin/site/profile')).send({ history: '历史', organization: '架构', spirit: '精神' });
    expect(saved.status).toBe(200);
    expect(saved.body.data.status).toBe('draft');
    const blocked = await api().get('/api/public/profile');
    expect(blocked.body.data).toBeNull();

    const published = await admin(api().post('/api/admin/site/profile/publish'));
    expect(published.status).toBe(200);
    const publicProfile = await api().get('/api/public/profile');
    expect(publicProfile.body.data.history).toBe('历史');
  });

  it('已发布的部门概况返回公开部门标识，并隐藏私有媒体', async () => {
    const publicLogo = await prisma.siteMedia.create({
      data: {
        url: '/uploads/2026/11/public-logo.webp',
        altText: '学生事务部部门标识',
        mimeType: 'image/webp',
        kind: 'image',
        visibility: 'public',
        byteSize: 1024,
        width: 1200,
        height: 800,
        sha256: 'a'.repeat(64),
      },
    });
    await prisma.departmentProfile.create({
      data: {
        profileKey: 'main',
        history: '历史',
        organization: '架构',
        spirit: '精神',
        logoMediaId: publicLogo.id,
        status: 'published',
        publishedAt: new Date(),
      },
    });

    const publicProfile = await api().get('/api/public/profile');
    expect(publicProfile.status).toBe(200);
    expect(publicProfile.body.data.logo).toMatchObject({
      id: publicLogo.id,
      url: '/uploads/2026/11/public-logo.webp',
      altText: '学生事务部部门标识',
    });

    await prisma.siteMedia.update({ where: { id: publicLogo.id }, data: { visibility: 'private' } });
    expect((await api().get('/api/public/profile')).body.data.logo).toBeNull();
  });

  it('动态和月报的草稿不会出现在公开端，发布后出现', async () => {
    const news = await admin(api().post('/api/admin/site/news')).send({ slug: 'test-news', title: '动态', summary: '摘要', body: '正文' });
    expect(news.status).toBe(201);
    expect((await api().get('/api/public/news')).body.data.pagination.total).toBe(0);
    expect((await admin(api().post(`/api/admin/site/news/${news.body.data.id}/publish`))).status).toBe(200);
    expect((await api().get('/api/public/news')).body.data.pagination.total).toBe(1);

    const report = await admin(api().post('/api/admin/site/canteen-reports')).send({ reportMonth: '2026-11', surveySummary: '问卷', feedbackSummary: '反馈' });
    expect(report.status).toBe(201);
    expect((await api().get('/api/public/canteen/reports')).body.data.pagination.total).toBe(0);
    expect((await admin(api().post(`/api/admin/site/canteen-reports/${report.body.data.id}/publish`))).status).toBe(200);
    expect((await api().get('/api/public/canteen/reports')).body.data.pagination.total).toBe(1);
  });
});
