import jwt from 'jsonwebtoken';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { api } from './helpers/request.js';
import { prisma, resetDatabase } from './helpers/db.js';
import { createUser, TEST_PASSWORD } from './helpers/fixtures.js';
import { resetAllLoginFailures } from '../src/middlewares/loginRateLimit.js';
import { env } from '../src/config/env.js';

const NEW_PASSWORD = 'NewPassw0rd9';

beforeEach(async () => {
  await resetDatabase();
  resetAllLoginFailures();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /api/auth/me', () => {
  it('无 token → 401', async () => {
    const res = await api().get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.code).toBe(40101);
    expect(res.body.message).toBe('请先登录');
  });

  it('有效 token → 返回当前用户', async () => {
    const user = await createUser({ studentNo: '20240021', name: '赵六' });
    const token = jwt.sign({ sub: String(user.id), role: user.role }, env.JWT_SECRET, {
      expiresIn: '1h',
    });

    const res = await api().get('/api/auth/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(
      expect.objectContaining({ id: user.id, studentNo: '20240021', name: '赵六' }),
    );
    expect(res.body.data).not.toHaveProperty('passwordHash');
  });

  it('伪造的 token → 401', async () => {
    const res = await api()
      .get('/api/auth/me')
      .set('Authorization', 'Bearer this.is.not-a-valid-token');

    expect(res.status).toBe(401);
    expect(res.body.message).toContain('登录状态无效');
  });

  it('过期 token → 401 且提示过期', async () => {
    const user = await createUser({ studentNo: '20240022' });
    const expired = jwt.sign({ sub: String(user.id) }, env.JWT_SECRET, { expiresIn: '-10s' });

    const res = await api().get('/api/auth/me').set('Authorization', `Bearer ${expired}`);

    expect(res.status).toBe(401);
    expect(res.body.message).toContain('已过期');
  });

  it('缺少 Bearer 前缀 → 401', async () => {
    const user = await createUser({ studentNo: '20240023' });
    const token = jwt.sign({ sub: String(user.id) }, env.JWT_SECRET, { expiresIn: '1h' });

    const res = await api().get('/api/auth/me').set('Authorization', token);

    expect(res.status).toBe(401);
  });

  it('账号被禁用后 token 立即失效 → 403', async () => {
    const user = await createUser({ studentNo: '20240024', status: 'banned' });
    const token = jwt.sign({ sub: String(user.id) }, env.JWT_SECRET, { expiresIn: '1h' });

    const res = await api().get('/api/auth/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toContain('已被禁用');
  });
});

describe('PUT /api/auth/password', () => {
  it('修改成功：旧密码失效，新密码可登录', async () => {
    const user = await createUser({ studentNo: '20240025' });
    const token = jwt.sign({ sub: String(user.id) }, env.JWT_SECRET, { expiresIn: '1h' });

    const res = await api()
      .put('/api/auth/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ oldPassword: TEST_PASSWORD, newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);

    const oldLogin = await api()
      .post('/api/auth/login')
      .send({ studentNo: '20240025', password: TEST_PASSWORD });
    expect(oldLogin.status).toBe(401);

    const newLogin = await api()
      .post('/api/auth/login')
      .send({ studentNo: '20240025', password: NEW_PASSWORD });
    expect(newLogin.status).toBe(200);
  });

  it('原密码错误 → 400', async () => {
    const user = await createUser({ studentNo: '20240026' });
    const token = jwt.sign({ sub: String(user.id) }, env.JWT_SECRET, { expiresIn: '1h' });

    const res = await api()
      .put('/api/auth/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ oldPassword: 'WrongPass1', newPassword: NEW_PASSWORD });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(40001);
    expect(res.body.message).toBe('原密码不正确');
  });

  it('新密码强度不足 → 400', async () => {
    const user = await createUser({ studentNo: '20240027' });
    const token = jwt.sign({ sub: String(user.id) }, env.JWT_SECRET, { expiresIn: '1h' });

    const res = await api()
      .put('/api/auth/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ oldPassword: TEST_PASSWORD, newPassword: '12345678' });

    expect(res.status).toBe(400);
    expect(res.body.data.some((e) => e.field === 'newPassword')).toBe(true);
  });

  it('新密码与原密码相同 → 400', async () => {
    const user = await createUser({ studentNo: '20240028' });
    const token = jwt.sign({ sub: String(user.id) }, env.JWT_SECRET, { expiresIn: '1h' });

    const res = await api()
      .put('/api/auth/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ oldPassword: TEST_PASSWORD, newPassword: TEST_PASSWORD });

    expect(res.status).toBe(400);
    expect(res.body.data.some((e) => e.field === 'newPassword')).toBe(true);
  });

  it('两次新密码不一致 → 400', async () => {
    const user = await createUser({ studentNo: '20240029' });
    const token = jwt.sign({ sub: String(user.id) }, env.JWT_SECRET, { expiresIn: '1h' });

    const res = await api()
      .put('/api/auth/password')
      .set('Authorization', `Bearer ${token}`)
      .send({
        oldPassword: TEST_PASSWORD,
        newPassword: NEW_PASSWORD,
        confirmPassword: 'OtherPassw0rd',
      });

    expect(res.status).toBe(400);
    expect(res.body.data.some((e) => e.field === 'confirmPassword')).toBe(true);
  });

  it('未登录 → 401', async () => {
    const res = await api()
      .put('/api/auth/password')
      .send({ oldPassword: TEST_PASSWORD, newPassword: NEW_PASSWORD });

    expect(res.status).toBe(401);
  });
});
