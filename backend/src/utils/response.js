// 统一响应格式与错误码
// 约定：所有接口返回 { code, message, data }；code=0 表示成功，其余为业务错误码。
// 错误码按段划分，便于前端区分处理：
//   400xx 参数/请求错误   401xx 未认证   403xx 无权限   404xx 不存在
//   410xx 查询已过期     409xx 冲突（重复等）
//   409xx 冲突（重复等）  429xx 限流     500xx 服务端错误

export const CODE = Object.freeze({
  OK: 0,
  PARAM_ERROR: 40001,
  UNAUTHORIZED: 40101,
  FORBIDDEN: 40301,
  NOT_FOUND: 40401,
  GONE: 41001,
  CONFLICT: 40901,
  TOO_MANY_REQUESTS: 42901,
  SERVER_ERROR: 50001,
});

/**
 * 成功响应
 * @param {import('express').Response} res
 * @param {unknown} data 业务数据
 * @param {string} message 提示文案
 * @param {number} httpStatus HTTP 状态码（创建资源用 201）
 */
export function success(res, data = null, message = 'ok', httpStatus = 200) {
  return res.status(httpStatus).json({ code: CODE.OK, message, data });
}

/**
 * 业务异常：由业务层抛出，交给全局 errorHandler 统一转成响应体。
 * 业务代码里不要直接 res.json 报错，保证格式一致。
 */
export class ApiError extends Error {
  /**
   * @param {number} code 业务错误码
   * @param {string} message 给用户看的提示
   * @param {number} httpStatus HTTP 状态码
   * @param {unknown} data 附加信息（如字段级错误）
   */
  constructor(code, message, httpStatus = 400, data = null) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.data = data;
  }

  static badRequest(message = '请求参数有误', data = null) {
    return new ApiError(CODE.PARAM_ERROR, message, 400, data);
  }

  static unauthorized(message = '请先登录') {
    return new ApiError(CODE.UNAUTHORIZED, message, 401);
  }

  static forbidden(message = '没有操作权限') {
    return new ApiError(CODE.FORBIDDEN, message, 403);
  }

  static notFound(message = '资源不存在') {
    return new ApiError(CODE.NOT_FOUND, message, 404);
  }

  static gone(message = '查询已过期') {
    return new ApiError(CODE.GONE, message, 410);
  }

  static conflict(message = '资源冲突') {
    return new ApiError(CODE.CONFLICT, message, 409);
  }
}
