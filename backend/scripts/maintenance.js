import { prisma } from '../src/db/prisma.js';
import { clearExpiredGuestCredentials, pruneAuditLogs } from '../src/services/maintenance.service.js';
import { logger } from '../src/utils/logger.js';

try {
  const [credentials, auditLogs] = await Promise.all([
    clearExpiredGuestCredentials(),
    pruneAuditLogs(),
  ]);
  logger.info('job.maintenance.finished', {
    clearedGuestCredentials: credentials.cleared,
    deletedAuditLogs: auditLogs.deleted,
    auditRetentionDays: auditLogs.days,
  });
} catch (error) {
  logger.error('job.maintenance.failed', { name: error.name });
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
