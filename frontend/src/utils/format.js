// 展示层的格式化与文案映射

/** 帖子状态 → 文案与标签样式类 */
export const STATUS_MAP = {
  pending: { text: '待审核', className: 'tag-pending' },
  open: { text: '进行中', className: 'tag-open' },
  resolved: { text: '已找回', className: 'tag-resolved' },
  cleaned: { text: '已清理', className: 'tag-offline' },
  rejected: { text: '已驳回', className: 'tag-rejected' },
  offline: { text: '已下架', className: 'tag-offline' },
};

/** 帖子类型 → 文案与标签样式类 */
export const TYPE_MAP = {
  lost: { text: '寻物启事', short: '寻物', className: 'tag-lost' },
  found: { text: '招领启事', short: '招领', className: 'tag-found' },
};

/** 联系方式类型 → 中文名 */
export const CONTACT_MAP = {
  wechat: '微信',
  qq: 'QQ',
  phone: '手机号',
  other: '其他方式',
};

export const statusText = (status) => STATUS_MAP[status]?.text ?? status;
export const statusClass = (status) => STATUS_MAP[status]?.className ?? 'tag-offline';
export const typeText = (type) => TYPE_MAP[type]?.text ?? type;
export const typeShort = (type) => TYPE_MAP[type]?.short ?? type;
export const typeClass = (type) => TYPE_MAP[type]?.className ?? 'tag-found';
export const contactText = (type) => CONTACT_MAP[type] ?? '其他方式';

function pad(value) {
  return String(value).padStart(2, '0');
}

/** 2026-10-23 09:30 */
export function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

/** 列表里显示相对时间，超过 7 天回落到具体日期 */
export function relativeTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const diff = Date.now() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < 0) return '刚刚';
  if (diff < minute) return '刚刚';
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
  if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`;

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
