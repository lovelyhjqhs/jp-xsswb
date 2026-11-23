// 鉴权中间件。
//
// authRequired   ：必须登录，token 无效/过期/账号被禁用都会拒绝
// optionalAuth   ：有 token 就尝试解析，无或无效都当游客放行（用于公开列表页）
// adminRequired  ：必须已登录且为管理员，需放在 authRequired 之后
//
// 设计取舍：每次都回查数据库，而不是只信 token 里的 role/status。
// 这样「管理员被降级」或「用户被封禁」能立刻生效，代价是每个受保护请求多一次主键查询。
import { prisma } from '../db/prisma.js';
import { verifyToken } from '../utils/jwt.js';
import { ApiError, CODE } from '../utils/response.js';
import { PUBLIC_USER_SELECT } from '../utils/user.js';
import { parseCookies } from '../utils/cookies.js';
import { ADMIN_SESSION_COOKIE, resolveAdminSession, isValidCsrf } from '../services/adminSession.service.js';
import { env } from '../config/env.js';

/** 从 Authorization: Bearer <token> 中取出 token */
function extractBearerToken(req) {
  const header = req.headers.authorization ?? '';
  const [scheme, value] = header.split(' ');
  if (!value || scheme.toLowerCase() !== 'bearer') return null;
  return value.trim() || null;
}

/** 校验 token 并加载用户；任何失败都抛 ApiError */
async function resolveUser(token) {
  let payload;
  try {
    payload = verifyToken(token);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new ApiError(CODE.UNAUTHORIZED, '登录已过期，请重新登录', 401);
    }
    throw new ApiError(CODE.UNAUTHORIZED, '登录状态无效，请重新登录', 401);
  }

  const userId = Number(payload.sub);
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new ApiError(CODE.UNAUTHORIZED, '登录状态无效，请重新登录', 401);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: PUBLIC_USER_SELECT,
  });

  if (!user) throw new ApiError(CODE.UNAUTHORIZED, '账号不存在，请重新登录', 401);
  if (user.status === 'banned') {
    throw new ApiError(CODE.FORBIDDEN, '账号已被禁用，请联系管理员', 403);
  }

  return user;
}

export async function authRequired(req, _res, next) {
  const token = extractBearerToken(req);
  if (!token) return next(ApiError.unauthorized('请先登录'));

  try {
    req.user = await resolveUser(token);
    next();
  } catch (error) {
    next(error);
  }
}

export async function optionalAuth(req, _res, next) {
  const token = extractBearerToken(req);

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    req.user = await resolveUser(token);
  } catch {
    // 公开页面：token 过期或伪造都按游客处理，不打断浏览
    req.user = null;
  }
  next();
}

export function adminRequired(req, _res, next) {
  if (!req.user) return next(ApiError.unauthorized('请先登录'));
  if (req.user.role !== 'admin') return next(ApiError.forbidden('需要管理员权限'));
  next();
}

/**
 * 管理后台专用会话。Bearer 兼容仅供旧 API 测试，开发与生产一律使用服务端会话。
 */
export async function adminSessionRequired(req, _res, next) {
  try {
    _res.setHeader('Cache-Control', 'no-store');
    _res.setHeader('Pragma', 'no-cache');
    const cookies = parseCookies(req.headers.cookie);
    const rawCookie = cookies[ADMIN_SESSION_COOKIE];
    if (rawCookie) {
      const session = await resolveAdminSession(rawCookie);
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        const csrf = req.get('X-CSRF-Token');
        if (!isValidCsrf(session, csrf)) return next(ApiError.forbidden('CSRF 校验失败'));
      }
      req.adminSession = session;
      req.user = session.admin;
      req.authSource = 'admin-session';
      return next();
    }

    if (env.NODE_ENV === 'test') {
      const token = extractBearerToken(req);
      if (token) {
        req.user = await resolveUser(token);
        if (req.user.role !== 'admin') return next(ApiError.forbidden('需要管理员权限'));
        req.authSource = 'legacy-bearer';
        return next();
      }
    }
    return next(ApiError.unauthorized('请先登录管理员后台'));
  } catch (error) {
    return next(error);
  }
}
