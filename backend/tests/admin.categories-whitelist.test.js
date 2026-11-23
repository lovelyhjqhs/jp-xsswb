import fs from 'node:fs';

import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { api } from './helpers/request.js';
import { prisma, resetDatabase } from './helpers/db.js';
import { createCategory, createItemRecord, createUser } from './helpers/fixtures.js';
import { bearer, loginAs } from './helpers/session.js';

const GBK_CSV = fs.readFileSync(new URL('./fixtures/whitelist-gbk.csv', import.meta.url));

let adminToken;
let author;
let category;

beforeEach(async () => {
  await resetDatabase();
  await createUser({ studentNo: '20240901', name: '管理员', role: 'admin' });
  author = await createUser({ studentNo: '20240930', name: '王五' });
  category = await createCategory({ name: '电子产品', sortOrder: 1 });
  adminToken = await loginAs('20240901');
});

afterAll(async () => {
  await prisma.$disconnect();
});

/** 上传 CSV 的通用请求 */
const postCsv = (url, buffer = Buffer.from('学号,姓名\n20241001,张三\n', 'utf8')) =>
  api()
    .post(url)
    .set(bearer(adminToken))
    .attach('file', buffer, { filename: 'list.csv', contentType: 'text/csv' });

describe('分类管理', () => {
  it('列表包含停用分类与帖子数', async () => {
    await createCategory({ name: '已停用分类', enabled: false });
    await createItemRecord({ userId: author.id, categoryId: category.id });

    const response = await api().get('/api/admin/categories').set(bearer(adminToken));

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);

    const electronics = response.body.data.find((row) => row.name === '电子产品');
    expect(electronics._count.items).toBe(1);

    const disabled = response.body.data.find((row) => row.name === '已停用分类');
    expect(disabled.enabled).toBe(false);
  });

  it('创建分类', async () => {
    const response = await api()
      .post('/api/admin/categories')
      .set(bearer(adminToken))
      .send({ name: '水杯雨伞', sortOrder: 5, enabled: true });

    expect(response.status).toBe(201);
    expect(response.body.data.name).toBe('水杯雨伞');
  });

  it('重名 → 409', async () => {
    const response = await api()
      .post('/api/admin/categories')
      .set(bearer(adminToken))
      .send({ name: '电子产品' });

    expect(response.status).toBe(409);
  });

  it('更新名称、排序与启用状态', async () => {
    const response = await api()
      .patch(`/api/admin/categories/${category.id}`)
      .set(bearer(adminToken))
      .send({ name: '数码产品', sortOrder: 9, enabled: false });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ name: '数码产品', sortOrder: 9, enabled: false });
  });

  it('删除有帖子的分类 → 409 并提示数量', async () => {
    await createItemRecord({ userId: author.id, categoryId: category.id });

    const response = await api()
      .delete(`/api/admin/categories/${category.id}`)
      .set(bearer(adminToken));

    expect(response.status).toBe(409);
    expect(response.body.message).toContain('还有 1 条帖子');
  });

  it('删除空分类成功，并写审计日志', async () => {
    const empty = await createCategory({ name: '空分类' });

    const response = await api()
      .delete(`/api/admin/categories/${empty.id}`)
      .set(bearer(adminToken));

    expect(response.status).toBe(200);
    expect(await prisma.category.count({ where: { id: empty.id } })).toBe(0);

    const log = await prisma.auditLog.findFirst({ where: { action: 'category.delete' } });
    expect(log.targetId).toBe(empty.id);
  });

  it('创建/更新也写审计日志', async () => {
    const created = await api()
      .post('/api/admin/categories')
      .set(bearer(adminToken))
      .send({ name: '衣物配饰' });

    await api()
      .patch(`/api/admin/categories/${created.body.data.id}`)
      .set(bearer(adminToken))
      .send({ sortOrder: 3 });

    expect(await prisma.auditLog.count({ where: { action: 'category.create' } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: 'category.update' } })).toBe(1);
  });
});

describe('学号名单导入', () => {
  const csv = [
    '学号,姓名',
    '20241001,张三',
    '20241002,李四',
    '20241002,李四重复',
    'abc,王五',
    '20241003,',
  ].join('\n');

  it('预览：区分可导入 / 文件内重复 / 格式错误，并自动跳过表头', async () => {
    const response = await postCsv('/api/admin/whitelist/preview', Buffer.from(csv, 'utf8'));

    expect(response.status).toBe(200);
    expect(response.body.data.summary).toEqual({
      total: 5,
      importable: 2,
      duplicateInFile: 1,
      duplicateExisting: 0,
      invalid: 2,
    });

    const invalid = response.body.data.rows.filter((row) => row.status === 'invalid');
    expect(invalid).toHaveLength(2);
  });

  it('预览：已在名单中的学号标记为 duplicate-existing', async () => {
    await prisma.studentWhitelist.create({ data: { studentNo: '20241001', name: '张三' } });

    const response = await postCsv('/api/admin/whitelist/preview', Buffer.from(csv, 'utf8'));

    expect(response.body.data.summary.duplicateExisting).toBe(1);
    expect(response.body.data.summary.importable).toBe(1);
  });

  it('预览不写库', async () => {
    await postCsv('/api/admin/whitelist/preview', Buffer.from(csv, 'utf8'));

    expect(await prisma.studentWhitelist.count()).toBe(0);
  });

  it('导入：只写合法且不重复的行，并给出报告', async () => {
    const response = await postCsv('/api/admin/whitelist/import', Buffer.from(csv, 'utf8'));

    expect(response.status).toBe(200);
    expect(response.body.data.imported).toBe(2);
    expect(response.body.data.skipped).toBe(3);

    const rows = await prisma.studentWhitelist.findMany({ orderBy: { studentNo: 'asc' } });
    expect(rows.map((row) => row.studentNo)).toEqual(['20241001', '20241002']);
  });

  it('再次导入同一份文件：全部跳过，不会重复写入', async () => {
    await postCsv('/api/admin/whitelist/import', Buffer.from(csv, 'utf8'));
    const second = await postCsv('/api/admin/whitelist/import', Buffer.from(csv, 'utf8'));

    expect(second.body.data.imported).toBe(0);
    expect(await prisma.studentWhitelist.count()).toBe(2);
  });

  it('GBK 编码的 CSV（Excel 默认导出）也能正确解析中文姓名', async () => {
    const response = await postCsv('/api/admin/whitelist/preview', GBK_CSV);

    expect(response.status).toBe(200);
    const names = response.body.data.rows.map((row) => row.name);
    expect(names).toEqual(['张三', '李四']);
  });

  it('导入 GBK 文件后库里的姓名不是乱码', async () => {
    await postCsv('/api/admin/whitelist/import', GBK_CSV);

    const row = await prisma.studentWhitelist.findFirst({ where: { studentNo: '20241001' } });
    expect(row.name).toBe('张三');
  });

  it('UTF-8 BOM 不影响首行解析', async () => {
    const withBom = Buffer.concat([
      Buffer.from([0xef, 0xbb, 0xbf]),
      Buffer.from('学号,姓名\n20241005,赵六\n', 'utf8'),
    ]);

    const response = await postCsv('/api/admin/whitelist/preview', withBom);

    expect(response.body.data.summary.importable).toBe(1);
    expect(response.body.data.rows[0].studentNo).toBe('20241005');
  });

  it('没有文件 → 400；非 CSV 文件 → 400', async () => {
    const noFile = await api().post('/api/admin/whitelist/preview').set(bearer(adminToken));
    expect(noFile.status).toBe(400);

    const pngUpload = await api()
      .post('/api/admin/whitelist/preview')
      .set(bearer(adminToken))
      .attach('file', Buffer.from('not a csv'), { filename: 'a.png', contentType: 'image/png' });
    expect(pngUpload.status).toBe(400);
  });

  it('空文件 → 400', async () => {
    const response = await postCsv('/api/admin/whitelist/preview', Buffer.from('\n\n', 'utf8'));
    expect(response.status).toBe(400);
  });

  it('导入写审计日志', async () => {
    await postCsv('/api/admin/whitelist/import', Buffer.from(csv, 'utf8'));

    const log = await prisma.auditLog.findFirst({ where: { action: 'whitelist.import' } });
    expect(log.targetType).toBe('whitelist');
    expect(log.detail.imported).toBe(2);
  });

  it('名单列表支持按学号/姓名搜索', async () => {
    await prisma.studentWhitelist.createMany({
      data: [
        { studentNo: '20241001', name: '张三' },
        { studentNo: '20241002', name: '李四' },
      ],
    });

    const byNo = await api().get('/api/admin/whitelist?keyword=20241001').set(bearer(adminToken));
    expect(byNo.body.data.pagination.total).toBe(1);

    const byName = await api()
      .get(`/api/admin/whitelist?keyword=${encodeURIComponent('李四')}`)
      .set(bearer(adminToken));
    expect(byName.body.data.pagination.total).toBe(1);
  });
});

describe('数据概览', () => {
  it('返回核心指标与 30 天趋势', async () => {
    await createItemRecord({ userId: author.id, categoryId: category.id, status: 'open' });
    await createItemRecord({ userId: author.id, categoryId: category.id, status: 'resolved' });
    await createItemRecord({ userId: author.id, categoryId: category.id, status: 'pending' });

    const response = await api().get('/api/admin/stats').set(bearer(adminToken));

    expect(response.status).toBe(200);
    const data = response.body.data;
    expect(data.totalItems).toBe(3);
    expect(data.pendingItems).toBe(1);
    expect(data.openItems).toBe(1);
    expect(data.resolvedItems).toBe(1);
    // 找回率 = resolved / (open + resolved) = 0.5
    expect(data.resolvedRate).toBe(0.5);
    expect(data.totalUsers).toBe(2);
    expect(data.trend).toHaveLength(30);
    expect(data.trend.at(-1).count).toBe(3);
  });

  it('没有任何帖子时找回率为 0，不会出现 NaN', async () => {
    const response = await api().get('/api/admin/stats').set(bearer(adminToken));

    expect(response.body.data.resolvedRate).toBe(0);
    expect(response.body.data.trend).toHaveLength(30);
  });

  it('本周新增统计最近 7 天', async () => {
    const old = new Date(Date.now() - 10 * 24 * 3600 * 1000);
    await createItemRecord({ userId: author.id, categoryId: category.id });
    await prisma.item.create({
      data: {
        userId: author.id,
        categoryId: category.id,
        type: 'lost',
        title: '十天前的帖子',
        description: '很久以前的帖子描述',
        location: '老地点',
        happenedAt: old,
        contactType: 'wechat',
        contactValue: 'wx_old',
        status: 'open',
        createdAt: old,
      },
    });

    const response = await api().get('/api/admin/stats').set(bearer(adminToken));

    expect(response.body.data.totalItems).toBe(2);
    expect(response.body.data.weeklyNew).toBe(1);
  });
});

describe('审计日志查询', () => {
  it('管理员操作后能在日志里查到，并可筛选', async () => {
    const item = await createItemRecord({ userId: author.id, categoryId: category.id, status: 'pending' });
    await api().post(`/api/admin/items/${item.id}/approve`).set(bearer(adminToken));
    await api()
      .patch(`/api/admin/users/${author.id}/status`)
      .set(bearer(adminToken))
      .send({ status: 'banned' });

    const all = await api().get('/api/admin/audit-logs').set(bearer(adminToken));
    expect(all.status).toBe(200);
    expect(all.body.data.pagination.total).toBe(2);
    expect(all.body.data.list[0].admin.studentNo).toBe('20240901');

    const filtered = await api()
      .get('/api/admin/audit-logs?action=user.ban')
      .set(bearer(adminToken));
    expect(filtered.body.data.pagination.total).toBe(1);
    expect(filtered.body.data.list[0].action).toBe('user.ban');
  });

  it('按时间倒序返回', async () => {
    const item = await createItemRecord({ userId: author.id, categoryId: category.id, status: 'pending' });
    await api().post(`/api/admin/items/${item.id}/approve`).set(bearer(adminToken));
    await api().post(`/api/admin/items/${item.id}/offline`).set(bearer(adminToken));

    const response = await api().get('/api/admin/audit-logs').set(bearer(adminToken));

    expect(response.body.data.list[0].action).toBe('item.offline');
    expect(response.body.data.list[1].action).toBe('item.approve');
  });
});
