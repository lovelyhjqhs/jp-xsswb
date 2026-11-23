// 后台：学号白名单（CSV 预览 / 导入 / 列表）
import {
  importWhitelist,
  listWhitelist,
  previewWhitelist,
} from '../../services/admin/whitelist.admin.service.js';
import { ApiError, success } from '../../utils/response.js';

function requireFile(req) {
  if (!req.file?.buffer) {
    throw ApiError.badRequest('请选择要上传的 CSV 文件（字段名 file）');
  }
  return req.file.buffer;
}

/** GET /api/admin/whitelist */
export async function list(req, res) {
  const data = await listWhitelist(req.validatedQuery);
  return success(res, data);
}

/** POST /api/admin/whitelist/preview —— 只解析，不写库 */
export async function preview(req, res) {
  const data = await previewWhitelist(requireFile(req));
  return success(res, data, '解析完成');
}

/** POST /api/admin/whitelist/import —— 确认导入 */
export async function importCsv(req, res) {
  const data = await importWhitelist({
    buffer: requireFile(req),
    adminId: req.user.id,
  });
  return success(res, data, `已导入 ${data.imported} 条，跳过 ${data.skipped} 条`);
}
