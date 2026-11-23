// 分类查询。分类由管理员维护（阶段⑥），这里只提供读取。
import { prisma } from '../db/prisma.js';

/** 公开分类列表：只返回启用的分类，按运营排序 */
export async function listCategories({ includeDisabled = false } = {}) {
  return prisma.category.findMany({
    where: includeDisabled ? {} : { enabled: true },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    select: { id: true, name: true, sortOrder: true, enabled: true },
  });
}
