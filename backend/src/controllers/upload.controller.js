// 上传控制器
import { processAndSaveImage } from '../services/upload.service.js';
import { ApiError, success } from '../utils/response.js';

/** POST /api/upload */
export async function uploadImage(req, res) {
  if (!req.file) throw ApiError.badRequest('请选择要上传的图片（字段名 image）');

  const result = await processAndSaveImage(req.file.buffer);
  return success(res, result, '上传成功', 201);
}
