// 环境变量集中校验：格式错误或缺失时在启动阶段直接失败，
// 避免服务"起来了"却在第一个请求才炸。
import { z } from 'zod';

// 环境变量都是字符串，这里统一把 "true"/"false" 转成布尔
const booleanString = (defaultValue = 'false') =>
  z
    .enum(['true', 'false'])
    .default(defaultValue)
    .transform((value) => value === 'true');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL 不能为空'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET 至少 32 位，否则签名可被暴力破解'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  ADMIN_SESSION_COOKIE: z.string().min(1).default('admin_session'),
  ADMIN_CSRF_COOKIE: z.string().min(1).default('admin_csrf'),
  ADMIN_SESSION_TTL_MINUTES: z.coerce.number().int().min(5).max(1440).default(480),
  ADMIN_COOKIE_SECURE: booleanString('true'),
  // 游客查询编号/凭证的有效期；历史记录为空值时保持兼容，不会被误判为过期
  PUBLIC_QUERY_TTL_DAYS: z.coerce.number().int().min(1).max(3650).default(30),

  // 业务开关
  REQUIRE_REVIEW: booleanString(),
  ENABLE_WHITELIST: booleanString(),

  // 学号格式（默认 8-12 位纯数字），顺手校验它是合法正则
  STUDENT_NO_REGEX: z
    .string()
    .default('^\\d{8,12}$')
    .refine((pattern) => {
      try {
        new RegExp(pattern);
        return true;
      } catch {
        return false;
      }
    }, 'STUDENT_NO_REGEX 不是合法的正则表达式'),

  // 用户上传图片的存放目录（相对 backend/，也可给绝对路径）
  UPLOAD_DIR: z.string().min(1).default('uploads'),
  // 游客投稿附件单独保存，不由静态文件服务直接托管
  PRIVATE_UPLOAD_DIR: z.string().min(1).default('private-uploads'),
  AUDIT_LOG_RETENTION_DAYS: z.coerce.number().int().min(30).max(3650).default(365),
  PUBLIC_SITE_URL: z.string().url().or(z.literal('')).default(''),

  // ---------- 安全相关 ----------
  // 跨域白名单（逗号分隔）。同域部署（nginx 反代 /api）时用不到 CORS，
  // 但开发期前端在 5173，需要显式放行。
  CORS_ORIGINS: z.string().default('http://localhost:5173,http://127.0.0.1:5173'),
  // 反向代理层数：nginx 前置时设 1，限流才能按真实客户端 IP 计数
  TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(0),
  // 全局限流（默认 15 分钟 600 次/IP）
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(600),
  // 是否暴露 /api/docs 接口文档
  ENABLE_API_DOCS: booleanString('false'),
  // 日志级别：debug / info / warn / error
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

const parsed = envSchema.superRefine((value, ctx) => {
  if (value.NODE_ENV === 'production') {
    if (/(dev-only|test-only|please-change-me|change-me|replace-me)/i.test(value.JWT_SECRET)) {
      ctx.addIssue({ code: 'custom', path: ['JWT_SECRET'], message: '生产环境不得使用示例密钥' });
    }
    let publicUrl;
    try {
      publicUrl = new URL(value.PUBLIC_SITE_URL);
    } catch {
      publicUrl = null;
    }
    if (
      !publicUrl || publicUrl.protocol !== 'https:' || publicUrl.username || publicUrl.password ||
      publicUrl.search || publicUrl.hash || publicUrl.pathname !== '/'
    ) {
      ctx.addIssue({ code: 'custom', path: ['PUBLIC_SITE_URL'], message: '生产环境必须配置 HTTPS 站点地址' });
    }
  }
}).safeParse(process.env);

if (!parsed.success) {
  console.error('❌ 环境变量校验失败，请检查 backend/.env（可参考根目录 .env.example）：');
  for (const issue of parsed.error.issues) {
    console.error(`   - ${issue.path.join('.') || '(root)'}：${issue.message}`);
  }
  process.exit(1);
}

const normalizedEnv = {
  ...parsed.data,
  // 本地 HTTP 开发默认不启用 Secure；生产若未显式配置则保持 Secure。
  ADMIN_COOKIE_SECURE:
    process.env.ADMIN_COOKIE_SECURE === undefined
      ? parsed.data.NODE_ENV === 'production'
      : parsed.data.ADMIN_COOKIE_SECURE,
};
export const env = Object.freeze(normalizedEnv);
export const isProduction = env.NODE_ENV === 'production';
