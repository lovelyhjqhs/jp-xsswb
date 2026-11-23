// 测试数据库清理工具。
import { prisma } from '../../src/db/prisma.js';

/**
 * 清空业务表。
 * 顺序按外键依赖从叶子到根，避免约束报错。
 * categories 也一并清空：现在每个测试文件自己造分类，避免用例之间互相影响。
 */
export async function resetDatabase() {
  // 官网游客投稿与内容表先清理，避免投稿凭证、幂等键和分类残留影响后续用例。
  await prisma.lostFoundInquiry.deleteMany();
  await prisma.canteenFeedback.deleteMany();
  await prisma.mailboxMessage.deleteMany();
  await prisma.canteenReportMedia.deleteMany();
  await prisma.canteenMonthlyReport.deleteMany();
  await prisma.news.deleteMany();
  await prisma.departmentProfile.deleteMany();
  await prisma.siteMedia.deleteMany();
  await prisma.siteCategory.deleteMany();
  await prisma.itemImage.deleteMany();
  await prisma.report.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.adminSession.deleteMany();
  await prisma.item.deleteMany();
  await prisma.category.deleteMany();
  await prisma.studentWhitelist.deleteMany();
  await prisma.user.deleteMany();
}

export { prisma };
