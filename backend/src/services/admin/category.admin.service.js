// 分类管理：增删改、排序、启用停用
import { prisma } from '../../db/prisma.js';
import { ApiError, CODE } from '../../utils/response.js';
import { logAudit } from '../audit.service.js';

const CATEGORY_SELECT = {
  id: true,
  name: true,
  sortOrder: true,
  enabled: true,
  _count: { select: { items: true } },
};

/** 后台列表包含已停用分类，并带上各分类下的帖子数 */
export async function listCategoriesForAdmin() {
  return prisma.category.findMany({
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    select: CATEGORY_SELECT,
  });
}

export async function createCategory({ name, sortOrder = 0, enabled = true, adminId }) {
  try {
    const category = await prisma.category.create({
      data: { name, sortOrder, enabled },
      select: CATEGORY_SELECT,
    });

    await logAudit({
      adminId,
      action: 'category.create',
      targetType: 'category',
      targetId: category.id,
      detail: { name, sortOrder, enabled },
    });

    return category;
  } catch (error) {
    if (error.code === 'P2002') throw ApiError.conflict('该分类名称已存在');
    throw error;
  }
}

export async function updateCategory({ categoryId, data, adminId }) {
  const before = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true, name: true, sortOrder: true, enabled: true },
  });
  if (!before) throw ApiError.notFound('分类不存在');

  try {
    const updated = await prisma.category.update({
      where: { id: categoryId },
      data,
      select: CATEGORY_SELECT,
    });

    await logAudit({
      adminId,
      action: 'category.update',
      targetType: 'category',
      targetId: categoryId,
      detail: { before, after: data },
    });

    return updated;
  } catch (error) {
    if (error.code === 'P2002') throw ApiError.conflict('该分类名称已存在');
    throw error;
  }
}

/** 删除分类：名下还有帖子时拒绝，避免帖子失去归属 */
export async function deleteCategory({ categoryId, adminId }) {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true, name: true, _count: { select: { items: true } } },
  });
  if (!category) throw ApiError.notFound('分类不存在');

  if (category._count.items > 0) {
    throw new ApiError(
      CODE.CONFLICT,
      `该分类下还有 ${category._count.items} 条帖子，请先把帖子迁移到其他分类`,
      409,
    );
  }

  await prisma.category.delete({ where: { id: categoryId } });

  await logAudit({
    adminId,
    action: 'category.delete',
    targetType: 'category',
    targetId: categoryId,
    detail: { name: category.name },
  });
}
