import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import { prisma } from '../db/prisma.js';
import { env, isProduction } from '../config/env.js';
import { ApiError } from '../utils/response.js';
import { logAudit } from './audit.service.js';

const hash = (value) => createHmac('sha256', env.JWT_SECRET).update(value).digest('hex');
const token = () => randomBytes(32).toString('base64url');

export const ADMIN_SESSION_COOKIE = env.ADMIN_SESSION_COOKIE;
export const ADMIN_CSRF_COOKIE = env.ADMIN_CSRF_COOKIE;

export function cookieOptions(maxAge) {
  return {
    maxAge,
    httpOnly: true,
    secure: env.ADMIN_COOKIE_SECURE || isProduction,
    sameSite: 'Lax',
    path: '/',
  };
}

export function csrfCookieOptions(maxAge) {
  return {
    maxAge,
    httpOnly: false,
    secure: env.ADMIN_COOKIE_SECURE || isProduction,
    sameSite: 'Lax',
    path: '/',
  };
}

export async function createAdminSession(admin, context = {}) {
  const rawSession = token();
  const rawCsrf = token();
  const ttl = env.ADMIN_SESSION_TTL_MINUTES * 60 * 1000;
  const expiresAt = new Date(Date.now() + ttl);

  await prisma.adminSession.create({
    data: {
      adminId: admin.id,
      tokenHash: hash(rawSession),
      csrfTokenHash: hash(rawCsrf),
      expiresAt,
      ipHash: context.ip ? hash(context.ip) : null,
      userAgent: context.userAgent?.slice(0, 255) || null,
    },
  });

  return { rawSession, rawCsrf, expiresAt, maxAge: Math.floor(ttl / 1000) };
}

export async function resolveAdminSession(rawSession) {
  if (!rawSession) throw ApiError.unauthorized('请先登录管理员后台');
  const session = await prisma.adminSession.findUnique({
    where: { tokenHash: hash(rawSession) },
    include: { admin: { select: { id: true, studentNo: true, name: true, role: true, status: true, lastLoginAt: true } } },
  });
  if (!session || session.revokedAt || session.expiresAt <= new Date()) {
    throw ApiError.unauthorized('管理员会话无效或已过期');
  }
  const adminCount = await prisma.user.count({ where: { role: 'admin' } });
  if (adminCount !== 1) throw ApiError.unauthorized('管理员会话无效或已过期');
  if (session.admin.role !== 'admin') throw ApiError.forbidden('需要管理员权限');
  if (session.admin.status !== 'active') throw ApiError.forbidden('管理员账号已被禁用');

  await prisma.adminSession.update({ where: { id: session.id }, data: { lastUsedAt: new Date() } });
  return session;
}

export async function revokeAdminSession(rawSession, adminId = null) {
  if (!rawSession) return;
  await prisma.adminSession.updateMany({
    where: { tokenHash: hash(rawSession), revokedAt: null },
    data: { revokedAt: new Date() },
  });
  await logAudit({ adminId, action: 'admin.logout', targetType: 'admin_session', detail: null });
}

export function isValidCsrf(session, value) {
  if (!value) return false;
  const expected = Buffer.from(session.csrfTokenHash, 'hex');
  const actual = Buffer.from(hash(value), 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function revokeAllAdminSessions(adminId) {
  await prisma.adminSession.updateMany({ where: { adminId, revokedAt: null }, data: { revokedAt: new Date() } });
}

export { hash as hashAdminSessionValue };
