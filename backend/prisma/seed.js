// 初始化数据：初始分类 + 初始管理员
// 幂等：可重复执行，不会产生重复数据，也不会重置已存在账号的密码。
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 与会话中约定的 7 个初始分类保持一致；sortOrder 决定前端展示顺序
const CATEGORIES = [
  { name: '证件卡类', sortOrder: 1 },
  { name: '电子产品', sortOrder: 2 },
  { name: '钥匙', sortOrder: 3 },
  { name: '书籍文具', sortOrder: 4 },
  { name: '衣物配饰', sortOrder: 5 },
  { name: '水杯雨伞', sortOrder: 6 },
  { name: '其他', sortOrder: 99 },
];

const BCRYPT_ROUNDS = 12;

function seedError(message) {
  return Object.assign(new Error(message), { safeForLogs: true });
}

async function seedCategories() {
  for (const category of CATEGORIES) {
    await prisma.category.upsert({
      where: { name: category.name },
      // 已存在则只校正排序，避免覆盖管理员后续的改名/停用操作
      update: { sortOrder: category.sortOrder },
      create: category,
    });
  }
  const total = await prisma.category.count();
  console.log(`[seed] 分类就绪，共 ${total} 个`);
}

async function seedAdmin() {
  const studentNo = process.env.ADMIN_STUDENT_NO?.trim();
  const name = process.env.ADMIN_NAME?.trim() || '系统管理员';

  if (!studentNo) throw seedError('缺少 ADMIN_STUDENT_NO');

  const admins = await prisma.user.findMany({ where: { role: 'admin' }, select: { id: true, studentNo: true } });
  if (admins.length > 1) {
    throw seedError(`检测到 ${admins.length} 个管理员账号；本系统只允许唯一管理员，请先检查数据库`);
  }
  if (admins.length === 1 && admins[0].studentNo !== studentNo) {
    throw seedError('数据库已存在其他管理员账号；初始化脚本不会创建或替换第二个管理员');
  }

  const existing = await prisma.user.findUnique({ where: { studentNo } });

  if (existing && existing.role !== 'admin') {
    throw seedError('管理员账号标识已被其他账号占用；初始化脚本不会提升普通账号');
  }

  if (existing) {
    // Existing admin credentials and enabled state are never changed by seed.
    await prisma.user.update({
      where: { studentNo },
      data: { name },
    });
    console.log('[seed] 已有管理员账号已确认；密码与启用状态未修改');
    return;
  }

  const password = process.env.ADMIN_PASSWORD;
  if (!password) throw seedError('创建首个管理员时必须提供 ADMIN_PASSWORD');
  const passwordBytes = Buffer.byteLength(password, 'utf8');
  if (passwordBytes < 16 || passwordBytes > 72) {
    throw seedError('管理员初始密码长度必须为 16 至 72 个 UTF-8 字节');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  await prisma.user.create({
    data: { studentNo, name, passwordHash, role: 'admin', status: 'active' },
  });
  console.log('[seed] 唯一管理员账号已创建');
}

async function main() {
  await seedCategories();
  await seedAdmin();
}

main()
  .catch((error) => {
    const message = error?.safeForLogs ? error.message : '初始化失败，请检查数据库连接和迁移状态';
    console.error(`[seed] ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
