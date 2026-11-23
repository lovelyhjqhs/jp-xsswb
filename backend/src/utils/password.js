// 密码哈希与强度规则
import bcrypt from 'bcrypt';

// 10 轮在开发机上约 60-80ms，兼顾安全性与登录体验
const SALT_ROUNDS = 10;

/** 密码强度：8-64 位，且同时包含字母和数字 */
export const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,64}$/;
export const PASSWORD_MESSAGE = '密码需 8-64 位，且同时包含字母和数字';

export function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

/**
 * 账号不存在时也拿它做一次 bcrypt 比对。
 * 目的是让「学号不存在」与「密码错误」的响应耗时接近，
 * 避免攻击者通过时间差枚举有效学号。
 */
export const DUMMY_HASH = '$2b$10$z20q3.oxo1GpmuaHU6DSTen3rLCj10FZw2UPgbCMOf.i0P1GxuyjO';
