// 帖子控制器
import { env } from '../config/env.js';
import * as itemService from '../services/item.service.js';
import { success } from '../utils/response.js';

/** POST /api/items */
export async function create(req, res) {
  const item = await itemService.createItem(req.user, req.body);
  const message = env.REQUIRE_REVIEW ? '发布成功，等待管理员审核' : '发布成功';
  return success(res, item, message, 201);
}

/** GET /api/items */
export async function list(req, res) {
  const result = await itemService.listItems(req.validatedQuery);
  return success(res, result);
}

/** GET /api/items/:id */
export async function detail(req, res) {
  const item = await itemService.getItemDetail(req.validatedParams.id, req.user);
  return success(res, item);
}

/** PUT /api/items/:id */
export async function update(req, res) {
  const item = await itemService.updateItem(req.validatedParams.id, req.user, req.body);
  const message = env.REQUIRE_REVIEW ? '已保存，等待管理员重新审核' : '已保存';
  return success(res, item, message);
}

/** PATCH /api/items/:id/resolve */
export async function resolve(req, res) {
  const item = await itemService.resolveItem(req.validatedParams.id, req.user);
  return success(res, item, '已标记为已找回');
}

/** DELETE /api/items/:id */
export async function remove(req, res) {
  await itemService.deleteItem(req.validatedParams.id, req.user);
  return success(res, null, '已删除');
}

/** GET /api/me/items */
export async function mine(req, res) {
  const result = await itemService.listMyItems(req.user.id, req.validatedQuery);
  return success(res, result);
}

/** POST /api/items/:id/report */
export async function report(req, res) {
  const data = await itemService.createReport(
    req.validatedParams.id,
    req.user.id,
    req.body.reason,
  );
  return success(res, data, '举报已提交，管理员会尽快处理', 201);
}
