// 后台：用户管理
import {
  listUserItems,
  listUsers,
  resetUserPassword,
  setUserStatus,
} from '../../services/admin/user.admin.service.js';
import { success } from '../../utils/response.js';

/** GET /api/admin/users */
export async function list(req, res) {
  const data = await listUsers(req.validatedQuery);
  return success(res, data);
}

/** PATCH /api/admin/users/:id/status */
export async function updateStatus(req, res) {
  const result = await setUserStatus({
    userId: req.validatedParams.id,
    status: req.body.status,
    adminId: req.user.id,
  });
  const message =
    req.body.status === 'banned' ? '账号已禁用' : '账号已恢复';
  return success(res, result, result.changed ? message : '状态未变化');
}

/** POST /api/admin/users/:id/reset-password */
export async function resetPassword(req, res) {
  const data = await resetUserPassword({
    userId: req.validatedParams.id,
    adminId: req.user.id,
  });
  return success(res, data, '密码已重置，请把临时密码转告用户');
}

/** GET /api/admin/users/:id/items */
export async function userItems(req, res) {
  const data = await listUserItems({
    userId: req.validatedParams.id,
    ...req.validatedQuery,
  });
  return success(res, data);
}
