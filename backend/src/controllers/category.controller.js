// 分类控制器
import { listCategories } from '../services/category.service.js';
import { success } from '../utils/response.js';

/** GET /api/categories */
export async function list(req, res) {
  const categories = await listCategories();
  return success(res, categories);
}
