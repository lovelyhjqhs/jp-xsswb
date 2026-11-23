// 学号白名单：CSV 预览 / 导入 / 列表
import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';
import { ApiError } from '../../utils/response.js';
import { escapeLikePattern } from '../../utils/sql.js';
import { logAudit } from '../audit.service.js';

const MAX_ROWS = 5000;

/**
 * 把上传的 CSV 解码成文本。
 *
 * 两个现实问题：
 * 1. Excel 在中文 Windows 下默认导出 GBK 编码，直接按 UTF-8 解会得到乱码；
 * 2. 部分编辑器会写入 UTF-8 BOM，导致第一列匹配失败。
 * 处理方式：先按 UTF-8 解，出现替换字符就改用 GBK 再解一次。
 */
export function decodeCsv(buffer) {
  let text = buffer.toString('utf8');
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  if (text.includes('\uFFFD')) {
    try {
      text = new TextDecoder('gbk').decode(buffer);
      if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    } catch {
      // 运行环境不支持 gbk 时保持 UTF-8 的解析结果
    }
  }
  return text;
}

/** 解析 CSV：每行「学号,姓名」，自动跳过表头与空行 */
export function parseWhitelistCsv(text) {
  const pattern = new RegExp(env.STUDENT_NO_REGEX);
  const lines = text.split(/\r?\n/);

  const rows = [];
  let started = false;

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) return;

    const cells = line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, ''));
    const studentNo = cells[0] ?? '';
    const name = cells[1] ?? '';

    // 首行是表头就跳过（「学号,姓名」或「studentNo,name」）
    if (!started) {
      started = true;
      if (/^(学号|student_?no)$/i.test(studentNo)) return;
    }

    const lineNo = index + 1;

    if (!pattern.test(studentNo)) {
      rows.push({ lineNo, studentNo, name, status: 'invalid', reason: '学号格式不符合要求' });
      return;
    }
    if (!name || name.length > 30) {
      rows.push({ lineNo, studentNo, name, status: 'invalid', reason: '姓名为空或超过 30 个字符' });
      return;
    }

    rows.push({ lineNo, studentNo, name, status: 'new' });
  });

  return rows;
}

/** 给每行标上最终状态：new / duplicate-in-file / duplicate-existing / invalid */
async function classifyRows(rows) {
  const seen = new Set();
  const candidates = rows.filter((row) => row.status === 'new').map((row) => row.studentNo);

  const existing = candidates.length
    ? await prisma.studentWhitelist.findMany({
        where: { studentNo: { in: candidates } },
        select: { studentNo: true },
      })
    : [];
  const existingSet = new Set(existing.map((row) => row.studentNo));

  for (const row of rows) {
    if (row.status !== 'new') continue;

    if (seen.has(row.studentNo)) {
      row.status = 'duplicate-in-file';
      row.reason = '文件内重复';
      continue;
    }
    seen.add(row.studentNo);

    if (existingSet.has(row.studentNo)) {
      row.status = 'duplicate-existing';
      row.reason = '名单中已存在';
    }
  }

  const summary = {
    total: rows.length,
    importable: rows.filter((row) => row.status === 'new').length,
    duplicateInFile: rows.filter((row) => row.status === 'duplicate-in-file').length,
    duplicateExisting: rows.filter((row) => row.status === 'duplicate-existing').length,
    invalid: rows.filter((row) => row.status === 'invalid').length,
  };

  return { rows, summary };
}

/** 预览：只解析与判定，不写库 */
export async function previewWhitelist(buffer) {
  const rows = parseWhitelistCsv(decodeCsv(buffer));
  if (rows.length === 0) throw ApiError.badRequest('CSV 里没有可识别的数据行');
  if (rows.length > MAX_ROWS) throw ApiError.badRequest(`单次最多导入 ${MAX_ROWS} 行`);
  return classifyRows(rows);
}

/**
 * 确认导入：重新解析并校验（不信任前端传来的预览结果），
 * 重复项跳过，最后给出一份导入报告。
 */
export async function importWhitelist({ buffer, adminId }) {
  const rows = parseWhitelistCsv(decodeCsv(buffer));
  if (rows.length === 0) throw ApiError.badRequest('CSV 里没有可识别的数据行');
  if (rows.length > MAX_ROWS) throw ApiError.badRequest(`单次最多导入 ${MAX_ROWS} 行`);

  const { rows: classified, summary } = await classifyRows(rows);
  const toInsert = classified.filter((row) => row.status === 'new');

  if (toInsert.length > 0) {
    await prisma.studentWhitelist.createMany({
      data: toInsert.map(({ studentNo, name }) => ({ studentNo, name })),
      // 并发或判定窗口内新增的重复项交给数据库兜底
      skipDuplicates: true,
    });
  }

  const imported = toInsert.length;

  await logAudit({
    adminId,
    action: 'whitelist.import',
    targetType: 'whitelist',
    targetId: null,
    detail: { imported, ...summary },
  });

  return {
    ...summary,
    imported,
    skipped: summary.total - imported,
    invalidRows: classified
      .filter((row) => row.status === 'invalid')
      .slice(0, 50)
      .map(({ lineNo, studentNo, reason }) => ({ lineNo, studentNo, reason })),
  };
}

/** 白名单列表（分页 + 学号/姓名搜索） */
export async function listWhitelist({ page = 1, pageSize = 20, keyword }) {
  const where = keyword
    ? {
        OR: [
          { studentNo: { contains: escapeLikePattern(keyword) } },
          { name: { contains: escapeLikePattern(keyword) } },
        ],
      }
    : {};

  const [total, rows] = await prisma.$transaction([
    prisma.studentWhitelist.count({ where }),
    prisma.studentWhitelist.findMany({
      where,
      orderBy: { id: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: { id: true, studentNo: true, name: true },
    }),
  ]);

  return {
    list: rows,
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  };
}
