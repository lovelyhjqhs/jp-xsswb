import { prisma } from '../db/prisma.js';
import { DUMMY_HASH, verifyPassword } from '../utils/password.js';
import { ApiError, CODE } from '../utils/response.js';
import { createAdminSession } from './adminSession.service.js';
import { logAudit } from './audit.service.js';

export async function loginAdmin({ studentNo, password, context = {} }) {
  const adminCount = await prisma.user.count({ where: { role: 'admin' } });
  if (adminCount !== 1) {
    await logAudit({ adminId: null, action: 'admin.login_blocked_configuration', targetType: 'admin_auth', detail: null });
    throw new ApiError(CODE.UNAUTHORIZED, '账号或密码错误', 401);
  }
  const admin = await prisma.user.findUnique({ where: { studentNo } });
  const passwordOk = await verifyPassword(password, admin?.passwordHash ?? DUMMY_HASH);

  if (!admin || admin.role !== 'admin' || !passwordOk) {
    await logAudit({ adminId: null, action: 'admin.login_failed', targetType: 'admin_auth', detail: null });
    throw new ApiError(CODE.UNAUTHORIZED, '账号或密码错误', 401);
  }
  if (admin.status !== 'active') {
    await logAudit({ adminId: admin.id, action: 'admin.login_blocked', targetType: 'admin_auth', targetId: admin.id });
    throw new ApiError(CODE.UNAUTHORIZED, '账号或密码错误', 401);
  }

  const updated = await prisma.user.update({
    where: { id: admin.id },
    data: { lastLoginAt: new Date() },
    select: { id: true, studentNo: true, name: true, role: true, status: true, lastLoginAt: true },
  });
  const session = await createAdminSession(updated, context);
  await logAudit({ adminId: admin.id, action: 'admin.login', targetType: 'admin_auth', targetId: admin.id });

  return { admin: updated, ...session };
}
