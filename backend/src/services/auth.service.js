// 认证业务逻辑。控制器只负责取参和组装响应，规则都写在这里。
import { prisma } from '../db/prisma.js';
import { env } from '../config/env.js';
import { signToken } from '../utils/jwt.js';
import { DUMMY_HASH, hashPassword, verifyPassword } from '../utils/password.js';
import { ApiError, CODE } from '../utils/response.js';
import { PUBLIC_USER_SELECT } from '../utils/user.js';

/**
 * 白名单校验：学号必须存在且姓名与名单一致。
 * 单独导出便于单测。
 */
export async function assertWhitelisted({ studentNo, name }) {
  const entry = await prisma.studentWhitelist.findUnique({ where: { studentNo } });

  if (!entry || entry.name.trim() !== name.trim()) {
    throw new ApiError(
      CODE.FORBIDDEN,
      '该学号不在可注册名单内，或姓名与名单不一致，请联系管理员',
      403,
    );
  }
}

/** 注册：新建学生账号 */
export async function registerUser({ studentNo, name, password }) {
  // 白名单开关打开时，先过名单这道门
  if (env.ENABLE_WHITELIST) {
    await assertWhitelisted({ studentNo, name });
  }

  const existing = await prisma.user.findUnique({
    where: { studentNo },
    select: { id: true },
  });
  if (existing) {
    throw ApiError.conflict('该学号已注册，请直接登录');
  }

  try {
    return await prisma.user.create({
      data: { studentNo, name, passwordHash: await hashPassword(password) },
      select: PUBLIC_USER_SELECT,
    });
  } catch (error) {
    // 并发注册同学号时，唯一索引会抛 P2002，转成友好提示
    if (error.code === 'P2002') {
      throw ApiError.conflict('该学号已注册，请直接登录');
    }
    throw error;
  }
}

/** 登录：校验凭证并签发 JWT */
export async function loginUser({ studentNo, password }) {
  const user = await prisma.user.findUnique({ where: { studentNo } });

  // 账号不存在时也做一次哈希比对，抹平响应时间差异
  const passwordOk = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);

  // 「学号不存在」与「密码错误」返回完全相同的提示，防止枚举有效学号
  if (!user || !passwordOk) {
    throw new ApiError(CODE.UNAUTHORIZED, '学号或密码错误', 401);
  }

  // 只有密码正确才提示账号被禁用，否则等于帮攻击者确认账号存在
  if (user.status === 'banned') {
    throw new ApiError(CODE.FORBIDDEN, '账号已被禁用，请联系管理员', 403);
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
    select: PUBLIC_USER_SELECT,
  });

  return {
    token: signToken(user),
    tokenType: 'Bearer',
    expiresIn: env.JWT_EXPIRES_IN,
    user: updated,
  };
}

/** 按 id 取当前用户（/me 用，保证资料是最新的） */
export async function getUserById(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: PUBLIC_USER_SELECT,
  });
  if (!user) throw ApiError.unauthorized('账号不存在，请重新登录');
  return user;
}

/** 修改密码：必须先验证原密码 */
export async function changePassword({ userId, oldPassword, newPassword }) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, passwordHash: true },
  });
  if (!user) throw ApiError.unauthorized('账号不存在，请重新登录');

  const oldPasswordOk = await verifyPassword(oldPassword, user.passwordHash);
  if (!oldPasswordOk) {
    // 用 400 而不是 401：调用方已持有有效 token，这里只是参数不对，
    // 返回 401 会让前端误以为登录态失效而跳登录页。
    throw ApiError.badRequest('原密码不正确');
  }

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(newPassword) },
  });
}
