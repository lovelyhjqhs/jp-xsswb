// Express 应用装配。只负责中间件与路由挂载，不负责监听端口（便于写测试）。
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import { publicUpload } from './middlewares/publicUpload.js';
import { apiLimiter } from './middlewares/rateLimit.js';
import { requestLogger } from './middlewares/requestLogger.js';
import apiRoutes from './routes/index.js';

/** 跨域白名单（逗号分隔） */
const ALLOWED_ORIGINS = env.CORS_ORIGINS.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

/**
 * 只放行白名单来源。
 * 不在白名单时不回 CORS 响应头（浏览器自然会拦下），
 * 也不抛错 —— 避免把「谁在探测我」变成 500 日志噪音。
 */
function corsOrigin(origin, callback) {
  if (!origin) return callback(null, true); // curl / 服务端调用 / 同域导航
  if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
  return callback(null, false);
}

export function createApp() {
  const app = express();

  app.disable('x-powered-by');

  // 位于 nginx 之后时设为 1，否则限流拿到的会全是代理 IP
  if (env.TRUST_PROXY > 0) {
    app.set('trust proxy', env.TRUST_PROXY);
  }

  app.use(
    helmet({
      // 后端只吐 JSON：给 HTML 用的 CSP 由 nginx 下发（见 nginx/nginx.conf）。
      // 在这里开 CSP 只会挡住 /api/docs 页面，没有实际收益。
      contentSecurityPolicy: false,
      // 允许前端域名加载 /uploads 下的图片
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );

  app.use(
    cors({
      origin: corsOrigin,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-CSRF-Token'],
      maxAge: 86400,
    }),
  );

  app.use(requestLogger);

  // 请求体解析：JSON 上限 1MB，足够文本接口；图片走 multipart
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false }));

  // 公开文件必须关联公开媒体或已发布失物记录；无数据库关联时默认拒绝。
  app.use('/uploads', publicUpload);

  // 全局限流只作用于 /api，静态资源不受影响
  app.use('/api', apiLimiter(), apiRoutes);

  // 这两个必须放在所有路由之后，且顺序不能反
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
