// 举报处理
import { prisma } from '../../db/prisma.js';
import { ApiError, CODE } from '../../utils/response.js';
import { logAudit } from '../audit.service.js';

const REPORT_SELECT = {
  id: true,
  reason: true,
  status: true,
  createdAt: true,
  item: {
    select: {
      id: true,
      title: true,
      status: true,
      type: true,
      user: { select: { id: true, studentNo: true, name: true } },
    },
  },
  reporter: { select: { id: true, studentNo: true, name: true } },
  handler: { select: { id: true, name: true } },
};

function buildPagination(page, pageSize, total) {
  return { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

/** 举报列表：默认按时间倒序，可按处理状态筛选 */
export async function listReports({ page = 1, pageSize = 20, status }) {
  const where = status ? { status } : {};

  const [total, rows] = await prisma.$transaction([
    prisma.report.count({ where }),
    prisma.report.findMany({
      where,
      select: REPORT_SELECT,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return { list: rows, pagination: buildPagination(page, pageSize, total) };
}

/**
 * 处理举报。
 * action=offline：把被举报帖子下架，并把举报标记为已处理
 * action=ignore ：只把举报标记为已处理，帖子不动
 */
export async function handleReport({ reportId, action, note, adminId }) {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      status: true,
      itemId: true,
      item: { select: { id: true, title: true, status: true } },
      reporter: { select: { studentNo: true } },
    },
  });
  if (!report) throw ApiError.notFound('举报不存在');
  if (report.status === 'handled') {
    throw new ApiError(CODE.CONFLICT, '该举报已经处理过了', 409);
  }

  await prisma.$transaction(async (tx) => {
    if (action === 'offline') {
      await tx.item.update({ where: { id: report.itemId }, data: { status: 'offline' } });
    }
    await tx.report.update({
      where: { id: reportId },
      data: { status: 'handled', handledBy: adminId },
    });
  });

  await logAudit({
    adminId,
    action: action === 'offline' ? 'report.offline' : 'report.ignore',
    targetType: 'report',
    targetId: reportId,
    detail: {
      itemId: report.itemId,
      itemTitle: report.item.title,
      itemStatusBefore: report.item.status,
      reporter: report.reporter.studentNo,
      ...(note ? { note } : {}),
    },
  });

  return { reportId, action, itemId: report.itemId };
}
