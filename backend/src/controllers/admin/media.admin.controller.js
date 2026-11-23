import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../../db/prisma.js';
import { PRIVATE_UPLOAD_ROOT, UPLOAD_ROOT } from '../../config/paths.js';
import { processAndSaveImage } from '../../services/upload.service.js';
import { logAudit } from '../../services/audit.service.js';
import { ApiError, success } from '../../utils/response.js';

export async function upload(req, res) {
  if (!req.file) throw ApiError.badRequest('请选择要上传的图片（字段名 image）');
  const image = await processAndSaveImage(req.file.buffer);
  const row = await prisma.siteMedia.create({ data: { url: image.url, altText: req.body.altText?.trim() || '部门网站图片', mimeType: 'image/webp', kind: 'image', visibility: req.body.visibility || 'private', byteSize: image.size, width: image.width, height: image.height, sha256: createHash('sha256').update(req.file.buffer).digest('hex'), uploadedBy: req.user.id } });
  await logAudit({ adminId: req.user.id, action: 'site.media.upload', targetType: 'site_media', targetId: row.id });
  return success(res, row, '上传成功', 201);
}

export async function privateAttachment(req, res) {
  const { year, month, filename } = req.params;
  if (!/^\d{4}$/.test(year) || !/^(0[1-9]|1[0-2])$/.test(month) || !/^[a-f0-9]{32}\.webp$/.test(filename)) {
    throw ApiError.notFound('附件不存在');
  }
  const relativePath = path.join(year, month, filename);
  let image;
  for (const root of [PRIVATE_UPLOAD_ROOT, UPLOAD_ROOT]) {
    try {
      image = await fs.readFile(path.join(root, relativePath));
      break;
    } catch { /* Try the legacy upload volume for existing submissions. */ }
  }
  if (!image) throw ApiError.notFound('附件不存在');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Disposition', 'inline; filename="submission-attachment.webp"');
  res.type('image/webp').send(image);
}

export async function mediaFile(req, res) {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) throw ApiError.notFound('图片不存在');
  const media = await prisma.siteMedia.findFirst({ where: { id, deletedAt: null }, select: { url: true } });
  if (!media) throw ApiError.notFound('图片不存在');
  const match = /^\/uploads\/(\d{4})\/(0[1-9]|1[0-2])\/([a-f0-9]{32}\.webp)$/.exec(media.url);
  if (!match) throw ApiError.notFound('图片不存在');
  const filename = path.join(UPLOAD_ROOT, match[1], match[2], match[3]);
  let image;
  try { image = await fs.readFile(filename); } catch { throw ApiError.notFound('图片不存在'); }
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Disposition', 'inline; filename="site-media.webp"');
  res.type('image/webp').send(image);
}

export async function list(req, res) {
  const rows = await prisma.siteMedia.findMany({ where: { ...(req.query.visibility ? { visibility: req.query.visibility } : {}), ...(req.query.includeDeleted === 'true' ? {} : { deletedAt: null }) }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 100 });
  return success(res, rows);
}

export async function remove(req, res) {
  const id = Number(req.params.id);
  const row = await prisma.siteMedia.findUnique({ where: { id }, select: { id: true, url: true } });
  if (!row) throw ApiError.notFound('媒体不存在');
  await prisma.siteMedia.update({ where: { id }, data: { deletedAt: new Date(), visibility: 'private' } });
  await logAudit({ adminId: req.user.id, action: 'site.media.delete', targetType: 'site_media', targetId: id });
  return success(res, null, '媒体已移入回收站');
}

export async function update(req, res) {
  const id = Number(req.params.id);
  const row = await prisma.siteMedia.findUnique({ where: { id }, select: { id: true, deletedAt: true } });
  if (!row || row.deletedAt) throw ApiError.notFound('媒体不存在或已删除');
  const updated = await prisma.siteMedia.update({ where: { id }, data: { ...(req.body.altText !== undefined ? { altText: req.body.altText.trim() } : {}), ...(req.body.visibility ? { visibility: req.body.visibility } : {}) } });
  await logAudit({ adminId: req.user.id, action: 'site.media.update', targetType: 'site_media', targetId: id });
  return success(res, updated, '媒体信息已更新');
}
