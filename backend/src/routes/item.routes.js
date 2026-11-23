// 帖子路由。
// 读接口用 optionalAuth：登录用户能看到联系方式，游客拿不到。
import { Router } from 'express';
import {
  create,
  detail,
  list,
  remove,
  report,
  resolve,
  update,
} from '../controllers/item.controller.js';
import { authRequired, optionalAuth } from '../middlewares/auth.js';
import { validateBody, validateParams, validateQuery } from '../middlewares/validate.js';
import {
  createItemSchema,
  idParamSchema,
  listItemsQuerySchema,
  reportSchema,
  updateItemSchema,
} from '../validators/item.validator.js';

const router = Router();

// 列表对所有人返回同一套字段（不含联系方式），因此不做鉴权查询
router.get('/', validateQuery(listItemsQuerySchema), list);
// 详情用 optionalAuth：登录用户才拿得到联系方式
router.get('/:id', optionalAuth, validateParams(idParamSchema), detail);

router.post('/', authRequired, validateBody(createItemSchema), create);
router.put(
  '/:id',
  authRequired,
  validateParams(idParamSchema),
  validateBody(updateItemSchema),
  update,
);
router.patch('/:id/resolve', authRequired, validateParams(idParamSchema), resolve);
router.delete('/:id', authRequired, validateParams(idParamSchema), remove);

router.post(
  '/:id/report',
  authRequired,
  validateParams(idParamSchema),
  validateBody(reportSchema),
  report,
);

export default router;
