// 白名单注册测试。
// ENABLE_WHITELIST 在 src/config/env.js 模块加载时读取，因此必须在动态 import 之前打桩，
// 本文件的所有业务模块都用动态 import 引入（不能有静态 import）。
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const WHITELISTED = {
  studentNo: '20240041',
  name: '白名单学生',
  password: 'Passw0rd123',
  confirmPassword: 'Passw0rd123',
};

let api;
let prisma;
let resetDatabase;

beforeAll(async () => {
  vi.stubEnv('ENABLE_WHITELIST', 'true');

  const [{ createApp }, dbModule, supertestModule, dbHelpers] = await Promise.all([
    import('../src/app.js'),
    import('../src/db/prisma.js'),
    import('supertest'),
    import('./helpers/db.js'),
  ]);

  const request = supertestModule.default;
  const app = createApp();
  api = () => request(app);
  prisma = dbModule.prisma;
  resetDatabase = dbHelpers.resetDatabase;
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await prisma?.$disconnect();
});

beforeEach(async () => {
  await resetDatabase();
});

describe('ENABLE_WHITELIST=true 时的注册', () => {
  it('学号在名单内且姓名一致 → 注册成功', async () => {
    await prisma.studentWhitelist.create({
      data: { studentNo: WHITELISTED.studentNo, name: WHITELISTED.name },
    });

    const res = await api().post('/api/auth/register').send(WHITELISTED);

    expect(res.status).toBe(201);
    expect(res.body.data.studentNo).toBe(WHITELISTED.studentNo);
  });

  it('学号不在名单内 → 403', async () => {
    const res = await api().post('/api/auth/register').send(WHITELISTED);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe(40301);
    expect(res.body.message).toContain('不在可注册名单内');
  });

  it('学号在名单内但姓名不一致 → 403', async () => {
    await prisma.studentWhitelist.create({
      data: { studentNo: WHITELISTED.studentNo, name: '名单里的名字' },
    });

    const res = await api().post('/api/auth/register').send(WHITELISTED);

    expect(res.status).toBe(403);
    expect(res.body.message).toContain('姓名与名单不一致');
  });

  it('姓名首尾空格会被 trim 后比对', async () => {
    await prisma.studentWhitelist.create({
      data: { studentNo: WHITELISTED.studentNo, name: WHITELISTED.name },
    });

    const res = await api()
      .post('/api/auth/register')
      .send({ ...WHITELISTED, name: `  ${WHITELISTED.name}  ` });

    expect(res.status).toBe(201);
  });
});
