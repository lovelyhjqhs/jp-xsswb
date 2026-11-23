// zod 校验中间件：校验通过后把「解析后的值」写回 req.body。
// 好处：字符串已 trim、未知字段已被剔除，业务层拿到的永远是干净数据。
import { ApiError } from '../utils/response.js';

/** 把 zod 的 issues 压平成前端好用的 [{ field, message }] */
function formatIssues(issues) {
  return issues.map((issue) => ({
    field: issue.path.join('.') || '(body)',
    message: issue.message,
  }));
}

export function validateBody(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body ?? {});

    if (!result.success) {
      return next(ApiError.badRequest('请求参数校验失败', formatIssues(result.error.issues)));
    }

    req.body = result.data;
    next();
  };
}

// 说明：Express 5 里 req.query 是只读 getter，不能像 req.body 那样回写，
// 因此解析结果放到 req.validatedQuery / req.validatedParams，控制器从这两个属性读。
export function validateQuery(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.query ?? {});

    if (!result.success) {
      return next(ApiError.badRequest('查询参数校验失败', formatIssues(result.error.issues)));
    }

    req.validatedQuery = result.data;
    next();
  };
}

export function validateParams(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.params ?? {});

    if (!result.success) {
      return next(ApiError.badRequest('路径参数校验失败', formatIssues(result.error.issues)));
    }

    req.validatedParams = result.data;
    next();
  };
}
