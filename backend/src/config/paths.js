// 上传目录解析。
// 默认存 backend/uploads，可通过 UPLOAD_DIR 覆盖（部署时通常挂载独立卷）。
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './env.js';

// src/config → src → backend
const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export const UPLOAD_ROOT = path.isAbsolute(env.UPLOAD_DIR)
  ? env.UPLOAD_DIR
  : path.join(backendRoot, env.UPLOAD_DIR);

export const PRIVATE_UPLOAD_ROOT = path.isAbsolute(env.PRIVATE_UPLOAD_DIR)
  ? env.PRIVATE_UPLOAD_DIR
  : path.join(backendRoot, env.PRIVATE_UPLOAD_DIR);

/** 对外 URL 前缀，与 app.js 里的静态托管路径保持一致 */
export const UPLOAD_URL_PREFIX = '/uploads';
export const PRIVATE_UPLOAD_URL_PREFIX = '/private-uploads';
