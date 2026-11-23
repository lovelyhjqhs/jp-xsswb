// 测试夹具：直接操作数据库造数据，绕开接口层。
import { prisma } from '../../src/db/prisma.js';
import { hashPassword } from '../../src/utils/password.js';

export const TEST_PASSWORD = 'Passw0rd123';

export async function createUser({
  studentNo = '20240002',
  name = '张三',
  password = TEST_PASSWORD,
  role = 'student',
  status = 'active',
} = {}) {
  return prisma.user.create({
    data: {
      studentNo,
      name,
      passwordHash: await hashPassword(password),
      role,
      status,
    },
  });
}

/** 往白名单里加一条记录（ENABLE_WHITELIST=true 时注册需要） */
export async function allowRegistration(studentNo, name = '名单学生') {
  return prisma.studentWhitelist.create({ data: { studentNo, name } });
}

/** 造一个分类 */
export async function createCategory({ name = '电子产品', sortOrder = 1, enabled = true } = {}) {
  return prisma.category.create({ data: { name, sortOrder, enabled } });
}

/** 直接往库里塞一条帖子（用于构造各种状态，跳过发布接口的限频） */
export async function createItemRecord({
  userId,
  categoryId,
  status = 'open',
  type = 'lost',
  title = '测试帖子',
  createdAt,
  contactType = 'wechat',
  contactValue = 'wx_seed_001',
} = {}) {
  return prisma.item.create({
    data: {
      userId,
      categoryId,
      type,
      title,
      description: '这是一条用于测试的帖子描述',
      location: '测试地点',
      happenedAt: new Date(Date.now() - 3600 * 1000),
      contactType,
      contactValue,
      status,
      ...(createdAt ? { createdAt } : {}),
    },
  });
}
