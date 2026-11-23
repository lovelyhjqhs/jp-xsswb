// 访问日志：只记录「方法、路径、状态码、耗时、IP」
//
// 刻意不记录 query string / 请求体 / 请求头：
// - query 里可能有搜索关键词（用户隐私）
// - 请求头里有 Authorization（令牌）
// - 请求体里有密码与联系方式
import { randomUUID } from 'node:crypto';

import { logger } from '../utils/logger.js';

export function requestLogger(req, res, next) {
  req.id = randomUUID();
  res.setHeader('X-Request-Id', req.id);

  // 健康检查太频繁，单独降级到 debug
  const isHealth = req.path === '/api/health';
  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const detail = {
      method: req.method,
      path: req.route ? `${req.baseUrl}${req.route.path}` : (isHealth ? req.path : '/unmatched'),
      status: res.statusCode,
      ms: Math.round(durationMs),
    };

    if (isHealth) logger.debug('http', detail);
    else if (res.statusCode >= 500) logger.error('http', detail);
    else if (res.statusCode >= 400) logger.warn('http', detail);
    else logger.info('http', detail);
  });

  next();
}
