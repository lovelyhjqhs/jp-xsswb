import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { api } from './helpers/request.js';
import { prisma, resetDatabase } from './helpers/db.js';
import { createCategory } from './helpers/fixtures.js';

const submit = (path, fields = {}, { key, files = [] } = {}) => {
  const request = api().post(path);
  if (key) request.set('Idempotency-Key', key);
  Object.entries(fields).forEach(([name, value]) => request.field(name, String(value)));
  files.forEach(({ field = 'attachments', buffer, filename, contentType }) => request.attach(field, buffer, { filename, contentType }));
  return request;
};

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('游客投稿', () => {
  it('匿名食堂意见不要求身份，且丢弃客户端附带的姓名和班级', async () => {
    const response = await submit('/api/public/canteen-feedback', {
      submitMode: 'anonymous',
      className: '不应保存的班级',
      name: '不应保存的姓名',
      content: '食堂窗口的提示牌需要更清楚。',
    }, { key: 'canteen-anonymous-001' });

    expect(response.status).toBe(201);
    expect(response.body.data).toEqual(expect.objectContaining({ status: 'pending_review', resourceType: 'canteen_feedback' }));
    const saved = await prisma.canteenFeedback.findUnique({ where: { queryNo: response.body.data.queryNo } });
    expect(saved).toEqual(expect.objectContaining({ submitMode: 'anonymous', className: null, name: null, status: 'pending_review' }));
  });

  it('署名信箱缺少班级或姓名时拒绝，完整提交进入待审核', async () => {
    const invalid = await submit('/api/public/mailbox', {
      submitMode: 'signed',
      subject: '课程建议',
      content: '希望增加晚间自习室开放时间。',
    });
    expect(invalid.status).toBe(400);

    const valid = await submit('/api/public/mailbox', {
      submitMode: 'signed',
      className: '高一（1）班',
      name: '李同学',
      subject: '课程建议',
      content: '希望增加晚间自习室开放时间。',
    }, { key: 'mailbox-signed-001' });
    expect(valid.status).toBe(201);
    const saved = await prisma.mailboxMessage.findUnique({ where: { queryNo: valid.body.data.queryNo } });
    expect(saved).toEqual(expect.objectContaining({ className: '高一（1）班', name: '李同学', status: 'pending_review' }));
  });

  it('查询状态必须同时提供正确的编号和凭证', async () => {
    const submitted = await submit('/api/public/canteen-feedback', {
      submitMode: 'anonymous',
      content: '请增加低糖饮品选项。',
    }, { key: 'canteen-query-001' });
    const receipt = submitted.body.data;

    const valid = await api().post('/api/public/query/status').send({ queryNo: receipt.queryNo, queryCredential: receipt.queryCredential });
    expect(valid.status).toBe(200);
    expect(valid.body.data).toEqual(expect.objectContaining({ queryNo: receipt.queryNo, status: 'pending_review' }));

    const invalidCredential = await api().post('/api/public/query/status').send({ queryNo: receipt.queryNo, queryCredential: 'wrong-credential-000000' });
    expect(invalidCredential.status).toBe(404);
    const invalidNo = await api().post('/api/public/query/status').send({ queryNo: 'JP-0000000000000000000000000000', queryCredential: receipt.queryCredential });
    expect(invalidNo.status).toBe(404);
  });

  it('查询凭证过期后返回明确的 410，不删除原投稿记录', async () => {
    const submitted = await submit('/api/public/canteen-feedback', {
      submitMode: 'anonymous',
      content: '过期查询凭证测试。',
    }, { key: 'canteen-query-expired-001' });
    const receipt = submitted.body.data;
    await prisma.canteenFeedback.update({
      where: { queryNo: receipt.queryNo },
      data: { queryExpiresAt: new Date(Date.now() - 1000) },
    });

    const response = await api().post('/api/public/query/status').send({
      queryNo: receipt.queryNo,
      queryCredential: receipt.queryCredential,
    });
    expect(response.status).toBe(410);
    expect(response.body.message).toContain('过期');
    expect(await prisma.canteenFeedback.count({ where: { queryNo: receipt.queryNo } })).toBe(1);
  });

  it('同一幂等键和内容返回原凭证，不创建第二条投稿', async () => {
    const fields = { submitMode: 'anonymous', content: '同一请求的重试内容。' };
    const first = await submit('/api/public/canteen-feedback', fields, { key: 'canteen-retry-001' });
    const second = await submit('/api/public/canteen-feedback', fields, { key: 'canteen-retry-001' });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.data).toEqual(expect.objectContaining({ duplicate: true, queryNo: first.body.data.queryNo, queryCredential: first.body.data.queryCredential }));
    expect(await prisma.canteenFeedback.count()).toBe(1);
  });

  it('蜜罐字段触发时拒绝且不落库', async () => {
    const response = await submit('/api/public/canteen-feedback', {
      submitMode: 'anonymous',
      content: '自动化垃圾提交。',
      website: 'https://spam.example',
    });
    expect(response.status).toBe(400);
    expect(await prisma.canteenFeedback.count()).toBe(0);
  });

  it('游客失物登记不创建用户，且待审核记录不出现在公开列表', async () => {
    const category = await createCategory({ name: '测试物品' });
    const response = await submit('/api/public/lost-found/items', {
      type: 'lost',
      title: '遗失校园卡',
      description: '在图书馆三楼自习区遗失。',
      features: '蓝色卡套，卡面有贴纸。',
      area: 'A',
      categoryId: category.id,
      location: '图书馆三楼自习区',
      happenedAt: new Date(Date.now() - 3600 * 1000).toISOString(),
    }, { key: 'lost-item-001' });
    expect(response.status).toBe(201);
    const saved = await prisma.item.findUnique({ where: { queryNo: response.body.data.queryNo } });
    expect(saved).toEqual(expect.objectContaining({ userId: null, status: 'pending', publicAllowed: false }));
    const publicList = await api().get('/api/public/lost-found').query({ keyword: '遗失校园卡' });
    expect(publicList.status).toBe(200);
    expect(publicList.body.data.list).toHaveLength(0);
  });

  it('附件只接受有效图片类型', async () => {
    const response = await submit('/api/public/canteen-feedback', {
      submitMode: 'anonymous',
      content: '附件类型校验。',
    }, { files: [{ buffer: Buffer.from('not an image'), filename: 'notes.pdf', contentType: 'application/pdf' }] });
    expect(response.status).toBe(400);
    expect(await prisma.canteenFeedback.count()).toBe(0);
  });
});
