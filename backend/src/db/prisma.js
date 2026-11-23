// Prisma 客户端单例。
// 全进程共用一个连接池，不要在业务里 new PrismaClient()。
import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';

export const prisma = new PrismaClient({
  log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

/** 探活用：能跑通这条 SQL 说明连接池和数据库都正常 */
export async function pingDatabase() {
  await prisma.$queryRaw`SELECT 1`;
}
