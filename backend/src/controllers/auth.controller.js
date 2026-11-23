// 认证控制器：只做取参 → 调 service → 组装统一响应。
import * as authService from '../services/auth.service.js';
import { recordLoginFailure, resetLoginFailures } from '../middlewares/loginRateLimit.js';
import { CODE, success } from '../utils/response.js';

/** POST /api/auth/register */
export async function register(req, res) {
  const user = await authService.registerUser(req.body);
  return success(res, user, '注册成功，请登录', 201);
}

/** POST /api/auth/login */
export async function login(req, res) {
  try {
    const data = await authService.loginUser(req.body);
    // 登录成功即清零该 IP 的失败计数
    resetLoginFailures(req.ip);
    return success(res, data, '登录成功');
  } catch (error) {
    // 仅「学号或密码错误」计入限流；账号被禁用不计入，避免管理员误伤正常用户
    if (error.code === CODE.UNAUTHORIZED) {
      recordLoginFailure(req.ip);
    }
    throw error;
  }
}

/** GET /api/auth/me */
export async function me(req, res) {
  const user = await authService.getUserById(req.user.id);
  return success(res, user);
}

/** PUT /api/auth/password */
export async function changePassword(req, res) {
  await authService.changePassword({
    userId: req.user.id,
    oldPassword: req.body.oldPassword,
    newPassword: req.body.newPassword,
  });
  return success(res, null, '密码修改成功，请使用新密码重新登录');
}
