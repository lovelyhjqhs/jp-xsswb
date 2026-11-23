// 全局错误处理：所有异常都从这里输出 { code, message, data }，保证响应格式统一。
import { ApiError, CODE } from '../utils/response.js';
import { logger } from '../utils/logger.js';

/** 未匹配到任何路由 */
export function notFoundHandler(req, res) {
  res.status(404).json({
    code: CODE.NOT_FOUND,
    message: '请求的资源不存在',
    data: null,
  });
}

/**
 * Express 错误中间件，必须保留 4 个参数，否则不会被视为错误处理器。
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  // 1. 主动抛出的业务异常
  if (err instanceof ApiError) {
    return res.status(err.httpStatus).json({
      code: err.code,
      message: err.message,
      data: err.data,
    });
  }

  // 2. body 不是合法 JSON
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({
      code: CODE.PARAM_ERROR,
      message: '请求体不是合法的 JSON',
      data: null,
    });
  }

  // 3. 兜底：未知异常。生产环境不回传细节，避免泄漏内部实现
  // 不记录底层异常消息或堆栈，数据库驱动错误可能包含查询与连接信息。
  logger.error('unhandled_error', {
    name: err.name,
    method: req.method,
    path: req.route ? `${req.baseUrl}${req.route.path}` : '/unmatched',
    requestId: req.id,
  });

  return res.status(500).json({
    code: CODE.SERVER_ERROR,
    message: '服务器内部错误',
    data: null,
  });
}
