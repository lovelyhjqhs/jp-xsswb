// 后台接口入参校验
import { z } from 'zod';

/** 通用路径参数 id */
export const adminIdParamSchema = z.object({
  id: z.coerce.number().int().positive('ID 不合法'),
});

/** 查询参数里的空字符串一律当作「未传」 */
const optionalQuery = (schema) =>
  z.preprocess((value) => (value === '' || value === null ? undefined : value), schema.optional());

const pageField = optionalQuery(z.coerce.number().int().min(1, '页码从 1 开始'));
const pageSizeField = optionalQuery(z.coerce.number().int().min(1).max(100, '每页最多 100 条'));

const ITEM_STATUSES = ['pending', 'open', 'resolved', 'cleaned', 'rejected', 'offline'];
const ITEM_TYPES = ['lost', 'found'];

export const adminItemsQuerySchema = z.object({
  page: pageField,
  pageSize: pageSizeField,
  status: optionalQuery(z.enum(ITEM_STATUSES, { error: '状态取值不合法' })),
  type: optionalQuery(z.enum(ITEM_TYPES, { error: '类型只能是 lost 或 found' })),
  area: optionalQuery(z.enum(['A', 'B', 'D'], { error: '区域只能是 A、B 或 D' })),
  categoryId: optionalQuery(z.coerce.number().int().positive('分类 ID 不合法')),
  itemNo: optionalQuery(z.string().trim().max(40, '编号最多 40 个字符')),
  dateFrom: optionalQuery(z.coerce.date()),
  dateTo: optionalQuery(z.coerce.date()),
  keyword: optionalQuery(z.string().trim().max(50, '关键词最多 50 个字')),
}).superRefine((value, ctx) => {
  if (value.dateFrom && value.dateTo && value.dateFrom > value.dateTo) ctx.addIssue({ code: 'custom', path: ['dateTo'], message: '结束日期不能早于开始日期' });
});

export const adminItemMatchQuerySchema = z.object({
  limit: optionalQuery(z.coerce.number().int().min(1).max(50)),
  minScore: optionalQuery(z.coerce.number().int().min(0).max(100)),
});
export const adminItemMatchParamsSchema = z.object({
  id: z.coerce.number().int().positive('ID 不合法'),
  matchId: z.coerce.number().int().positive('匹配编号不合法'),
});
export const adminItemMatchDecisionSchema = z.object({ note: z.string().trim().max(500, '备注最多 500 个字').optional() });
export const adminItemManualMatchSchema = z.object({
  targetItemId: optionalQuery(z.coerce.number().int().positive('目标记录 ID 不合法')),
  targetItemNo: optionalQuery(z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/, '目标编号格式不正确')),
  note: z.string().trim().max(500, '备注最多 500 个字').optional(),
}).refine((value) => value.targetItemId || value.targetItemNo, { message: '请填写目标记录 ID 或目标编号', path: ['targetItemId'] });

const reasonField = z
  .string({ error: '请填写理由' })
  .trim()
  .min(2, '理由至少 2 个字')
  .max(200, '理由最多 200 个字');

/** 驳回必须填原因 */
export const adminRejectSchema = z.object({ reason: reasonField });

/** 批量操作 */
export const adminBatchSchema = z
  .object({
    action: z.enum(['approve', 'reject', 'offline', 'clean', 'archive', 'restore', 'delete'], {
      error: '批量操作类型不合法',
    }),
    ids: z
      .array(z.coerce.number().int().positive(), { error: '请选择要操作的帖子' })
      .min(1, '请至少选择 1 条')
      .max(100, '单次最多操作 100 条'),
    reason: reasonField.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.action === 'reject' && !data.reason) {
      ctx.addIssue({ code: 'custom', message: '批量驳回必须填写原因', path: ['reason'] });
    }
  });

export const adminUsersQuerySchema = z.object({
  page: pageField,
  pageSize: pageSizeField,
  status: optionalQuery(z.enum(['active', 'banned'], { error: '状态取值不合法' })),
  keyword: optionalQuery(z.string().trim().max(50, '关键词最多 50 个字')),
});

export const adminUserStatusSchema = z.object({
  status: z.enum(['active', 'banned'], { error: '状态只能是 active 或 banned' }),
});

export const adminReportsQuerySchema = z.object({
  page: pageField,
  pageSize: pageSizeField,
  status: optionalQuery(z.enum(['pending', 'handled'], { error: '状态取值不合法' })),
});

export const adminReportHandleSchema = z.object({
  action: z.enum(['offline', 'ignore'], { error: '处理方式只能是 offline 或 ignore' }),
  note: z.string().trim().max(200, '备注最多 200 个字').optional(),
});

export const adminCategoryCreateSchema = z.object({
  name: z
    .string({ error: '请输入分类名称' })
    .trim()
    .min(1, '请输入分类名称')
    .max(30, '分类名称最多 30 个字'),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  enabled: z.boolean().default(true),
});

export const adminCategoryUpdateSchema = z
  .object({
    name: z.string().trim().min(1, '分类名称不能为空').max(30, '分类名称最多 30 个字').optional(),
    sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
    enabled: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: '没有需要更新的字段' });

export const adminAuditQuerySchema = z.object({
  page: pageField,
  pageSize: pageSizeField,
  action: optionalQuery(z.string().trim().max(50)),
  targetType: optionalQuery(z.string().trim().max(30)),
});

export const adminWhitelistQuerySchema = z.object({
  page: pageField,
  pageSize: pageSizeField,
  keyword: optionalQuery(z.string().trim().max(50, '关键词最多 50 个字')),
});

export const adminUserItemsQuerySchema = z.object({
  page: pageField,
  pageSize: pageSizeField,
});

export const adminSubmissionTypeSchema = z.enum(['canteen_feedback', 'mailbox', 'lost_found_inquiry', 'lost_found_item'], { error: '投稿类型不合法' });
export const adminSubmissionActionSchema = z.enum(['approve', 'reject', 'process', 'archive', 'delete', 'restore'], { error: '投稿操作不合法' });
export const adminSubmissionsQuerySchema = z.object({
  type: adminSubmissionTypeSchema,
  page: pageField,
  pageSize: pageSizeField,
  status: optionalQuery(z.enum(['pending_review', 'approved', 'rejected', 'processing', 'processed', 'archived', 'deleted'], { error: '投稿状态不合法' })),
  keyword: optionalQuery(z.string().trim().max(80, '关键词最多 80 个字')),
});
export const adminSubmissionParamsSchema = z.object({
  type: adminSubmissionTypeSchema,
  id: z.coerce.number().int().positive('ID 不合法'),
  action: adminSubmissionActionSchema,
});
export const adminSubmissionActionBodySchema = z.object({
  reason: z.string().trim().max(500, '原因最多 500 个字').optional(),
  reply: z.string().trim().max(10000, '回复最多 10000 个字').optional(),
  publicContent: z.string().trim().max(10000, '公开内容最多 10000 个字').optional(),
  publicAllowed: z.preprocess((value) => (value === 'true' || value === '1' || value === true ? true : value === 'false' || value === '0' || value === false ? false : value), z.boolean().optional()),
});

export const adminSiteStatusQuerySchema = z.object({ page: pageField, pageSize: pageSizeField, status: optionalQuery(z.enum(['draft', 'pending_review', 'published', 'rejected', 'archived', 'deleted'])) , keyword: optionalQuery(z.string().trim().max(100)) });
export const adminSiteIdParamSchema = z.object({ id: z.coerce.number().int().positive('ID 不合法') });
export const adminRecycleParamSchema = z.object({ type: z.enum(['news', 'canteen_report', 'department_profile', 'mailbox', 'canteen_feedback', 'lost_found_inquiry', 'item', 'media']), id: z.coerce.number().int().positive('ID 不合法') });
export const adminSiteActionParamSchema = z.object({ id: z.coerce.number().int().positive('ID 不合法'), action: z.enum(['publish', 'withdraw', 'archive', 'delete', 'restore', 'reject']) });
export const adminSiteProfileSchema = z.object({ history: z.string().trim().min(1).max(50000), organization: z.string().trim().min(1).max(50000), spirit: z.string().trim().min(1).max(50000) });
export const adminNewsSchema = z.object({ slug: z.string().trim().min(1).max(160), title: z.string().trim().min(1).max(120), categoryId: z.coerce.number().int().positive().nullable().optional(), summary: z.string().trim().min(1).max(500), body: z.string().trim().min(1).max(200000), coverMediaId: z.coerce.number().int().positive().nullable().optional() });
export const adminCanteenReportSchema = z.object({ reportMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, '月份应为 YYYY-MM 且月份在 01-12'), surveySummary: z.string().trim().min(1).max(200000), feedbackSummary: z.string().trim().min(1).max(200000) });
export const adminRecycleQuerySchema = z.object({ page: pageField, pageSize: pageSizeField });
export const adminMediaQuerySchema = z.object({ visibility: optionalQuery(z.enum(['public', 'private', 'admin_only'])), includeDeleted: optionalQuery(z.enum(['true', 'false'])) });
export const adminMediaBodySchema = z.object({ altText: z.string().trim().max(255).optional(), visibility: z.enum(['public', 'private', 'admin_only']).default('private') });
export const adminReportPhotosSchema = z.object({ mediaIds: z.array(z.coerce.number().int().positive()).max(50) });
