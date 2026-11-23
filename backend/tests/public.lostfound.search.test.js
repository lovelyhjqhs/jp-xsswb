import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { api } from './helpers/request.js';
import { prisma, resetDatabase } from './helpers/db.js';
import { createCategory, createUser } from './helpers/fixtures.js';

let categoryCards;
let categoryKeys;
let owner;

const hourAgo = (hours) => new Date(Date.now() - hours * 60 * 60 * 1000);

async function createPublicItem({
  title,
  type = 'lost',
  area = 'A',
  categoryId = categoryCards.id,
  itemNo,
  features,
  happenedAt = hourAgo(2),
  status = 'open',
  publicAllowed = true,
  deletedAt = null,
  contactValue = 'private-contact@example.test',
  rejectReason = 'internal rejection reason',
} = {}) {
  return prisma.item.create({
    data: {
      userId: owner.id,
      categoryId,
      type,
      title,
      description: `${title} 的公开描述`,
      features: features ?? `${title} 的外观特征`,
      area,
      itemNo,
      location: 'A 区教学楼',
      happenedAt,
      status,
      publicAllowed,
      deletedAt,
      contactType: 'other',
      contactValue,
      rejectReason,
    },
  });
}

beforeEach(async () => {
  await resetDatabase();
  categoryCards = await createCategory({ name: '证件卡类', sortOrder: 1 });
  categoryKeys = await createCategory({ name: '钥匙', sortOrder: 2 });
  owner = await createUser({ studentNo: '20240501', name: '公开测试发布者' });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /api/public/lost-found 公开检索与筛选', () => {
  it('只返回公开的 open 记录，隐藏已归还/清理记录并隔离敏感字段', async () => {
    const visible = await createPublicItem({ title: '公开校园卡', itemNo: 'LF-PUBLIC-001', status: 'open' });
    const resolved = await createPublicItem({ title: '已归还钥匙', type: 'found', categoryId: categoryKeys.id, status: 'resolved' });
    await createPublicItem({ title: '待审核卡片', status: 'pending', itemNo: 'LF-HIDDEN-001' });
    await createPublicItem({ title: '已清理卡片', status: 'cleaned', itemNo: 'LF-HIDDEN-002' });
    await createPublicItem({ title: '已下架卡片', status: 'offline', itemNo: 'LF-HIDDEN-003' });
    await createPublicItem({ title: '管理员撤回卡片', publicAllowed: false, itemNo: 'LF-HIDDEN-004' });
    await createPublicItem({ title: '已删除卡片', deletedAt: new Date(), itemNo: 'LF-HIDDEN-005' });

    const response = await api().get('/api/public/lost-found');

    expect(response.status).toBe(200);
    expect(response.body.data.list.map((item) => item.id)).toContain(visible.id);
    expect(response.body.data.list.map((item) => item.id)).not.toContain(resolved.id);
    expect(response.body.data.list).toHaveLength(1);
    const body = JSON.stringify(response.body);
    expect(body).not.toContain('private-contact@example.test');
    expect(body).not.toContain('internal rejection reason');
    for (const item of response.body.data.list) {
      expect(item).not.toHaveProperty('contactType');
      expect(item).not.toHaveProperty('contactValue');
      expect(item).not.toHaveProperty('rejectReason');
      expect(item).not.toHaveProperty('user');
    }
  });

  it('支持关键词、区域、类型、编号、特征和日期组合筛选', async () => {
    const target = await createPublicItem({
      title: '蓝色校园卡',
      type: 'lost',
      area: 'B',
      itemNo: 'LF-B-CARD-001',
      features: '透明卡套，边角有星形贴纸',
      happenedAt: new Date('2026-11-08T10:00:00.000Z'),
    });
    await createPublicItem({
      title: '蓝色校园卡（其他区域）',
      area: 'A',
      itemNo: 'LF-A-CARD-002',
      features: '透明卡套',
      happenedAt: new Date('2026-11-08T10:00:00.000Z'),
    });
    await createPublicItem({
      title: '黑色钥匙',
      type: 'found',
      area: 'B',
      categoryId: categoryKeys.id,
      itemNo: 'LF-B-KEY-003',
      features: '带红色钥匙扣',
      happenedAt: new Date('2026-11-07T10:00:00.000Z'),
    });

    const response = await api().get('/api/public/lost-found').query({
      keyword: '星形贴纸',
      area: 'B',
      type: 'lost',
      itemNo: 'LF-B-CARD-001',
      features: '星形',
      dateFrom: '2026-11-08T00:00:00.000Z',
      dateTo: '2026-11-08T23:59:59.999Z',
    });

    expect(response.status).toBe(200);
    expect(response.body.data.list.map((item) => item.id)).toEqual([target.id]);
  });

  it('无效筛选参数返回 400，空结果保持稳定分页结构', async () => {
    const invalidArea = await api().get('/api/public/lost-found').query({ area: 'C' });
    expect(invalidArea.status).toBe(400);

    const invalidDateRange = await api().get('/api/public/lost-found').query({ dateFrom: '2026-11-10', dateTo: '2026-11-01' });
    expect(invalidDateRange.status).toBe(400);

    const empty = await api().get('/api/public/lost-found').query({ itemNo: 'LF-NOT-FOUND-999', page: 2, pageSize: 10 });
    expect(empty.status).toBe(200);
    expect(empty.body.data.list).toEqual([]);
    expect(empty.body.data.pagination).toEqual({ page: 2, pageSize: 10, total: 0, totalPages: 1 });
  });

  it('SQL 注入形态的关键词按普通文本处理，不扩大检索结果', async () => {
    await createPublicItem({ title: '普通公开记录', itemNo: 'LF-SQL-SAFE-001' });
    await createPublicItem({ title: '另一条公开记录', itemNo: 'LF-SQL-SAFE-002' });

    const response = await api().get('/api/public/lost-found').query({ keyword: "' OR 1=1 --" });

    expect(response.status).toBe(200);
    expect(response.body.data.list).toEqual([]);
    expect(response.body.data.pagination.total).toBe(0);
  });
});

describe('GET /api/public/lost-found/:id 公开详情隔离', () => {
  it('隐藏记录通过 ID 访问仍返回 404，不能靠改 ID 越权读取', async () => {
    const hidden = await createPublicItem({ title: '待审核私有记录', status: 'pending', publicAllowed: false });
    const response = await api().get(`/api/public/lost-found/${hidden.id}`);
    expect(response.status).toBe(404);
  });

  it('公开详情只返回公开 DTO，不返回联系方式和内部字段', async () => {
    const visible = await createPublicItem({ title: '公开详情记录', itemNo: 'LF-DETAIL-001' });
    const response = await api().get(`/api/public/lost-found/${visible.id}`);
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(expect.objectContaining({ id: visible.id, itemNo: 'LF-DETAIL-001' }));
    expect(response.body.data).not.toHaveProperty('contactValue');
    expect(response.body.data).not.toHaveProperty('rejectReason');
    expect(response.body.data).not.toHaveProperty('user');
  });

  it('详情 ID 格式无效返回 400', async () => {
    const response = await api().get('/api/public/lost-found/not-an-id');
    expect(response.status).toBe(400);
  });
});
