import fs from 'node:fs/promises';

import * as publicService from '../services/public.service.js';
import { success } from '../utils/response.js';
import * as submissionService from '../services/publicSubmission.service.js';
import { resolveStoredImagePath } from '../services/upload.service.js';
import { env } from '../config/env.js';

export async function profile(_req, res) {
  return success(res, await publicService.getProfile());
}

export async function categories(req, res) {
  return success(res, await publicService.listPublicCategories(req.validatedQuery?.kind));
}

export async function newsList(req, res) {
  return success(res, await publicService.listNews(req.validatedQuery ?? {}));
}

export async function newsDetail(req, res) {
  return success(res, await publicService.getNews(req.validatedParams.idOrSlug));
}

export async function canteenList(req, res) {
  return success(res, await publicService.listCanteenReports(req.validatedQuery ?? {}));
}

export async function canteenDetail(req, res) {
  return success(res, await publicService.getCanteenReport(req.validatedParams.month));
}

export async function lostFoundList(req, res) {
  return success(res, await publicService.listLostFound(req.validatedQuery ?? {}));
}

export async function lostFoundDetail(req, res) {
  return success(res, await publicService.getLostFound(req.validatedParams.id));
}

export async function lostFoundImage(req, res) {
  const url = await publicService.getPublicLostFoundImage(req.validatedParams.id, req.validatedParams.imageId);
  const filename = resolveStoredImagePath(url);
  if (!filename) return res.status(404).json({ code: 40401, message: '图片不存在或暂未公开', data: null });
  let image;
  try {
    image = await fs.readFile(filename);
  } catch {
    return res.status(404).json({ code: 40401, message: '图片不存在或暂未公开', data: null });
  }
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Disposition', 'inline; filename="lost-found-image.webp"');
  res.type('image/webp').send(image);
}

export function robots(_req, res) {
  const lines = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin/',
    'Disallow: /api/',
    'Disallow: /mailbox/query',
    'Disallow: /canteen/feedback',
    'Disallow: /lost-found/report',
    'Disallow: /lost-found/found',
    'Disallow: /lost-found/inquiry',
    'Disallow: /*?*',
  ];
  if (env.PUBLIC_SITE_URL) lines.push(`Sitemap: ${env.PUBLIC_SITE_URL.replace(/\/$/, '')}/sitemap.xml`);
  res.type('text/plain').send(`${lines.join('\n')}\n`);
}

export async function sitemap(_req, res) {
  if (!env.PUBLIC_SITE_URL) return res.status(503).type('text/plain').send('站点地址尚未配置');
  const base = env.PUBLIC_SITE_URL.replace(/\/$/, '');
  const entries = await publicService.getPublicSitemapEntries();
  const escapeXml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]);
  const urls = entries.map(({ path, lastmod }) => {
    const lastmodTag = lastmod ? `<lastmod>${new Date(lastmod).toISOString().slice(0, 10)}</lastmod>` : '';
    return `<url><loc>${escapeXml(`${base}${path}`)}</loc>${lastmodTag}</url>`;
  }).join('');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);
}

export async function mailboxList(req, res) {
  return success(res, await publicService.listPublicMailbox(req.validatedQuery ?? {}));
}

export async function queryStatus(req, res) {
  return success(res, await publicService.getPublicSubmissionStatus(req.body));
}

const context = (req) => ({ ip: req.ip, requestId: req.id, idempotencyKey: req.get('Idempotency-Key') });

export async function createCanteenFeedback(req, res) {
  return success(res, await submissionService.createCanteenFeedback(req.body, req.files, context(req)), '投稿已提交，等待管理员审核', 201);
}

export async function createMailboxMessage(req, res) {
  return success(res, await submissionService.createMailboxMessage(req.body, req.files, context(req)), '信件已提交，等待管理员审核', 201);
}

export async function createLostFoundItem(req, res) {
  return success(res, await submissionService.createLostFoundItem(req.body, req.files, context(req)), '登记已提交，等待管理员审核', 201);
}

export async function createLostFoundInquiry(req, res) {
  return success(res, await submissionService.createLostFoundInquiry(req.validatedParams.id, req.body, req.files, context(req)), '线索已提交，等待管理员审核', 201);
}
