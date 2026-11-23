// 测试环境共用配置。
// 注意：src/config/env.js 在模块加载时就会读取并校验 process.env，
// 因此这些值必须在任何业务模块被 import 之前写进 process.env
// （由 tests/setup/environment.js 完成）。
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'mysql://campus:campus_dev_pwd@127.0.0.1:3306/campus_lostfound_test';

export const TEST_ENV = {
  NODE_ENV: 'test',
  // 测试不真的监听端口，但要满足 env.js 的 1-65535 校验
  PORT: '3100',
  DATABASE_URL: TEST_DATABASE_URL,
  // 仅测试用密钥，长度满足 env.js 的 ≥32 位要求
  JWT_SECRET: 'test-only-secret-0123456789abcdef0123456789',
  JWT_EXPIRES_IN: '7d',
  REQUIRE_REVIEW: 'false',
  ENABLE_WHITELIST: 'false',
  STUDENT_NO_REGEX: '^\\d{8,12}$',
  // 测试上传落到独立目录，避免污染真实上传文件
  UPLOAD_DIR: 'uploads-test',
  PRIVATE_UPLOAD_DIR: 'private-uploads-test',
  // 整套用例会发几百个请求，全局限流必须放开，否则会被自己限死
  RATE_LIMIT_WINDOW_MS: '60000',
  RATE_LIMIT_MAX: '100000',
  CORS_ORIGINS: 'http://localhost:5173',
  TRUST_PROXY: '0',
  ENABLE_API_DOCS: 'true',
  // 测试期间不打印访问日志
  LOG_LEVEL: 'error',
};
