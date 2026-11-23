// 后台路由
//
// 安全要点：鉴权放在 router.use 上，而不是逐个路由书写。
// 这样新增后台接口时不可能「忘记加管理员校验」。
import { Router } from 'express';

import * as categories from '../controllers/admin/category.admin.controller.js';
import * as items from '../controllers/admin/item.admin.controller.js';
import * as overview from '../controllers/admin/overview.admin.controller.js';
import * as reports from '../controllers/admin/report.admin.controller.js';
import * as users from '../controllers/admin/user.admin.controller.js';
import * as whitelist from '../controllers/admin/whitelist.admin.controller.js';
import * as submissions from '../controllers/admin/submission.admin.controller.js';
import * as site from '../controllers/admin/site.admin.controller.js';
import * as media from '../controllers/admin/media.admin.controller.js';
import * as adminAuth from '../controllers/admin/auth.admin.controller.js';
import * as lostFoundMatch from '../controllers/admin/lostFoundMatch.admin.controller.js';
import { adminSessionRequired } from '../middlewares/auth.js';
import { singleCsv, singleImage } from '../middlewares/upload.js';
import { validateBody, validateParams, validateQuery } from '../middlewares/validate.js';
import {
  adminAuditQuerySchema,
  adminBatchSchema,
  adminCategoryCreateSchema,
  adminCategoryUpdateSchema,
  adminIdParamSchema,
  adminItemsQuerySchema,
  adminRejectSchema,
  adminReportHandleSchema,
  adminReportsQuerySchema,
  adminUserItemsQuerySchema,
  adminUserStatusSchema,
  adminUsersQuerySchema,
  adminWhitelistQuerySchema,
  adminSubmissionsQuerySchema,
  adminSubmissionParamsSchema,
  adminSubmissionActionBodySchema,
  adminSiteStatusQuerySchema,
  adminSiteIdParamSchema,
  adminRecycleParamSchema,
  adminSiteActionParamSchema,
  adminSiteProfileSchema,
  adminNewsSchema,
  adminCanteenReportSchema,
  adminRecycleQuerySchema,
  adminMediaQuerySchema,
  adminMediaBodySchema,
  adminReportPhotosSchema,
  adminItemMatchQuerySchema,
  adminItemMatchParamsSchema,
  adminItemMatchDecisionSchema,
  adminItemManualMatchSchema,
} from '../validators/admin.validator.js';
import { adminLoginSchema } from '../validators/auth.validator.js';
import { loginRateLimit } from '../middlewares/loginRateLimit.js';

const router = Router();

// 专用管理员认证端点不继承后台资源鉴权，但登录本身仍受限流和严格校验保护。
router.post('/auth/login', loginRateLimit, validateBody(adminLoginSchema), adminAuth.login);
router.get('/auth/me', adminSessionRequired, adminAuth.me);
router.post('/auth/logout', adminSessionRequired, adminAuth.logout);

// 所有 /api/admin/* 统一要求：已登录 + 管理员
router.use(adminSessionRequired);

// ---------- 数据概览 ----------
router.get('/stats', overview.stats);
router.get('/audit-logs', validateQuery(adminAuditQuerySchema), overview.auditLogs);

// ---------- 游客投稿审核 ----------
router.get('/submissions', validateQuery(adminSubmissionsQuerySchema), submissions.list);
router.post('/submissions/:type/:id/:action', validateParams(adminSubmissionParamsSchema), validateBody(adminSubmissionActionBodySchema), submissions.change);

// ---------- 官网内容管理 ----------
router.get('/site/profile', site.profile);
router.put('/site/profile', validateBody(adminSiteProfileSchema), site.saveProfile);
router.post('/site/profile/:action', site.profileAction);
router.get('/site/news', validateQuery(adminSiteStatusQuerySchema), site.newsList);
router.get('/site/news/:id', validateParams(adminSiteIdParamSchema), site.newsDetail);
router.post('/site/news', validateBody(adminNewsSchema), site.newsSave);
router.patch('/site/news/:id', validateParams(adminSiteIdParamSchema), validateBody(adminNewsSchema), site.newsSave);
router.post('/site/news/:id/:action', validateParams(adminSiteActionParamSchema), site.newsAction);
router.get('/site/canteen-reports', validateQuery(adminSiteStatusQuerySchema), site.reportList);
router.post('/site/canteen-reports', validateBody(adminCanteenReportSchema), site.reportSave);
router.patch('/site/canteen-reports/:id', validateParams(adminSiteIdParamSchema), validateBody(adminCanteenReportSchema), site.reportSave);
router.put('/site/canteen-reports/:id/photos', validateParams(adminSiteIdParamSchema), validateBody(adminReportPhotosSchema), site.reportPhotos);
router.post('/site/canteen-reports/:id/:action', validateParams(adminSiteActionParamSchema), site.reportAction);
router.get('/site/recycle-bin', validateQuery(adminRecycleQuerySchema), site.recycleList);
router.post('/site/recycle-bin/:type/:id/restore', validateParams(adminRecycleParamSchema), site.recycleRestore);
router.get('/private-attachments/:year/:month/:filename', media.privateAttachment);
router.post('/site/media', singleImage, validateBody(adminMediaBodySchema), media.upload);
router.get('/site/media', validateQuery(adminMediaQuerySchema), media.list);
router.get('/site/media/:id/file', validateParams(adminIdParamSchema), media.mediaFile);
router.patch('/site/media/:id', validateParams(adminIdParamSchema), validateBody(adminMediaBodySchema.partial()), media.update);
router.delete('/site/media/:id', validateParams(adminIdParamSchema), media.remove);

// ---------- 内容管理 ----------
router.get('/items', validateQuery(adminItemsQuerySchema), items.listItems);
router.post('/items/batch', validateBody(adminBatchSchema), items.batchItems);
router.post('/items/:id/approve', validateParams(adminIdParamSchema), items.approveItem);
router.post(
  '/items/:id/reject',
  validateParams(adminIdParamSchema),
  validateBody(adminRejectSchema),
  items.rejectItem,
);
router.post('/items/:id/offline', validateParams(adminIdParamSchema), items.offlineItem);
router.post('/items/:id/clean', validateParams(adminIdParamSchema), items.cleanItem);
router.post('/items/:id/archive', validateParams(adminIdParamSchema), items.archiveItem);
router.post('/items/:id/restore', validateParams(adminIdParamSchema), items.restoreItem);
router.delete('/items/:id', validateParams(adminIdParamSchema), items.deleteItem);
router.get('/items/:id/matches', validateParams(adminIdParamSchema), validateQuery(adminItemMatchQuerySchema), lostFoundMatch.listMatches);
router.post('/items/:id/matches/manual', validateParams(adminIdParamSchema), validateBody(adminItemManualMatchSchema), lostFoundMatch.manual);
router.post('/items/:id/matches/:matchId/confirm', validateParams(adminItemMatchParamsSchema), validateBody(adminItemMatchDecisionSchema), lostFoundMatch.confirm);
router.post('/items/:id/matches/:matchId/ignore', validateParams(adminItemMatchParamsSchema), validateBody(adminItemMatchDecisionSchema), lostFoundMatch.ignore);

// ---------- 用户管理 ----------
if (process.env.NODE_ENV === 'test') {
  router.get('/users', validateQuery(adminUsersQuerySchema), users.list);
  router.patch('/users/:id/status', validateParams(adminIdParamSchema), validateBody(adminUserStatusSchema), users.updateStatus);
  router.post('/users/:id/reset-password', validateParams(adminIdParamSchema), users.resetPassword);
  router.get('/users/:id/items', validateParams(adminIdParamSchema), validateQuery(adminUserItemsQuerySchema), users.userItems);
}

// ---------- 举报处理 ----------
router.get('/reports', validateQuery(adminReportsQuerySchema), reports.list);
router.post(
  '/reports/:id/handle',
  validateParams(adminIdParamSchema),
  validateBody(adminReportHandleSchema),
  reports.handle,
);

// ---------- 分类管理 ----------
router.get('/categories', categories.list);
router.post('/categories', validateBody(adminCategoryCreateSchema), categories.create);
router.patch(
  '/categories/:id',
  validateParams(adminIdParamSchema),
  validateBody(adminCategoryUpdateSchema),
  categories.update,
);
router.delete('/categories/:id', validateParams(adminIdParamSchema), categories.remove);

// ---------- 学号白名单 ----------
if (process.env.NODE_ENV === 'test') {
  router.get('/whitelist', validateQuery(adminWhitelistQuerySchema), whitelist.list);
  router.post('/whitelist/preview', singleCsv, whitelist.preview);
  router.post('/whitelist/import', singleCsv, whitelist.importCsv);
}

export default router;
