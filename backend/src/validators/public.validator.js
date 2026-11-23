import { z } from 'zod';

const emptyToUndefined = (value) =>
  value === '' || value === null || value === undefined ? undefined : value;
const optional = (schema) => z.preprocess(emptyToUndefined, schema.optional());
const page = optional(z.coerce.number().int().min(1, '页码从 1 开始'));
const pageSize = optional(z.coerce.number().int().min(1).max(50, '每页最多 50 条'));
const date = optional(z.coerce.date());

export const idParamSchema = z.object({ id: z.coerce.number().int().positive('ID 不合法') });
export const itemImageParamSchema = z.object({
  id: z.coerce.number().int().positive('ID 不合法'),
  imageId: z.coerce.number().int().positive('图片编号不合法'),
});
export const newsIdParamSchema = z.object({ idOrSlug: z.string().trim().min(1).max(160) });
export const monthParamSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, '月份格式应为 YYYY-MM'),
});
export const categoriesQuerySchema = z.object({
  kind: optional(z.enum(['news', 'mailbox', 'canteen', 'lost_found'], { error: '分类类型不合法' })),
});

export const newsQuerySchema = z
  .object({ page, pageSize, categoryId: optional(z.coerce.number().int().positive()), keyword: optional(z.string().trim().max(50)), dateFrom: date, dateTo: date })
  .superRefine((v, ctx) => {
    if (v.dateFrom && v.dateTo && v.dateFrom > v.dateTo) ctx.addIssue({ code: 'custom', path: ['dateTo'], message: '结束日期不能早于开始日期' });
  });

export const canteenQuerySchema = z
  .object({ page, pageSize, monthFrom: optional(z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)), monthTo: optional(z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)) })
  .superRefine((v, ctx) => {
    if (v.monthFrom && v.monthTo && v.monthFrom > v.monthTo) ctx.addIssue({ code: 'custom', path: ['monthTo'], message: '结束月份不能早于开始月份' });
  });

export const lostFoundQuerySchema = z
  .object({
    page,
    pageSize,
    keyword: optional(z.string().trim().max(50)),
    type: optional(z.enum(['lost', 'found'])),
    categoryId: optional(z.coerce.number().int().positive()),
    status: optional(z.enum(['open', 'resolved', 'published', 'claimed_returned', 'cleaned'])),
    area: optional(z.enum(['A', 'B', 'D'])),
    itemNo: optional(z.string().trim().max(40).regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/, '编号格式不正确')),
    features: optional(z.string().trim().max(100)),
    dateFrom: date,
    dateTo: date,
  })
  .superRefine((v, ctx) => {
    if (v.dateFrom && v.dateTo && v.dateFrom > v.dateTo) ctx.addIssue({ code: 'custom', path: ['dateTo'], message: '结束日期不能早于开始日期' });
  });

export const mailboxQuerySchema = z
  .object({ page, pageSize, categoryId: optional(z.coerce.number().int().positive()), keyword: optional(z.string().trim().max(50)), dateFrom: date, dateTo: date })
  .superRefine((v, ctx) => {
    if (v.dateFrom && v.dateTo && v.dateFrom > v.dateTo) ctx.addIssue({ code: 'custom', path: ['dateTo'], message: '结束日期不能早于开始日期' });
  });

export const queryStatusSchema = z.object({
  queryNo: z.string().trim().regex(/^JP-[A-Z0-9-]{8,29}$/, '查询编号格式不正确'),
  queryCredential: z.string().trim().min(8).max(256),
});

const CONTACT_TYPES = ['wechat', 'qq', 'phone', 'other'];
const submissionMode = z.enum(['anonymous', 'signed'], { error: '提交方式不合法' });
const contactType = optional(z.enum(CONTACT_TYPES, { error: '联系方式类型不合法' }));
const contactValue = optional(z.string().trim().max(160, '联系方式最多 160 个字符'));
const lostContactValue = optional(z.string().trim().max(100, '联系方式最多 100 个字符'));
const className = optional(z.string().trim().max(80, '班级最多 80 个字符'));
const name = optional(z.string().trim().max(80, '姓名最多 80 个字符'));
const honeypot = optional(z.string().max(200));
const idempotencyKey = optional(z.string().trim().min(8).max(200));
const publicAllowed = z.preprocess(
  (value) => (value === '' || value === undefined || value === null ? false : value === true || value === 'true' || value === '1'),
  z.boolean(),
);

function addSignedIdentityRules(value, ctx) {
  if (value.submitMode === 'signed') {
    if (!value.className) ctx.addIssue({ code: 'custom', path: ['className'], message: '署名提交时请填写班级' });
    if (!value.name) ctx.addIssue({ code: 'custom', path: ['name'], message: '署名提交时请填写姓名' });
  }
  if ((value.contactType && !value.contactValue) || (!value.contactType && value.contactValue)) {
    ctx.addIssue({ code: 'custom', path: [value.contactType ? 'contactValue' : 'contactType'], message: '联系方式类型和内容需同时填写' });
  }
  if (value.contactType === 'phone' && value.contactValue && !/^1[3-9]\d{9}$/.test(value.contactValue)) {
    ctx.addIssue({ code: 'custom', path: ['contactValue'], message: '请输入正确的 11 位手机号' });
  }
  if (value.contactType === 'qq' && value.contactValue && !/^\d{5,12}$/.test(value.contactValue)) {
    ctx.addIssue({ code: 'custom', path: ['contactValue'], message: 'QQ 号应为 5-12 位数字' });
  }
}

/** 游客食堂意见：匿名时不要求姓名，署名时班级和姓名必填。 */
export const canteenFeedbackSchema = z.object({
  submitMode: submissionMode,
  reportMonth: optional(z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, '月份格式应为 YYYY-MM')),
  className,
  name,
  contactType,
  contactValue,
  content: z.string({ error: '请输入意见内容' }).trim().min(2, '意见至少 2 个字').max(5000, '意见最多 5000 个字'),
  website: honeypot,
  idempotencyKey,
}).superRefine(addSignedIdentityRules);

/** 游客学生信箱。公开意愿只是申请，审核前后均由管理员控制。 */
export const mailboxSubmissionSchema = z.object({
  submitMode: submissionMode,
  className,
  name,
  contactType,
  contactValue,
  subject: z.string({ error: '请输入主题' }).trim().min(2, '主题至少 2 个字').max(160, '主题最多 160 个字'),
  categoryId: optional(z.coerce.number().int().positive('分类 ID 不合法')),
  content: z.string({ error: '请输入信件内容' }).trim().min(2, '内容至少 2 个字').max(10000, '内容最多 10000 个字'),
  publicAllowed,
  website: honeypot,
  idempotencyKey,
}).superRefine(addSignedIdentityRules);

/** 游客报失/拾物登记。itemNo 由服务端生成，提交的值只作为检索线索。 */
export const lostFoundSubmissionSchema = z.object({
  type: z.enum(['lost', 'found'], { error: '类型只能是 lost 或 found' }),
  title: z.string({ error: '请输入物品名称' }).trim().min(2, '物品名称至少 2 个字').max(60, '物品名称最多 60 个字'),
  description: z.string({ error: '请输入物品描述' }).trim().min(5, '描述至少 5 个字').max(5000, '描述最多 5000 个字'),
  features: optional(z.string().trim().max(2000, '特征最多 2000 个字')),
  area: optional(z.enum(['A', 'B', 'D'], { error: '区域只能是 A、B 或 D' })),
  categoryId: optional(z.coerce.number().int().positive('分类 ID 不合法')),
  location: z.string({ error: '请输入地点' }).trim().min(2, '地点至少 2 个字').max(100, '地点最多 100 个字'),
  happenedAt: z.coerce.date().refine((value) => value <= new Date(), '发生时间不能晚于当前时间').refine((value) => value >= new Date('2000-01-01T00:00:00Z'), '发生时间过早'),
  contactType,
  contactValue: lostContactValue,
  website: honeypot,
  idempotencyKey,
}).superRefine((value, ctx) => {
  if ((value.contactType && !value.contactValue) || (!value.contactType && value.contactValue)) {
    ctx.addIssue({ code: 'custom', path: [value.contactType ? 'contactValue' : 'contactType'], message: '联系方式类型和内容需同时填写' });
  }
});

/** 关联公开失物的招领线索/意见反馈。 */
export const lostFoundInquirySchema = z.object({
  message: z.string({ error: '请输入留言' }).trim().min(2, '留言至少 2 个字').max(5000, '留言最多 5000 个字'),
  contactType,
  contactValue,
  website: honeypot,
  idempotencyKey,
}).superRefine((value, ctx) => {
  if ((value.contactType && !value.contactValue) || (!value.contactType && value.contactValue)) {
    ctx.addIssue({ code: 'custom', path: [value.contactType ? 'contactValue' : 'contactType'], message: '联系方式类型和内容需同时填写' });
  }
});
