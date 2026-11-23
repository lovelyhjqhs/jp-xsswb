import http from './http.js';

const unwrap = (promise) => promise.then((response) => response.data);

export const getPublicProfile = () => unwrap(http.get('/api/public/profile'));

export const listPublicNews = (params) => unwrap(http.get('/api/public/news', { params }));

export const getPublicNews = (idOrSlug) =>
  unwrap(http.get(`/api/public/news/${encodeURIComponent(idOrSlug)}`));

export const listPublicCategories = (kind) =>
  unwrap(http.get('/api/public/categories', { params: kind ? { kind } : undefined }));

export const listCanteenReports = (params) =>
  unwrap(http.get('/api/public/canteen/reports', { params }));

export const getCanteenReport = (month) =>
  unwrap(http.get(`/api/public/canteen/reports/${encodeURIComponent(month)}`));

export const listPublicLostFound = (params) =>
  unwrap(http.get('/api/public/lost-found', { params }));

export const getPublicLostFound = (id) => unwrap(http.get(`/api/public/lost-found/${id}`));

export const listPublicMailbox = (params) =>
  unwrap(http.get('/api/public/mailbox/public', { params }));

export const queryPublicSubmission = (payload) =>
  unwrap(http.post('/api/public/query/status', payload, { silent: true }));

export const submitCanteenFeedback = (payload) =>
  submitPublicForm('/api/public/canteen-feedback', payload);

export const submitLostFoundItem = (payload) =>
  submitPublicForm('/api/public/lost-found/items', payload);

export const submitLostFoundInquiry = (id, payload) =>
  submitPublicForm(`/api/public/lost-found/items/${id}/inquiries`, payload);

export const submitMailboxMessage = (payload) =>
  submitPublicForm('/api/public/mailbox', payload);

export function submitPublicForm(path, payload) {
  const form = new FormData();
  const { attachments = [], idempotencyKey, ...fields } = payload;
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null) form.append(key, String(value));
  });
  attachments.forEach((file) => form.append('attachments', file, file.name));
  return unwrap(http.post(path, form, {
    silent: true,
    headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
  }));
}

