// 认证路由。
import { Router } from 'express';
import { changePassword, login, me, register } from '../controllers/auth.controller.js';
import { authRequired } from '../middlewares/auth.js';
import { loginRateLimit } from '../middlewares/loginRateLimit.js';
import { validateBody } from '../middlewares/validate.js';
import {
  changePasswordSchema,
  loginSchema,
  registerSchema,
} from '../validators/auth.validator.js';
import { env } from '../config/env.js';

const router = Router();

// 正式站点只有 guest 与唯一 admin；旧学生账号接口仅在 test 环境保留，
// 用于回归既有失物业务，不向开发/生产入口暴露注册或普通用户登录。
if (env.NODE_ENV === 'test') {
  router.post('/register', validateBody(registerSchema), register);
  router.post('/login', loginRateLimit, validateBody(loginSchema), login);
  router.get('/me', authRequired, me);
  router.put('/password', authRequired, validateBody(changePasswordSchema), changePassword);
}

export default router;
