// 帖子相关测试的公用夹具
import sharp from 'sharp';

import { api } from './request.js';
import { bearer } from './session.js';

/** 生成一张纯色 PNG（默认 400x300） */
export async function makePng(width = 400, height = 300) {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 40, g: 120, b: 200 },
    },
  })
    .png()
    .toBuffer();
}

/** 调上传接口，返回完整的 supertest 响应 */
export async function uploadImage(token, { buffer, filename = 'test.png', contentType = 'image/png' } = {}) {
  const payload = buffer ?? (await makePng());
  return api()
    .post('/api/upload')
    .set(bearer(token))
    .attach('image', payload, { filename, contentType });
}

/** 上传一张图并返回其 URL（失败时抛错，避免后续断言信息失真） */
export async function uploadImageUrl(token, options) {
  const res = await uploadImage(token, options);
  if (res.status !== 201) {
    throw new Error(`上传失败：${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.data.url;
}

/** 一份合法的发布数据 */
export function itemPayload(categoryId, overrides = {}) {
  return {
    type: 'lost',
    title: '丢了校园卡',
    description: '在图书馆三楼自习区丢的，卡面有姓名',
    categoryId,
    location: '图书馆三楼自习区',
    happenedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    contactType: 'wechat',
    contactValue: 'wx_test_001',
    ...overrides,
  };
}

/** 发帖（自动上传一张图） */
export async function createItemViaApi(token, categoryId, overrides = {}) {
  const url = await uploadImageUrl(token);
  return api()
    .post('/api/items')
    .set(bearer(token))
    .send(itemPayload(categoryId, { images: [url], ...overrides }));
}
