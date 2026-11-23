import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { api } from './helpers/request.js';
import { prisma, resetDatabase } from './helpers/db.js';
import { createUser, TEST_PASSWORD } from './helpers/fixtures.js';
import { resetAllLoginFailures } from '../src/middlewares/loginRateLimit.js';

beforeEach(async () => {
  await resetDatabase();
  // 限流状态存在进程内存里，用例之间必须清零
  resetAllLoginFailures();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /api/auth/login —— 成功', () => {
  it('返回 JWT 与用户信息', async () => {
    await createUser({ studentNo: '20240002', name: '张三' });

    const res = await api()
      .post('/api/auth/login')
      .send({ studentNo: '20240002', password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data.token.split('.')).toHaveLength(3);
    expect(res.body.data.tokenType).toBe('Bearer');
    expect(res.body.data.expiresIn).toBe('7d');
    expect(res.body.data.user).toEqual(
      expect.objectContaining({ studentNo: '20240002', name: '张三', role: 'student' }),
    );
    expect(res.body.data.user).not.toHaveProperty('passwordHash');
  });

  it('登录成功会刷新 lastLoginAt', async () => {
    const user = await createUser({ studentNo: '20240003' });
    expect(user.lastLoginAt).toBeNull();

    await api()
      .post('/api/auth/login')
      .send({ studentNo: '20240003', password: TEST_PASSWORD });

    const updated = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updated.lastLoginAt).toBeInstanceOf(Date);
  });

  it('签发的 token 能访问 /me', async () => {
    await createUser({ studentNo: '20240004' });
    const login = await api()
      .post('/api/auth/login')
      .send({ studentNo: '20240004', password: TEST_PASSWORD });

    const me = await api()
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.data.token}`);

    expect(me.status).toBe(200);
    expect(me.body.data.studentNo).toBe('20240004');
  });
});

describe('POST /api/auth/login —— 失败', () => {
  it('密码错误 → 401「学号或密码错误」', async () => {
    await createUser({ studentNo: '20240005' });

    const res = await api()
      .post('/api/auth/login')
      .send({ studentNo: '20240005', password: 'WrongPass1' });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe(40101);
    expect(res.body.message).toBe('学号或密码错误');
  });

  it('学号不存在 → 401（提示与密码错误完全一致，不暴露账号是否存在）', async () => {
    const res = await api()
      .post('/api/auth/login')
      .send({ studentNo: '20999999', password: 'WrongPass1' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('学号或密码错误');
  });

  it('密码正确但账号被禁用 → 403 并提示联系管理员', async () => {
    await createUser({ studentNo: '20240006', status: 'banned' });

    const res = await api()
      .post('/api/auth/login')
      .send({ studentNo: '20240006', password: TEST_PASSWORD });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe(40301);
    expect(res.body.message).toContain('已被禁用');
    expect(res.body.data).toBeNull();
    expect(res.body.message).not.toContain(TEST_PASSWORD);
  });

  it('缺少密码 → 400', async () => {
    const res = await api().post('/api/auth/login').send({ studentNo: '20240007' });

    expect(res.status).toBe(400);
    expect(res.body.data.some((e) => e.field === 'password')).toBe(true);
  });
});

describe('登录限流（同一 IP 15 分钟最多 10 次失败）', () => {
  it('连续 10 次失败后第 11 次返回 429', async () => {
    await createUser({ studentNo: '20240008' });

    for (let i = 0; i < 10; i += 1) {
      const res = await api()
        .post('/api/auth/login')
        .send({ studentNo: '20240008', password: 'WrongPass1' });
      expect(res.status).toBe(401);
    }

    const blocked = await api()
      .post('/api/auth/login')
      .send({ studentNo: '20240008', password: 'WrongPass1' });

    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe(42901);
    expect(blocked.body.message).toContain('失败次数过多');
    expect(blocked.headers['retry-after']).toBeDefined();
  });

  it('登录成功后失败计数清零，不会被继续锁住', async () => {
    await createUser({ studentNo: '20240011' });

    for (let i = 0; i < 9; i += 1) {
      await api()
        .post('/api/auth/login')
        .send({ studentNo: '20240011', password: 'WrongPass1' });
    }

    const ok = await api()
      .post('/api/auth/login')
      .send({ studentNo: '20240011', password: TEST_PASSWORD });
    expect(ok.status).toBe(200);

    // 计数已清零，再输错一次仍是 401 而不是 429
    const afterReset = await api()
      .post('/api/auth/login')
      .send({ studentNo: '20240011', password: 'WrongPass1' });
    expect(afterReset.status).toBe(401);
  });
});
