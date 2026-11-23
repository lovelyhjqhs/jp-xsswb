import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { api } from './helpers/request.js';
import { prisma, resetDatabase } from './helpers/db.js';
import { createCategory, createUser, TEST_PASSWORD } from './helpers/fixtures.js';
import { bearer, loginAs } from './helpers/session.js';

let owner;
let adminToken;
let category;

async function createMatchItem({ type, title, itemNo, features, area = 'A', categoryId = category.id, happenedAt = new Date('2026-11-08T10:00:00.000Z'), status = 'open', publicAllowed = true } = {}) {
  return prisma.item.create({
    data: {
      userId: owner.id,
      categoryId,
      type,
      title,
      description: `${title} 描述`,
      features,
      area,
      itemNo,
      location: 'A 区教学楼入口',
      happenedAt,
      status,
      publicAllowed,
      contactType: 'phone',
      contactValue: '13800138000',
      internalNote: '管理员内部备注，不应进入游客接口',
    },
  });
}

beforeEach(async () => {
  await resetDatabase();
  await createUser({ studentNo: '20249981', name: '匹配管理员', role: 'admin' });
  owner = await createUser({ studentNo: '20249982', name: '投稿人' });
  category = await createCategory({ name: '匹配证件', sortOrder: 1 });
  adminToken = await loginAs('20249981', TEST_PASSWORD);
});

afterAll(async () => {
  await prisma.$disconnect();
});

const adminRequest = (request) => request.set(bearer(adminToken));

describe('管理员失物匹配建议', () => {
  it('未登录不能读取建议，管理员可看到匹配依据且包含私有字段', async () => {
    const source = await createMatchItem({ type: 'lost', title: '蓝色校园卡', itemNo: 'LF-CARD-001', features: '透明卡套 星形贴纸' });
    await createMatchItem({ type: 'found', title: '捡到蓝色校园卡', itemNo: 'LF-CARD-002', features: '透明卡套 星形贴纸' });

    expect((await api().get(`/api/admin/items/${source.id}/matches`)).status).toBe(401);
    const response = await adminRequest(api().get(`/api/admin/items/${source.id}/matches`));
    expect(response.status).toBe(200);
    expect(response.body.data.suggestions).toHaveLength(1);
    const suggestion = response.body.data.suggestions[0];
    expect(suggestion.score).toBeGreaterThan(0);
    expect(suggestion.reasons).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'area' }),
      expect.objectContaining({ code: 'features' }),
    ]));
    expect(suggestion.candidate).toHaveProperty('contactValue', '13800138000');
    expect(suggestion.candidate).toHaveProperty('internalNote');
  });

  it('只建议相反类型、未删除的活跃记录，并按分数和 limit 返回', async () => {
    const source = await createMatchItem({ type: 'lost', title: '红色水杯', features: '红色 带贴纸' });
    const strong = await createMatchItem({ type: 'found', title: '红色水杯', features: '红色 带贴纸' });
    const sameType = await createMatchItem({ type: 'lost', title: '红色水杯', features: '红色 带贴纸' });
    const hidden = await createMatchItem({ type: 'found', title: '红色水杯', features: '红色 带贴纸', status: 'offline', publicAllowed: false });
    await prisma.item.update({ where: { id: hidden.id }, data: { deletedAt: new Date() } });

    const response = await adminRequest(api().get(`/api/admin/items/${source.id}/matches`).query({ limit: 1, minScore: 0 }));
    expect(response.status).toBe(200);
    expect(response.body.data.suggestions).toHaveLength(1);
    expect(response.body.data.suggestions[0].targetItemId).toBe(strong.id);
    expect(response.body.data.suggestions[0].targetItemId).not.toBe(sameType.id);
  });

  it('确认、忽略只能操作对应 source 的 suggested 建议，重复处理返回 409', async () => {
    const source = await createMatchItem({ type: 'lost', title: '黑色雨伞', features: '黑色 长柄' });
    const target = await createMatchItem({ type: 'found', title: '黑色雨伞', features: '黑色 长柄' });
    const suggestions = await adminRequest(api().get(`/api/admin/items/${source.id}/matches`));
    const matchId = suggestions.body.data.suggestions.find((entry) => entry.targetItemId === target.id).matchId;

    const confirmed = await adminRequest(api().post(`/api/admin/items/${source.id}/matches/${matchId}/confirm`).send({ note: '管理员已核实' }));
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.data).toEqual(expect.objectContaining({ status: 'confirmed', targetItemId: target.id, note: '管理员已核实' }));

    const repeated = await adminRequest(api().post(`/api/admin/items/${source.id}/matches/${matchId}/ignore`).send({ note: '重复操作' }));
    expect(repeated.status).toBe(409);
  });

  it('并发决策只有一个成功，另一个得到冲突提示', async () => {
    const source = await createMatchItem({ type: 'lost', title: '并发测试物品', features: '独特特征' });
    const target = await createMatchItem({ type: 'found', title: '并发测试物品', features: '独特特征' });
    const suggestions = await adminRequest(api().get(`/api/admin/items/${source.id}/matches`));
    const matchId = suggestions.body.data.suggestions.find((entry) => entry.targetItemId === target.id).matchId;

    const responses = await Promise.all([
      adminRequest(api().post(`/api/admin/items/${source.id}/matches/${matchId}/confirm`).send({})),
      adminRequest(api().post(`/api/admin/items/${source.id}/matches/${matchId}/ignore`).send({})),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(await prisma.lostFoundMatch.count({ where: { id: matchId, status: 'confirmed' } })).toBe(1);
  });

  it('人工关联拒绝自身和同类型，允许管理员手动关联异类型记录', async () => {
    const source = await createMatchItem({ type: 'lost', title: '手动关联物品', features: '独特' });
    const sameType = await createMatchItem({ type: 'lost', title: '另一条报失', features: '独特' });
    const target = await createMatchItem({ type: 'found', title: '手动关联拾物', features: '不同' });

    const self = await adminRequest(api().post(`/api/admin/items/${source.id}/matches/manual`).send({ targetItemId: source.id }));
    expect(self.status).toBe(400);
    const same = await adminRequest(api().post(`/api/admin/items/${source.id}/matches/manual`).send({ targetItemId: sameType.id }));
    expect(same.status).toBe(400);
    const linked = await adminRequest(api().post(`/api/admin/items/${source.id}/matches/manual`).send({ targetItemId: target.id, note: '人工核验' }));
    expect(linked.status).toBe(200);
    expect(linked.body.data).toEqual(expect.objectContaining({ status: 'confirmed', targetItemId: target.id, note: '人工核验' }));
  });
});
