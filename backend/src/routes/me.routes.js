// 当前用户相关路由（路径前缀 /api/me）
import { Router } from 'express';
import { mine } from '../controllers/item.controller.js';
import { authRequired } from '../middlewares/auth.js';
import { validateQuery } from '../middlewares/validate.js';
import { myItemsQuerySchema } from '../validators/item.validator.js';

const router = Router();

// GET /api/me/items —— 我的发布（含全部状态）
router.get('/items', authRequired, validateQuery(myItemsQuerySchema), mine);

export default router;
