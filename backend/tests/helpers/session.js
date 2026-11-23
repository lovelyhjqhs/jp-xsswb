// 登录辅助：拿 token 拼请求头
import { api } from './request.js';
import { TEST_PASSWORD } from './fixtures.js';

export const bearer = (token) => ({ Authorization: `Bearer ${token}` });

/** 用已存在的账号登录并返回 token */
export async function loginAs(studentNo, password = TEST_PASSWORD) {
  const res = await api().post('/api/auth/login').send({ studentNo, password });
  if (res.status !== 200) {
    throw new Error(`登录失败（${studentNo}）：${res.status} ${res.body?.message}`);
  }
  return res.body.data.token;
}
