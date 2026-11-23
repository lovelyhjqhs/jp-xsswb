// 登录限流：同一 IP 在 15 分钟内最多失败 10 次，超过后直接拒绝。
//
// 为什么只统计「失败」而不是所有请求：
// 正常用户偶尔输错一两次密码不该被锁；暴力破解的特征是大量失败。
// 存储用进程内 Map：单实例部署足够，重启即清零；
// 若将来多实例部署，需换成 Redis 之类的共享存储。
import { ApiError, CODE } from '../utils/response.js';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 10;

/** ip -> 失败时间戳数组 */
const failures = new Map();

function prune(timestamps, now) {
  return timestamps.filter((ts) => now - ts < WINDOW_MS);
}

export function loginRateLimit(req, res, next) {
  const now = Date.now();
  for (const [ip, timestamps] of failures) {
    const active = prune(timestamps, now);
    if (active.length) failures.set(ip, active);
    else failures.delete(ip);
  }
  const recent = prune(failures.get(req.ip) ?? [], now);

  if (recent.length >= MAX_FAILURES) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((WINDOW_MS - (now - recent[0])) / 1000),
    );
    res.setHeader('Retry-After', String(retryAfterSeconds));
    // 保留窗口，避免每次请求都重算
    failures.set(req.ip, recent);
    return next(
      new ApiError(
        CODE.TOO_MANY_REQUESTS,
        `登录失败次数过多，请 ${Math.ceil(retryAfterSeconds / 60)} 分钟后再试`,
        429,
        { retryAfter: retryAfterSeconds },
      ),
    );
  }

  if (recent.length > 0) failures.set(req.ip, recent);
  else failures.delete(req.ip);
  next();
}

/** 登录失败时调用 */
export function recordLoginFailure(ip) {
  const now = Date.now();
  const recent = prune(failures.get(ip) ?? [], now);
  recent.push(now);
  failures.set(ip, recent);
}

/** 登录成功时调用：清零该 IP 的失败记录 */
export function resetLoginFailures(ip) {
  failures.delete(ip);
}

/** 仅供测试使用：清空所有 IP 的记录 */
export function resetAllLoginFailures() {
  failures.clear();
}
