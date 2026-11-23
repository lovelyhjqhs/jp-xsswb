// 全局限流：按 IP 限制 /api 的总请求速率
//
// 与 loginRateLimit 的分工：
// - 这一层是「全站防洪」，防止单 IP 打爆接口
// - loginRateLimit 统计的是「密码错误次数」，用来挡撞库，两者叠加
import { rateLimit } from 'express-rate-limit';

import { env } from '../config/env.js';
import { CODE } from '../utils/response.js';

/**
 * 创建一个限流中间件。
 * @param {object} options
 * @param {number} options.windowMs 时间窗口
 * @param {number} options.max 窗口内最多请求数
 * @param {string} [options.message] 超限提示
 */
export function createRateLimiter({ windowMs, max, message = '请求过于频繁，请稍后再试' }) {
  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({ code: CODE.TOO_MANY_REQUESTS, message, data: null });
    },
  });
}

/** 生产/开发环境使用的全局限流（参数来自环境变量） */
export function apiLimiter() {
  return createRateLimiter({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
  });
}

/** 游客投稿专用限流：避免单个地址批量灌入审核队列。 */
export function publicSubmissionLimiter() {
  return createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: '投稿过于频繁，请 15 分钟后再试',
  });
}

/** 查询编号属于敏感凭证入口，限制猜测与批量探测。 */
export function publicQueryLimiter() {
  return createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: '查询过于频繁，请 15 分钟后再试',
  });
}
