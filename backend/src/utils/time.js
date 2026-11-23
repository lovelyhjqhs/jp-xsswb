// 时间工具
const TZ_OFFSET_MS = 8 * 60 * 60 * 1000; // 东八区

/**
 * 一天的起点（东八区）。
 * 「每天最多发布 N 条」的额度按北京时间零点重置，
 * 这样与用户直觉一致，也不受服务器时区影响。
 */
export function startOfDayCN(now = new Date()) {
  const shifted = new Date(now.getTime() + TZ_OFFSET_MS);
  const utcMidnight = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate(),
  );
  return new Date(utcMidnight - TZ_OFFSET_MS);
}
