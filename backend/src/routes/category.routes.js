// 分类路由
import { Router } from 'express';
import { list } from '../controllers/category.controller.js';

const router = Router();

router.get('/', list);

export default router;
