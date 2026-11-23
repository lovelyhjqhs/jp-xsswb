import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { api } from './helpers/request.js';
import { prisma, resetDatabase } from './helpers/db.js';

/** 一份合法注册数据，各用例按需覆盖字段 */
const validPayload = (overrides = {}) => ({
  studentNo: '20240001',
  name: '李四',
  password: 'Passw0rd123',
  confirmPassword: 'Passw0rd123',
  ...overrides,
});

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /api/auth/register —— 成功', () => {
  it('返回 201 与用户信息，且不含密码哈希', async () => {
    const res = await api().post('/api/auth/register').send(validPayload());

    expect(res.status).toBe(201);
    expect(res.body.code).toBe(0);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        studentNo: '20240001',
        name: '李四',
        role: 'student',
        status: 'active',
      }),
    );
    expect(res.body.data).not.toHaveProperty('passwordHash');
    expect(typeof res.body.data.id).toBe('number');
  });

  it('密码以 bcrypt 哈希入库，不存明文', async () => {
    await api().post('/api/auth/register').send(validPayload());

    const saved = await prisma.user.findUnique({ where: { studentNo: '20240001' } });
    expect(saved.passwordHash).toMatch(/^\$2[aby]\$\d{2}\$/);
    expect(saved.passwordHash).not.toContain('Passw0rd123');
    expect(saved.passwordHash.length).toBe(60);
  });

  it('注册后可以立即登录', async () => {
    await api().post('/api/auth/register').send(validPayload());

    const res = await api()
      .post('/api/auth/login')
      .send({ studentNo: '20240001', password: 'Passw0rd123' });

    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeTruthy();
  });
});

describe('POST /api/auth/register —— 失败', () => {
  it('学号已存在 → 409 冲突', async () => {
    await api().post('/api/auth/register').send(validPayload());
    const res = await api().post('/api/auth/register').send(validPayload({ name: '王五' }));

    expect(res.status).toBe(409);
    expect(res.body.code).toBe(40901);
    expect(res.body.message).toContain('已注册');
  });

  it('学号位数不足 → 400，错误定位到 studentNo', async () => {
    const res = await api().post('/api/auth/register').send(validPayload({ studentNo: '1234567' }));

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(40001);
    expect(res.body.data.some((e) => e.field === 'studentNo')).toBe(true);
  });

  it('学号含字母 → 400', async () => {
    const res = await api().post('/api/auth/register').send(validPayload({ studentNo: '2024000a' }));

    expect(res.status).toBe(400);
    expect(res.body.data.some((e) => e.field === 'studentNo')).toBe(true);
  });

  it('密码只有字母 → 400', async () => {
    const res = await api()
      .post('/api/auth/register')
      .send(validPayload({ password: 'passwordonly', confirmPassword: 'passwordonly' }));

    expect(res.status).toBe(400);
    expect(res.body.data.some((e) => e.field === 'password')).toBe(true);
  });

  it('密码只有数字 → 400', async () => {
    const res = await api()
      .post('/api/auth/register')
      .send(validPayload({ password: '12345678', confirmPassword: '12345678' }));

    expect(res.status).toBe(400);
    expect(res.body.data.some((e) => e.field === 'password')).toBe(true);
  });

  it('密码不足 8 位 → 400', async () => {
    const res = await api()
      .post('/api/auth/register')
      .send(validPayload({ password: 'Ab1', confirmPassword: 'Ab1' }));

    expect(res.status).toBe(400);
    expect(res.body.data.some((e) => e.field === 'password')).toBe(true);
  });

  it('两次密码不一致 → 400，错误定位到 confirmPassword', async () => {
    const res = await api()
      .post('/api/auth/register')
      .send(validPayload({ confirmPassword: 'Passw0rd999' }));

    expect(res.status).toBe(400);
    expect(res.body.data.some((e) => e.field === 'confirmPassword')).toBe(true);
  });

  it('缺少姓名 → 400', async () => {
    const payload = validPayload();
    delete payload.name;

    const res = await api().post('/api/auth/register').send(payload);

    expect(res.status).toBe(400);
    expect(res.body.data.some((e) => e.field === 'name')).toBe(true);
  });

  it('姓名超长 → 400', async () => {
    const res = await api()
      .post('/api/auth/register')
      .send(validPayload({ name: '张'.repeat(31) }));

    expect(res.status).toBe(400);
  });

  it('校验失败不会写入数据库', async () => {
    await api().post('/api/auth/register').send(validPayload({ studentNo: 'abc' }));
    await expect(prisma.user.count()).resolves.toBe(0);
  });
});
