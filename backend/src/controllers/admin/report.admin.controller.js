// 后台：举报处理
import { handleReport, listReports } from '../../services/admin/report.admin.service.js';
import { success } from '../../utils/response.js';

/** GET /api/admin/reports */
export async function list(req, res) {
  const data = await listReports(req.validatedQuery);
  return success(res, data);
}

/** POST /api/admin/reports/:id/handle */
export async function handle(req, res) {
  const data = await handleReport({
    reportId: req.validatedParams.id,
    action: req.body.action,
    note: req.body.note,
    adminId: req.user.id,
  });
  return success(
    res,
    data,
    req.body.action === 'offline' ? '已下架被举报帖子' : '已忽略该举报',
  );
}
