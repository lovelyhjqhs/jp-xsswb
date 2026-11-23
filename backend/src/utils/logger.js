// 结构化日志 + 敏感字段脱敏
//
// 两条硬规则：
// 1. 只打结构化字段（JSON），不打请求体、不打请求头 —— 密码、token、联系方式
//    都可能出现在 body / header 里，一旦整段打出来就再也收不回去了。
// 2. 即使调用方传了敏感字段，这里也会按键名再兜一层脱敏。
//
// 输出到 stdout/stderr，交给容器日志驱动或 journald 收集，不在应用内落文件。
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

const SENSITIVE_KEY =
  /^(pass(word)?|pwd|token|authorization|cookie|set-cookie|secret|jwt|contactvalue|studentno|tempPassword)$/i;

function currentLevel() {
  return LEVELS[process.env.LOG_LEVEL] ?? LEVELS.info;
}

/** 递归脱敏 + 截断超长字符串，避免日志被刷爆 */
function redact(value, depth = 0) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    return value.length > 300 ? `${value.slice(0, 300)}…(truncated)` : value;
  }
  if (typeof value !== 'object') return value;
  if (depth > 3) return '[too-deep]';
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => redact(item, depth + 1));

  const output = {};
  for (const [key, item] of Object.entries(value)) {
    output[key] = SENSITIVE_KEY.test(key) ? '[redacted]' : redact(item, depth + 1);
  }
  return output;
}

function write(level, event, detail) {
  if (LEVELS[level] < currentLevel()) return;

  const record = {
    time: new Date().toISOString(),
    level,
    event,
    ...(detail === undefined ? {} : { detail: redact(detail) }),
  };
  const line = JSON.stringify(record);

  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (event, detail) => write('debug', event, detail),
  info: (event, detail) => write('info', event, detail),
  warn: (event, detail) => write('warn', event, detail),
  error: (event, detail) => write('error', event, detail),
};
