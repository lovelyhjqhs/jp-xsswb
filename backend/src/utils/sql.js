/**
 * LIKE 通配符转义。
 *
 * Prisma 的 `contains` 最终会变成 `LIKE %值%`，参数本身是绑定变量（不存在 SQL 注入），
 * 但用户输入里的 `%` / `_` 会被当成通配符：搜一个 `%` 就能匹配所有记录，
 * 既是信息泄露（可以扫全表），也是无谓的全表扫描。
 *
 * MySQL 的 LIKE 默认转义符是反斜杠，所以这里把 `\ % _` 都转义，
 * 让它们退化成普通字符。
 */
export function escapeLikePattern(value) {
  if (typeof value !== 'string') return value;
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}
