import { serializeCookie } from '../../utils/cookies.js';
import { ADMIN_CSRF_COOKIE, ADMIN_SESSION_COOKIE, cookieOptions, csrfCookieOptions, revokeAdminSession } from '../../services/adminSession.service.js';
import * as adminAuthService from '../../services/adminAuth.service.js';
import { recordLoginFailure, resetLoginFailures } from '../../middlewares/loginRateLimit.js';
import { CODE, success } from '../../utils/response.js';
import { parseCookies } from '../../utils/cookies.js';
import { resolveAdminSession } from '../../services/adminSession.service.js';

const publicAdmin = (admin) => ({
  id: admin.id,
  studentNo: admin.studentNo,
  name: admin.name,
  role: admin.role,
  status: admin.status,
  lastLoginAt: admin.lastLoginAt,
});

export async function login(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  try {
    const data = await adminAuthService.loginAdmin({
      ...req.body,
      context: { ip: req.ip, userAgent: req.get('user-agent') },
    });
    resetLoginFailures(req.ip);
    res.setHeader('Set-Cookie', [
      serializeCookie(ADMIN_SESSION_COOKIE, data.rawSession, cookieOptions(data.maxAge)),
      serializeCookie(ADMIN_CSRF_COOKIE, data.rawCsrf, csrfCookieOptions(data.maxAge)),
    ]);
    return success(res, { admin: publicAdmin(data.admin), expiresAt: data.expiresAt }, '登录成功');
  } catch (error) {
    if (error.code === CODE.UNAUTHORIZED) recordLoginFailure(req.ip);
    throw error;
  }
}

export async function me(req, res) {
  const cookies = parseCookies(req.headers.cookie);
  const session = req.adminSession || await resolveAdminSession(cookies[ADMIN_SESSION_COOKIE]);
  return success(res, { admin: publicAdmin(session.admin), expiresAt: session.expiresAt });
}

export async function logout(req, res) {
  const cookies = parseCookies(req.headers.cookie);
  await revokeAdminSession(cookies[ADMIN_SESSION_COOKIE], req.user?.id ?? null);
  const expired = new Date(0);
  res.setHeader('Set-Cookie', [
    serializeCookie(ADMIN_SESSION_COOKIE, '', { ...cookieOptions(0), expires: expired }),
    serializeCookie(ADMIN_CSRF_COOKIE, '', { ...csrfCookieOptions(0), expires: expired }),
  ]);
  return success(res, null, '已退出登录');
}
