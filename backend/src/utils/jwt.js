// JWT 签发与校验。密钥、有效期来自环境变量。
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

/**
 * 签发 token。
 * payload 只放鉴权必需的最小信息（谁、什么角色），不放姓名等可变资料，
 * 避免 token 里的信息与数据库长期不一致。
 */
export function signToken(user) {
  return jwt.sign(
    { sub: String(user.id), role: user.role, studentNo: user.studentNo },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN },
  );
}

/** 校验 token，失败时抛出 jsonwebtoken 的错误（TokenExpiredError / JsonWebTokenError） */
export function verifyToken(token) {
  return jwt.verify(token, env.JWT_SECRET);
}
