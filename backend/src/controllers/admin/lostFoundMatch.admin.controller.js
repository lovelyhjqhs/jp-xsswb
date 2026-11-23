import { success } from '../../utils/response.js';
import { confirmMatch, ignoreMatch, manualMatch, suggestMatches } from '../../services/admin/lostFoundMatch.admin.service.js';

export async function listMatches(req, res) {
  return success(res, await suggestMatches({
    itemId: req.validatedParams.id,
    limit: req.validatedQuery?.limit,
    minScore: req.validatedQuery?.minScore,
    adminId: req.user.id,
  }));
}

export async function confirm(req, res) {
  return success(res, await confirmMatch({ itemId: req.validatedParams.id, matchId: req.validatedParams.matchId, note: req.body?.note, adminId: req.user.id }), '匹配已确认');
}

export async function ignore(req, res) {
  return success(res, await ignoreMatch({ itemId: req.validatedParams.id, matchId: req.validatedParams.matchId, note: req.body?.note, adminId: req.user.id }), '匹配建议已忽略');
}

export async function manual(req, res) {
  return success(res, await manualMatch({ itemId: req.validatedParams.id, targetItemId: req.body.targetItemId, targetItemNo: req.body.targetItemNo, note: req.body.note, adminId: req.user.id }), '已建立人工关联');
}
