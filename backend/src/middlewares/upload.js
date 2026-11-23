// 上传中间件：multer 收内存缓冲，交由 sharp 处理后再落盘。
// 这样原始文件不会以未处理的形式留在磁盘上。
import multer from 'multer';

import { ALLOWED_MIME, MAX_UPLOAD_BYTES } from '../services/upload.service.js';
import { ApiError } from '../utils/response.js';

const uploader = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    // 注意：mimetype 由客户端声明，真正的类型判定靠后面 sharp 解析
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(ApiError.badRequest('仅支持 jpg / png / webp 格式的图片'));
    }
    cb(null, true);
  },
});

// 游客投稿附件：只接收图片，服务端统一通过 sharp 重编码；最多 3 张，每张 5MB。
const publicAttachmentUploader = multer({
  storage: multer.memoryStorage(),
  // 公开表单正文由 Zod 做字段级长度校验，这里先限制 multipart 单字段和字段总数，
  // 防止未知字段在进入校验前占用过多内存。
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 3, fieldSize: 64 * 1024, fields: 30 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(ApiError.badRequest('附件仅支持 jpg / png / webp 图片'));
    }
    cb(null, true);
  },
});

/** 接收单个文件，字段名固定为 image */
export function singleImage(req, res, next) {
  uploader.single('image')(req, res, (error) => {
    if (!error) return next();
    if (error instanceof ApiError) return next(error);

    // multer 的错误码转成统一的中文提示
    if (error.code === 'LIMIT_FILE_SIZE') {
      return next(ApiError.badRequest('图片不能超过 5MB'));
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return next(ApiError.badRequest('字段名应为 image，且每次只能上传一张'));
    }
    return next(ApiError.badRequest('图片上传失败，请确认文件格式后重试'));
  });
}

/** 游客投稿附件，字段名固定为 attachments。 */
export function publicAttachments(req, res, next) {
  publicAttachmentUploader.array('attachments', 3)(req, res, (error) => {
    if (!error) return next();
    if (error instanceof ApiError) return next(error);
    if (error.code === 'LIMIT_FILE_SIZE') return next(ApiError.badRequest('单个附件不能超过 5MB'));
    if (error.code === 'LIMIT_FIELD_SIZE') return next(ApiError.badRequest('表单字段内容过大'));
    if (error.code === 'LIMIT_FIELD_COUNT') return next(ApiError.badRequest('表单字段过多'));
    if (error.code === 'LIMIT_FILE_COUNT' || error.code === 'LIMIT_UNEXPECTED_FILE') {
      return next(ApiError.badRequest('最多上传 3 个图片附件，字段名应为 attachments'));
    }
    return next(ApiError.badRequest('附件上传失败，请确认文件格式后重试'));
  });
}

// ---------- 学号名单 CSV ----------

const MAX_CSV_BYTES = 2 * 1024 * 1024;

const csvUploader = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_CSV_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    // 浏览器对 CSV 的 mimetype 不统一（text/csv、application/vnd.ms-excel 都有），
    // 再兜一层扩展名判断
    const isCsv =
      file.mimetype === 'text/csv' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.mimetype === 'text/plain' ||
      /\.csv$/i.test(file.originalname);

    if (!isCsv) return cb(ApiError.badRequest('请上传 .csv 格式的文件'));
    cb(null, true);
  },
});

/** 接收单个 CSV 文件，字段名固定为 file */
export function singleCsv(req, res, next) {
  csvUploader.single('file')(req, res, (error) => {
    if (!error) return next();
    if (error instanceof ApiError) return next(error);
    if (error.code === 'LIMIT_FILE_SIZE') {
      return next(ApiError.badRequest('CSV 文件不能超过 2MB'));
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return next(ApiError.badRequest('字段名应为 file，且每次只能上传一个文件'));
    }
    return next(ApiError.badRequest('文件上传失败，请确认文件格式后重试'));
  });
}
