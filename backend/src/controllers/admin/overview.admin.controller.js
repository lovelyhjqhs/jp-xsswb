// 后台：数据概览与审计日志
import { getPublishTrend, getOverviewStats } from '../../services/admin/stats.admin.service.js';
import { listAuditLogs } from '../../services/audit.service.js';
import { success } from '../../utils/response.js';

/** GET /api/admin/stats */
export async function stats(_req, res) {
  const [overview, trend] = await Promise.all([getOverviewStats(), getPublishTrend(30)]);
  return success(res, { ...overview, trend });
}

/** GET /api/admin/audit-logs */
export async function auditLogs(req, res) {
  const data = await listAuditLogs(req.validatedQuery);
  return success(res, data);
}
