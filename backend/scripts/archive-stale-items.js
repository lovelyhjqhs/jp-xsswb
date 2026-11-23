#!/usr/bin/env node
// 定时任务：归档超过 90 天仍为 open 的帖子
//
// 用法：
//   node scripts/archive-stale-items.js                # 真的归档
//   node scripts/archive-stale-items.js --dry-run      # 只统计，不修改
//   node scripts/archive-stale-items.js --days=60      # 自定义天数
//
// 建议的 crontab（每天 03:10）：
//   10 3 * * * cd /app/backend && node scripts/archive-stale-items.js >> /var/log/clf-archive.log 2>&1
import { prisma } from '../src/db/prisma.js';
import { archiveStaleItems, ARCHIVE_AFTER_DAYS } from '../src/services/maintenance.service.js';
import { logger } from '../src/utils/logger.js';

function parseArgs(argv) {
  const options = { days: ARCHIVE_AFTER_DAYS, dryRun: false };

  for (const arg of argv) {
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg.startsWith('--days=')) options.days = Number(arg.split('=')[1]);
  }
  return options;
}

const options = parseArgs(process.argv.slice(2));

try {
  const result = await archiveStaleItems(options);

  logger.info('job.archive.finished', {
    days: result.days,
    cutoff: result.cutoff.toISOString(),
    matched: result.matched,
    archived: result.archived,
    dryRun: result.dryRun,
  });

  // 人物可读的一行摘要，方便在 cron 日志里扫
  console.log(
    `[archive] ${result.dryRun ? 'DRY-RUN ' : ''}超过 ${result.days} 天的 open 帖子：命中 ${result.matched} 条，归档 ${result.archived} 条`,
  );
} catch (error) {
  logger.error('job.archive.failed', { name: error.name });
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
