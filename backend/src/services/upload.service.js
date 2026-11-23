// 图片处理：校验类型 → sharp 压缩 → 随机文件名落盘。
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

import {
  PRIVATE_UPLOAD_ROOT,
  PRIVATE_UPLOAD_URL_PREFIX,
  UPLOAD_ROOT,
  UPLOAD_URL_PREFIX,
} from '../config/paths.js';
import { ApiError } from '../utils/response.js';

/** 只允许这三种格式 */
export const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

// 最长边压到 1280px：手机端足够清晰，又能把几 MB 的原始照片压到一两百 KB
const MAX_EDGE = 1280;
const WEBP_QUALITY = 82;
const MAX_INPUT_PIXELS = 40_000_000;

async function processImage(buffer, root, urlPrefix) {
  let output;
  try {
    const image = sharp(buffer, { failOn: 'error', limitInputPixels: MAX_INPUT_PIXELS, animated: false });
    const metadata = await image.metadata();
    if (!['jpeg', 'png', 'webp'].includes(metadata.format)) {
      throw ApiError.badRequest('仅支持有效的 jpg / png / webp 图片');
    }
    output = await image
      .rotate()
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw ApiError.badRequest('图片无法安全解析，请更换图片后重试');
  }

  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const targetDir = path.join(root, year, month);
  await fs.mkdir(targetDir, { recursive: true });

  const filename = `${crypto.randomBytes(16).toString('hex')}.webp`;
  await fs.writeFile(path.join(targetDir, filename), output.data, { flag: 'wx', mode: 0o640 });

  return {
    url: `${urlPrefix}/${year}/${month}/${filename}`,
    width: output.info.width,
    height: output.info.height,
    size: output.info.size,
    format: output.info.format,
  };
}

/**
 * 处理并保存一张图片。
 * @returns {{url:string,width:number,height:number,size:number,format:string}}
 */
export async function processAndSaveImage(buffer) {
  return processImage(buffer, UPLOAD_ROOT, UPLOAD_URL_PREFIX);
}

/** 游客投稿图片写入独立目录，只能经审核后的受控图片接口读取。 */
export async function processAndSavePrivateImage(buffer) {
  return processImage(buffer, PRIVATE_UPLOAD_ROOT, PRIVATE_UPLOAD_URL_PREFIX);
}

/** 删除已处理图片，用于游客投稿在后续校验或入库失败时清理临时文件。 */
export async function removeProcessedImage(url) {
  const match = /^\/(uploads|private-uploads)\/(\d{4})\/(\d{2})\/([a-f0-9]{32})\.webp$/.exec(url ?? '');
  if (!match) return;
  const [, prefix, year, month, name] = match;
  const root = prefix === 'uploads' ? UPLOAD_ROOT : PRIVATE_UPLOAD_ROOT;
  await fs.rm(path.join(root, year, month, `${name}.webp`), { force: true });
}

export function resolveStoredImagePath(url) {
  const match = /^\/(uploads|private-uploads)\/(\d{4})\/(\d{2})\/([a-f0-9]{32})\.webp$/.exec(url ?? '');
  if (!match) return null;
  const [, prefix, year, month, filename] = match;
  const root = prefix === 'uploads' ? UPLOAD_ROOT : PRIVATE_UPLOAD_ROOT;
  return path.join(root, year, month, `${filename}.webp`);
}

/**
 * 校验帖子引用的图片地址：格式合法且文件确实存在。
 * 只接受本项目上传接口产出的相对路径，杜绝外部 URL 与路径穿越。
 */
export async function assertImageUrlUsable(url) {
  const match = /^\/uploads\/(\d{4})\/(\d{2})\/([a-f0-9]{32})\.webp$/.exec(url ?? '');
  if (!match) {
    throw ApiError.badRequest('图片地址不合法');
  }

  const [, year, month, name] = match;
  const absolutePath = path.join(UPLOAD_ROOT, year, month, `${name}.webp`);

  try {
    await fs.access(absolutePath);
  } catch {
    throw ApiError.badRequest('图片不存在或已失效，请重新上传');
  }
}
