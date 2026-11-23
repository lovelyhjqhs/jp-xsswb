import { success } from '../../utils/response.js';
import { listSubmissions, changeSubmission } from '../../services/admin/submission.admin.service.js';

export async function list(req, res) {
  return success(res, await listSubmissions(req.validatedQuery));
}

export async function change(req, res) {
  const data = await changeSubmission({
    type: req.validatedParams.type,
    id: req.validatedParams.id,
    action: req.validatedParams.action,
    adminId: req.user.id,
    ...req.body,
  });
  const labels = { approve: '通过', reject: '驳回', process: '处理', archive: '归档', delete: '删除', restore: '恢复' };
  return success(res, data, `投稿已${labels[req.validatedParams.action]}`);
}
