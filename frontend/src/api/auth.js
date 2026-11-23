// 认证相关接口
import http from './http.js';

export const loginAdmin = (payload) => http.post('/api/admin/auth/login', payload, { silent: true }).then((r) => r.data);
export const fetchAdminMe = () => http.get('/api/admin/auth/me', { silent: true }).then((r) => r.data);
export const logoutAdmin = () => http.post('/api/admin/auth/logout', {}, { silent: true }).then((r) => r.data);
