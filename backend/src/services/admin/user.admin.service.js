// 用户管理：列表、禁用/启用、重置密码、查看某人的发帖记录
import { prisma } from '../../db/prisma.js';
import { hashPassword } from '../../utils/password.js';
import { ApiError } from '../../utils/response.js';
import { escapeLikePattern } from '../../utils/sql.js';
import { generateTempPassword } from '../../utils/tempPassword.js';
import { logAudit } from '../audit.service.js';

const USER_SELECT = {
  id: true,
  studentNo: true,
  name: true,
  role: true,
  status: true,
  createdAt: true,
  lastLoginAt: true,
  _count: { select: { items: true } },
};

function buildPagination(page, pageSize, total) {
  return { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

/** 用户列表：按学号/姓名模糊搜索，可按状态筛选 */
export async function listUsers(query) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;

  const where = {};
  if (query.status) where.status = query.status;
  if (query.keyword) {
    // 转义 LIKE 通配符
    const keyword = escapeLikePattern(query.keyword);
    where.OR = [{ studentNo: { contains: keyword } }, { name: { contains: keyword } }];
  }

  const [total, rows] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: USER_SELECT,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return { list: rows, pagination: buildPagination(page, pageSize, total) };
}

/** 禁用 / 启用账号 */
export async function setUserStatus({ userId, status, adminId }) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, studentNo: true, name: true, role: true, status: true },
  });
  if (!user) throw ApiError.notFound('用户不存在');

  // 两道保护：不能操作自己（否则可能把自己锁在门外），也不能动其他管理员
  if (user.id === adminId) throw ApiError.badRequest('不能修改自己的账号状态');
  if (user.role === 'admin') throw ApiError.forbidden('不能修改管理员账号的状态');

  if (user.status === status) {
    return { ...user, changed: false };
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { status },
    select: USER_SELECT,
  });

  await logAudit({
    adminId,
    action: status === 'banned' ? 'user.ban' : 'user.unban',
    targetType: 'user',
    targetId: userId,
    detail: { studentNo: user.studentNo, name: user.name, from: user.status, to: status },
  });

  return { ...updated, changed: true };
}

/** 重置密码：返回一次性临时密码（库里只存哈希，明文不落库、不进审计日志） */
export async function resetUserPassword({ userId, adminId }) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, studentNo: true, name: true, role: true },
  });
  if (!user) throw ApiError.notFound('用户不存在');

  // 管理员密码只能由本人通过 /api/auth/password 修改，
  // 否则一个管理员账号失陷就能直接接管其他管理员账号
  if (user.role === 'admin' && user.id !== adminId) {
    throw ApiError.forbidden('不能重置其他管理员的密码');
  }

  const tempPassword = generateTempPassword();
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(tempPassword) },
  });

  await logAudit({
    adminId,
    action: 'user.resetPassword',
    targetType: 'user',
    targetId: userId,
    detail: { studentNo: user.studentNo, name: user.name },
  });

  return {
    studentNo: user.studentNo,
    name: user.name,
    tempPassword,
    notice: '临时密码只显示这一次，请立即转告用户并提醒其登录后修改',
  };
}

/** 查看某个用户的发帖记录 */
export async function listUserItems({ userId, page = 1, pageSize = 20 }) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, studentNo: true, name: true, status: true },
  });
  if (!user) throw ApiError.notFound('用户不存在');

  const [total, rows] = await prisma.$transaction([
    prisma.item.count({ where: { userId } }),
    prisma.item.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        type: true,
        title: true,
        status: true,
        viewCount: true,
        createdAt: true,
        category: { select: { id: true, name: true } },
      },
    }),
  ]);

  return {
    user,
    list: rows,
    pagination: buildPagination(page, pageSize, total),
  };
}
