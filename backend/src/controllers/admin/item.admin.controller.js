// 后台：内容管理
import {
  batchChangeItems,
  changeItemStatus,
  deleteItemAsAdmin,
  listItemsForAdmin,
} from '../../services/admin/item.admin.service.js';
import { success } from '../../utils/response.js';

const ACTION_MESSAGES = {
  approve: '已审核通过',
  reject: '已驳回',
  offline: '已下架',
  restore: '已恢复',
};

/** GET /api/admin/items */
export async function listItems(req, res) {
  const data = await listItemsForAdmin(req.validatedQuery);
  return success(res, data);
}

/** 生成处理单个状态流转的处理器 */
function statusHandler(action) {
  return async (req, res) => {
    const item = await changeItemStatus({
      itemId: req.validatedParams.id,
      action,
      adminId: req.user.id,
      reason: req.body?.reason,
    });
    return success(res, item, ACTION_MESSAGES[action]);
  };
}

export const approveItem = statusHandler('approve');
export const rejectItem = statusHandler('reject');
export const offlineItem = statusHandler('offline');
export const cleanItem = statusHandler('clean');
export const archiveItem = statusHandler('archive');
export const restoreItem = statusHandler('restore');

/** DELETE /api/admin/items/:id */
export async function deleteItem(req, res) {
  await deleteItemAsAdmin({ itemId: req.validatedParams.id, adminId: req.user.id, softDelete: req.authSource === 'admin-session' });
  return success(res, null, '已删除');
}

/** POST /api/admin/items/batch */
export async function batchItems(req, res) {
  const result = await batchChangeItems({ ...req.body, adminId: req.user.id, softDelete: req.authSource === 'admin-session' });
  const message =
    result.failed === 0
      ? `已处理 ${result.succeeded} 条`
      : `成功 ${result.succeeded} 条，失败 ${result.failed} 条`;
  return success(res, result, message);
}
