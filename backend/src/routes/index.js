// 路由总入口：正式运行只挂载 admin/guest 网站接口。
import { Router } from 'express';
import adminRoutes from './admin.routes.js';
import authRoutes from './auth.routes.js';
import categoryRoutes from './category.routes.js';
import docsRoutes from './docs.routes.js';
import itemRoutes from './item.routes.js';
import meRoutes from './me.routes.js';
import uploadRoutes from './upload.routes.js';
import publicRoutes from './public.routes.js';
import { env } from '../config/env.js';
import { pingDatabase } from '../db/prisma.js';
import { ApiError, CODE, success } from '../utils/response.js';
import { logger } from '../utils/logger.js';

const router = Router();

// GET /api/health —— 探活 + 数据库连通性自检
router.get('/health', async (_req, res, next) => {
  try {
    await pingDatabase();
    success(res, {
      status: 'ok',
      db: 'up',
      uptime: Math.round(process.uptime()),
      time: new Date().toISOString(),
    });
  } catch {
    logger.error('database.health_check_failed', { requestId: _req.id });
    next(new ApiError(CODE.SERVER_ERROR, '服务暂时不可用', 503));
  }
});

// 旧学生账号 API 只供迁移回归测试使用；开发与生产均不提供普通账号能力。
if (env.NODE_ENV === 'test') {
  router.use('/auth', authRoutes);
  router.use('/items', itemRoutes);
  router.use('/categories', categoryRoutes);
  router.use('/upload', uploadRoutes);
  router.use('/me', meRoutes);
}
router.use('/admin', adminRoutes);
router.use('/public', publicRoutes);

// API 文档默认关闭，确需使用时由环境变量显式开启。
if (env.ENABLE_API_DOCS && env.NODE_ENV !== 'production') {
  router.use('/docs', docsRoutes);
}

export default router;
