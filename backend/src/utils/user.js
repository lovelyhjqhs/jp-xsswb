// 对外暴露的用户字段白名单。
// 所有返回用户信息的查询都必须用它 select，从源头上杜绝 passwordHash 泄漏。
export const PUBLIC_USER_SELECT = {
  id: true,
  studentNo: true,
  name: true,
  role: true,
  status: true,
  createdAt: true,
  lastLoginAt: true,
};

/**
 * 姓名脱敏：保留首字，其余用 * 代替（张三 → 张*，欧阳娜娜 → 欧***）。
 *
 * 为什么放在服务端：如果只在前端截断，任何人直接调接口仍能拿到全名，
 * 等于没脱敏。作者本人和管理员可以看到完整姓名。
 */
export function maskName(name) {
  const chars = Array.from((name ?? '').trim());
  if (chars.length === 0) return '';
  if (chars.length === 1) return `${chars[0]}*`;
  return `${chars[0]}${'*'.repeat(chars.length - 1)}`;
}
