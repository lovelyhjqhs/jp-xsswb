// 后台：分类管理
import {
  createCategory,
  deleteCategory,
  listCategoriesForAdmin,
  updateCategory,
} from '../../services/admin/category.admin.service.js';
import { success } from '../../utils/response.js';

/** GET /api/admin/categories */
export async function list(_req, res) {
  const data = await listCategoriesForAdmin();
  return success(res, data);
}

/** POST /api/admin/categories */
export async function create(req, res) {
  const category = await createCategory({ ...req.body, adminId: req.user.id });
  return success(res, category, '分类已创建', 201);
}

/** PATCH /api/admin/categories/:id */
export async function update(req, res) {
  const category = await updateCategory({
    categoryId: req.validatedParams.id,
    data: req.body,
    adminId: req.user.id,
  });
  return success(res, category, '分类已更新');
}

/** DELETE /api/admin/categories/:id */
export async function remove(req, res) {
  await deleteCategory({ categoryId: req.validatedParams.id, adminId: req.user.id });
  return success(res, null, '分类已删除');
}
