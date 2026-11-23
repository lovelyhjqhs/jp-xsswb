import { prisma } from '../../db/prisma.js';
import { ApiError, CODE } from '../../utils/response.js';
import { logAudit } from '../audit.service.js';

// 已清理/下架/删除记录保留审计数据，但不再参与新的匹配建议。
const ACTIVE_MATCH_STATUSES = ['pending', 'open', 'resolved'];
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

const ITEM_MATCH_SELECT = {
  id: true,
  itemNo: true,
  type: true,
  area: true,
  categoryId: true,
  title: true,
  description: true,
  features: true,
  location: true,
  happenedAt: true,
  status: true,
  publicAllowed: true,
  internalNote: true,
  contactType: true,
  contactValue: true,
  deletedAt: true,
  category: { select: { id: true, name: true } },
  images: { orderBy: { sortOrder: 'asc' }, select: { id: true, url: true, sortOrder: true } },
};

function normalize(value) {
  return String(value ?? '').toLocaleLowerCase('zh-CN').replace(/\s+/g, '').trim();
}

function tokens(value) {
  const normalized = normalize(value);
  const result = new Set(normalized.split(/[，。！？、,.!?;；:/\\|()[\]{}<>"'“”‘’\-_]+/u).filter(Boolean));
  // Chinese descriptions rarely contain spaces. Character bigrams make short feature phrases searchable
  // without introducing a heavyweight search dependency.
  const chinese = normalized.match(/[\u3400-\u9fff]/gu)?.join('') ?? '';
  for (let i = 0; i < chinese.length - 1; i += 1) result.add(chinese.slice(i, i + 2));
  return result;
}

function overlapScore(left, right, maxPoints) {
  if (!left.size || !right.size) return { points: 0, overlap: 0 };
  let overlap = 0;
  for (const token of left) if (right.has(token)) overlap += 1;
  const ratio = overlap / Math.max(1, Math.min(left.size, right.size));
  return { points: Math.min(maxPoints, Math.round(ratio * maxPoints)), overlap };
}

function dayDistance(left, right) {
  const diff = Math.abs(new Date(left).getTime() - new Date(right).getTime());
  return diff / 86400000;
}

function calculateMatch(source, target) {
  const reasons = [];
  let score = 0;

  if (source.itemNo && target.itemNo && normalize(source.itemNo) === normalize(target.itemNo)) {
    score += 45;
    reasons.push({ code: 'item_no', label: '编号一致', points: 45 });
  }
  if (source.area && target.area && source.area === target.area) {
    score += 20;
    reasons.push({ code: 'area', label: `${source.area} 区域一致`, points: 20 });
  }
  if (source.categoryId && target.categoryId && source.categoryId === target.categoryId) {
    score += 20;
    reasons.push({ code: 'category', label: '物品类型一致', points: 20 });
  }

  const feature = overlapScore(
    tokens(`${source.title} ${source.features || source.description}`),
    tokens(`${target.title} ${target.features || target.description}`),
    30,
  );
  if (feature.points > 0) {
    score += feature.points;
    reasons.push({ code: 'features', label: `名称/特征有 ${feature.overlap} 项相似`, points: feature.points });
  }

  const location = overlapScore(tokens(source.location), tokens(target.location), 15);
  if (location.points > 0) {
    score += location.points;
    reasons.push({ code: 'location', label: '地点描述相似', points: location.points });
  }

  const days = dayDistance(source.happenedAt, target.happenedAt);
  const datePoints = days <= 1 ? 15 : days <= 3 ? 12 : days <= 7 ? 8 : days <= 30 ? 4 : 0;
  if (datePoints > 0) {
    score += datePoints;
    reasons.push({ code: 'time', label: `发生时间相差 ${Math.round(days * 10) / 10} 天`, points: datePoints });
  }

  return { score: Math.min(100, score), reasons };
}

function itemDto(item) {
  return {
    id: item.id,
    itemNo: item.itemNo || `LF-${String(item.id).padStart(6, '0')}`,
    type: item.type,
    area: item.area,
    category: item.category,
    title: item.title,
    description: item.description,
    features: item.features || item.description,
    location: item.location,
    happenedAt: item.happenedAt,
    status: item.status,
    publicAllowed: item.publicAllowed,
    internalNote: item.internalNote,
    contactType: item.contactType,
    contactValue: item.contactValue,
    images: item.images.map((image) => ({ id: image.id, url: image.url, sortOrder: image.sortOrder })),
  };
}

function checkedLimit(value) {
  const limit = Number(value ?? DEFAULT_LIMIT);
  return Number.isInteger(limit) && limit > 0 && limit <= MAX_LIMIT ? limit : DEFAULT_LIMIT;
}

async function loadItem(id) {
  const item = await prisma.item.findUnique({ where: { id }, select: ITEM_MATCH_SELECT });
  if (!item || item.deletedAt) throw ApiError.notFound('失物记录不存在或已删除');
  return item;
}

async function persistSuggestion(sourceItemId, candidate, score, reasons) {
  const existing = await prisma.lostFoundMatch.findUnique({
    where: { sourceItemId_targetItemId: { sourceItemId, targetItemId: candidate.id } },
    select: { id: true, status: true },
  });
  if (!existing) {
    return prisma.lostFoundMatch.create({
      data: { sourceItemId, targetItemId: candidate.id, score, reasons },
      select: { id: true, status: true },
    });
  }
  if (existing.status === 'suggested') {
    await prisma.lostFoundMatch.update({ where: { id: existing.id }, data: { score, reasons } });
  }
  return existing;
}

export async function suggestMatches({ itemId, limit, minScore = 20, adminId }) {
  const source = await loadItem(itemId);
  const threshold = Math.max(0, Math.min(100, Number(minScore) || 0));
  const candidates = await prisma.item.findMany({
    where: {
      id: { not: itemId },
      type: source.type === 'lost' ? 'found' : 'lost',
      status: { in: ACTIVE_MATCH_STATUSES },
      deletedAt: null,
    },
    select: ITEM_MATCH_SELECT,
    take: 500,
  });
  const scored = candidates
    .map((candidate) => ({ candidate, ...calculateMatch(source, candidate) }))
    .filter((entry) => entry.score >= threshold)
    .sort((a, b) => b.score - a.score || new Date(b.candidate.happenedAt) - new Date(a.candidate.happenedAt))
    .slice(0, checkedLimit(limit));

  const suggestions = [];
  for (const entry of scored) {
    const match = await persistSuggestion(itemId, entry.candidate, entry.score, entry.reasons);
    suggestions.push({
      matchId: match.id,
      targetItemId: entry.candidate.id,
      score: entry.score,
      reasons: entry.reasons,
      status: match.status,
      candidate: itemDto(entry.candidate),
    });
  }

  await logAudit({
    adminId,
    action: 'item.match.suggest',
    targetType: 'item',
    targetId: itemId,
    detail: { count: suggestions.length, threshold },
  });
  return { sourceItemId: itemId, suggestions };
}

async function updateDecision({ itemId, matchId, status, note, adminId }) {
  const result = await prisma.lostFoundMatch.updateMany({
    where: { id: matchId, sourceItemId: itemId, status: 'suggested' },
    data: { status, decisionNote: note || null, decidedBy: adminId },
  });
  if (result.count === 0) {
    const existing = await prisma.lostFoundMatch.findFirst({ where: { id: matchId, sourceItemId: itemId } });
    if (!existing) throw ApiError.notFound('匹配建议不存在');
    throw new ApiError(CODE.CONFLICT, '匹配建议已被其他操作处理，请刷新后重试', 409);
  }
  const updated = await prisma.lostFoundMatch.findUnique({ where: { id: matchId }, include: { target: { select: ITEM_MATCH_SELECT } } });
  await logAudit({ adminId, action: `item.match.${status}`, targetType: 'lost_found_match', targetId: matchId, detail: { itemId, targetItemId: updated.targetItemId, note } });
  return { matchId, sourceItemId: itemId, targetItemId: updated.targetItemId, status: updated.status, note: updated.decisionNote };
}

export function confirmMatch(args) { return updateDecision({ ...args, status: 'confirmed' }); }
export function ignoreMatch(args) { return updateDecision({ ...args, status: 'ignored' }); }

export async function manualMatch({ itemId, targetItemId, targetItemNo, note, adminId }) {
  let resolvedTargetId = targetItemId;
  if (!resolvedTargetId && targetItemNo) {
    const targetByNo = await prisma.item.findUnique({ where: { itemNo: targetItemNo }, select: { id: true } });
    if (!targetByNo) throw ApiError.notFound('目标编号不存在或已删除');
    resolvedTargetId = targetByNo.id;
  }
  if (itemId === resolvedTargetId) throw ApiError.badRequest('不能把记录关联到自身');
  const [source, target] = await Promise.all([loadItem(itemId), loadItem(resolvedTargetId)]);
  if (source.type === target.type) throw ApiError.badRequest('人工关联必须是一条报失记录和一条拾物记录');
  const calculated = calculateMatch(source, target);
  const match = await prisma.lostFoundMatch.upsert({
    where: { sourceItemId_targetItemId: { sourceItemId: itemId, targetItemId: resolvedTargetId } },
    create: { sourceItemId: itemId, targetItemId: resolvedTargetId, score: calculated.score, reasons: [{ code: 'manual', label: '管理员手动关联', points: 0 }, ...calculated.reasons], status: 'confirmed', decisionNote: note || null, decidedBy: adminId },
    update: { score: calculated.score, reasons: [{ code: 'manual', label: '管理员手动关联', points: 0 }, ...calculated.reasons], status: 'confirmed', decisionNote: note || null, decidedBy: adminId },
    select: { id: true, status: true, score: true, reasons: true, decisionNote: true },
  });
  await logAudit({ adminId, action: 'item.match.manual', targetType: 'lost_found_match', targetId: match.id, detail: { itemId, targetItemId: resolvedTargetId, note } });
  return { matchId: match.id, sourceItemId: itemId, targetItemId: resolvedTargetId, score: match.score, reasons: match.reasons, status: match.status, note: match.decisionNote };
}
