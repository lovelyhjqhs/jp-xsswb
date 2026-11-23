// 后台接口
import http from './http.js';

const unwrap = (promise) => promise.then((response) => response.data);

// ---------- 概览 ----------
export const getAdminStats = () => unwrap(http.get('/api/admin/stats'));


// ---------- 内容管理 ----------
export const listAdminItems = (params) => unwrap(http.get('/api/admin/items', { params }));

export const approveAdminItem = (id) => unwrap(http.post(`/api/admin/items/${id}/approve`));

export const rejectAdminItem = (id, reason) =>
  unwrap(http.post(`/api/admin/items/${id}/reject`, { reason }));

export const offlineAdminItem = (id) => unwrap(http.post(`/api/admin/items/${id}/offline`));
export const cleanAdminItem = (id) => unwrap(http.post(`/api/admin/items/${id}/clean`));
export const archiveAdminItem = (id) => unwrap(http.post(`/api/admin/items/${id}/archive`));

export const restoreAdminItem = (id) => unwrap(http.post(`/api/admin/items/${id}/restore`));

export const deleteAdminItem = (id) => unwrap(http.delete(`/api/admin/items/${id}`));

export const batchAdminItems = (payload) => unwrap(http.post('/api/admin/items/batch', payload));

// ---------- 失物匹配建议 ----------
export const listAdminItemMatches = (id, params) =>
  unwrap(http.get(`/api/admin/items/${id}/matches`, { params }));

export const confirmAdminItemMatch = (id, matchId, payload = {}) =>
  unwrap(http.post(`/api/admin/items/${id}/matches/${matchId}/confirm`, payload));

export const ignoreAdminItemMatch = (id, matchId, payload = {}) =>
  unwrap(http.post(`/api/admin/items/${id}/matches/${matchId}/ignore`, payload));

export const manuallyLinkAdminItemMatch = (id, payload) =>
  unwrap(http.post(`/api/admin/items/${id}/matches/manual`, payload));

// ---------- 举报 ----------
export const listAdminReports = (params) => unwrap(http.get('/api/admin/reports', { params }));

export const handleAdminReport = (id, payload) =>
  unwrap(http.post(`/api/admin/reports/${id}/handle`, payload));

// ---------- 分类 ----------
export const listAdminCategories = () => unwrap(http.get('/api/admin/categories'));

export const createAdminCategory = (payload) =>
  unwrap(http.post('/api/admin/categories', payload));

export const updateAdminCategory = (id, payload) =>
  unwrap(http.patch(`/api/admin/categories/${id}`, payload));

export const deleteAdminCategory = (id) => unwrap(http.delete(`/api/admin/categories/${id}`));

// ---------- 审计日志 ----------
export const listAdminAuditLogs = (params) =>
  unwrap(http.get('/api/admin/audit-logs', { params }));

// ---------- 游客投稿审核 ----------
export const listAdminSubmissions = (params) =>
  unwrap(http.get('/api/admin/submissions', { params }));

export const changeAdminSubmission = (type, id, action, payload = {}) =>
  unwrap(http.post(`/api/admin/submissions/${encodeURIComponent(type)}/${id}/${action}`, payload));

// 官网内容管理
export const getAdminProfile = () => unwrap(http.get('/api/admin/site/profile'));
export const saveAdminProfile = (payload) => unwrap(http.put('/api/admin/site/profile', payload));
export const actionAdminProfile = (action) => unwrap(http.post(`/api/admin/site/profile/${action}`));
export const listAdminNews = (params) => unwrap(http.get('/api/admin/site/news', { params }));
export const getAdminNews = (id) => unwrap(http.get(`/api/admin/site/news/${id}`));
export const createAdminNews = (payload) => unwrap(http.post('/api/admin/site/news', payload));
export const updateAdminNews = (id, payload) => unwrap(http.patch(`/api/admin/site/news/${id}`, payload));
export const actionAdminNews = (id, action) => unwrap(http.post(`/api/admin/site/news/${id}/${action}`));
export const listAdminCanteenReports = (params) => unwrap(http.get('/api/admin/site/canteen-reports', { params }));
export const createAdminCanteenReport = (payload) => unwrap(http.post('/api/admin/site/canteen-reports', payload));
export const updateAdminCanteenReport = (id, payload) => unwrap(http.patch(`/api/admin/site/canteen-reports/${id}`, payload));
export const actionAdminCanteenReport = (id, action) => unwrap(http.post(`/api/admin/site/canteen-reports/${id}/${action}`));
export const listAdminRecycleBin = (params) => unwrap(http.get('/api/admin/site/recycle-bin', { params }));
export const restoreAdminRecycleItem = (type, id) => unwrap(http.post(`/api/admin/site/recycle-bin/${type}/${id}/restore`));
export const listAdminMedia = (params) => unwrap(http.get('/api/admin/site/media', { params }));
export const uploadAdminMedia = (file, altText, visibility = 'private') => {
  const form = new FormData(); form.append('image', file); form.append('altText', altText || '部门网站图片'); form.append('visibility', visibility);
  return unwrap(http.post('/api/admin/site/media', form));
};
export const deleteAdminMedia = (id) => unwrap(http.delete(`/api/admin/site/media/${id}`));
