// 帖子相关入参校验。
import { z } from 'zod';

const idParamSchema = z.object({
  id: z.coerce.number().int().positive('帖子 ID 不合法'),
});

export { idParamSchema };

/** 查询参数里空字符串一律当作「未传」，避免前端传 type= 时报错 */
const optionalQuery = (schema) =>
  z.preprocess((value) => (value === '' || value === null ? undefined : value), schema.optional());

const ITEM_TYPES = ['lost', 'found'];
const CONTACT_TYPES = ['wechat', 'qq', 'phone', 'other'];
const PUBLIC_STATUSES = ['open', 'resolved'];
const ALL_STATUSES = ['pending', 'open', 'resolved', 'rejected', 'offline'];

/** 联系方式按类型做基础格式校验（微信/其他只限制长度，避免误伤昵称写法） */
function validateContactPair(contactType, contactValue) {
  if (contactType === 'phone' && !/^1[3-9]\d{9}$/.test(contactValue)) {
    return '请输入正确的 11 位手机号';
  }
  if (contactType === 'qq' && !/^\d{5,12}$/.test(contactValue)) {
    return 'QQ 号应为 5-12 位数字';
  }
  return null;
}

const titleField = z
  .string({ error: '请输入标题' })
  .trim()
  .min(2, '标题至少 2 个字')
  .max(60, '标题最多 60 个字');

const descriptionField = z
  .string({ error: '请输入描述' })
  .trim()
  .min(5, '描述至少 5 个字')
  .max(2000, '描述最多 2000 个字');

const categoryIdField = z.coerce
  .number({ error: '请选择分类' })
  .int('分类 ID 不合法')
  .positive('请选择分类');

const locationField = z
  .string({ error: '请输入地点' })
  .trim()
  .min(2, '地点至少 2 个字')
  .max(100, '地点最多 100 个字');

const happenedAtField = z.coerce
  .date({ error: '请选择丢失/拾取时间' })
  .refine((value) => value <= new Date(), '发生时间不能晚于当前时间')
  .refine((value) => value >= new Date('2000-01-01T00:00:00Z'), '发生时间过早');

const contactTypeField = z.enum(CONTACT_TYPES, { error: '请选择联系方式类型' });

const contactValueField = z
  .string({ error: '请填写联系方式' })
  .trim()
  .min(2, '联系方式至少 2 个字符')
  .max(100, '联系方式最多 100 个字符');

const imagesField = z
  .array(z.string().trim().min(1, '图片地址不能为空'), { error: '请至少上传 1 张图片' })
  .min(1, '请至少上传 1 张图片')
  .max(5, '最多上传 5 张图片');

/** 发布帖子 */
export const createItemSchema = z
  .object({
    type: z.enum(ITEM_TYPES, { error: '请选择类型：lost（寻物）或 found（招领）' }),
    title: titleField,
    description: descriptionField,
    categoryId: categoryIdField,
    location: locationField,
    happenedAt: happenedAtField,
    contactType: contactTypeField,
    contactValue: contactValueField,
    images: imagesField,
  })
  .superRefine((data, ctx) => {
    const message = validateContactPair(data.contactType, data.contactValue);
    if (message) {
      ctx.addIssue({ code: 'custom', message, path: ['contactValue'] });
    }
  });

/**
 * 编辑帖子：字段都可选，但联系方式必须成对提交。
 * 只改其中一半会让「类型」和「内容」对不上，因此直接拒绝。
 */
export const updateItemSchema = z
  .object({
    type: z.enum(ITEM_TYPES, { error: '请选择类型：lost（寻物）或 found（招领）' }).optional(),
    title: titleField.optional(),
    description: descriptionField.optional(),
    categoryId: categoryIdField.optional(),
    location: locationField.optional(),
    happenedAt: happenedAtField.optional(),
    contactType: contactTypeField.optional(),
    contactValue: contactValueField.optional(),
    images: imagesField.optional(),
  })
  .superRefine((data, ctx) => {
    const hasType = data.contactType !== undefined;
    const hasValue = data.contactValue !== undefined;

    if (hasType !== hasValue) {
      ctx.addIssue({
        code: 'custom',
        message: '修改联系方式时需同时提供类型和内容',
        path: [hasType ? 'contactValue' : 'contactType'],
      });
      return;
    }

    if (hasType && hasValue) {
      const message = validateContactPair(data.contactType, data.contactValue);
      if (message) {
        ctx.addIssue({ code: 'custom', message, path: ['contactValue'] });
      }
    }
  });

/** 公开列表的查询条件：状态只允许 open / resolved */
export const listItemsQuerySchema = z.object({
  page: optionalQuery(z.coerce.number().int().min(1, '页码从 1 开始')),
  pageSize: optionalQuery(z.coerce.number().int().min(1).max(50, '每页最多 50 条')),
  type: optionalQuery(z.enum(ITEM_TYPES, { error: '类型只能是 lost 或 found' })),
  categoryId: optionalQuery(z.coerce.number().int().positive('分类 ID 不合法')),
  status: optionalQuery(z.enum(PUBLIC_STATUSES, { error: '状态只能是 open 或 resolved' })),
  keyword: optionalQuery(z.string().trim().max(50, '关键词最多 50 个字')),
});

/** 我的发布：可以按全部状态筛选 */
export const myItemsQuerySchema = z.object({
  page: optionalQuery(z.coerce.number().int().min(1, '页码从 1 开始')),
  pageSize: optionalQuery(z.coerce.number().int().min(1).max(50, '每页最多 50 条')),
  type: optionalQuery(z.enum(ITEM_TYPES, { error: '类型只能是 lost 或 found' })),
  status: optionalQuery(z.enum(ALL_STATUSES, { error: '状态取值不合法' })),
});

/** 举报 */
export const reportSchema = z.object({
  reason: z
    .string({ error: '请填写举报理由' })
    .trim()
    .min(2, '举报理由至少 2 个字')
    .max(200, '举报理由最多 200 个字'),
});
