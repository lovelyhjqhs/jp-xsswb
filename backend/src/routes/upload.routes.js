// 上传路由：必须登录，避免被当成匿名图床
import { Router } from 'express';
import { uploadImage } from '../controllers/upload.controller.js';
import { authRequired } from '../middlewares/auth.js';
import { singleImage } from '../middlewares/upload.js';

const router = Router();

router.post('/', authRequired, singleImage, uploadImage);

export default router;
