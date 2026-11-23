// 生成临时密码：管理员重置密码时使用，只在响应里返回一次
import crypto from 'node:crypto';

// 去掉容易混淆的字符（l/1/O/0），方便用户手工输入
const LETTERS = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';

/**
 * 生成满足密码强度规则（字母 + 数字，≥8 位）的随机密码。
 * 默认 10 位：2 位固定保证强度，其余随机。
 */
export function generateTempPassword(length = 10) {
  const all = LETTERS + DIGITS;
  const pick = (source) => source[crypto.randomInt(source.length)];

  let body = '';
  for (let i = 0; i < Math.max(0, length - 2); i += 1) {
    body += pick(all);
  }

  return `${pick(LETTERS)}${pick(DIGITS)}${body}`;
}
