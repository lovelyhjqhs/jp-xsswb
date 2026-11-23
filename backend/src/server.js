// 进程入口：启动 HTTP 服务、自检数据库、处理优雅退出。
import { createApp } from './app.js';
import { env } from './config/env.js';
import { pingDatabase, prisma } from './db/prisma.js';
import { logger } from './utils/logger.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info('server.started', {
    url: `http://localhost:${env.PORT}`,
    env: env.NODE_ENV,
    docs: env.ENABLE_API_DOCS && env.NODE_ENV !== 'production' ? `http://localhost:${env.PORT}/api/docs` : 'disabled',
    trustProxy: env.TRUST_PROXY,
  });
});

// 启动时主动探一次库：库没起来就别让前端空等
pingDatabase()
  .then(() => logger.info('database.connected'))
  .catch((error) => logger.error('database.connect_failed', { name: error.name }));

/** 关闭服务：先停新请求，再断连接池，最后兜底强退 */
async function shutdown(signal) {
  logger.info('server.shutdown', { signal });

  server.close(async () => {
    await prisma.$disconnect();
    logger.info('server.stopped');
    process.exit(0);
  });

  // 兜底：5 秒内没关干净就强制退出，防止僵尸进程
  setTimeout(() => {
    logger.error('server.shutdown_timeout');
    process.exit(1);
  }, 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
