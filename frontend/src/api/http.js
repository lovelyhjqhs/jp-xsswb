// axios 统一封装
//
// 约定：
// 1. 管理员认证使用 HttpOnly Cookie；withCredentials 让浏览器自动携带会话。
// 2. 响应直接返回后端的 { code, message, data } 信封，调用方再取 .data
// 3. 错误统一转成 Error（带 status / code），并默认弹一次提示
// 4. 401 交给外部注入的处理器（清登录态 + 跳登录页），api 层不依赖 router
import axios from 'axios';
import { ElMessage } from 'element-plus';

const http = axios.create({
  // 开发期由 vite proxy 转发到后端；生产同域部署时留空即可
  baseURL: import.meta.env.VITE_API_BASE ?? '',
  timeout: 20000,
  withCredentials: true,
});

let unauthorizedHandler = null;

/** 由 main.js 注入 401 的处理逻辑 */
export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

http.interceptors.request.use((config) => {
  if (['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase()) && /^\/api\/admin(?:\/|$)/.test(config.url ?? '')) {
    const csrf = document.cookie.split('; ').find((part) => part.startsWith('admin_csrf='))?.split('=').slice(1).join('=');
    if (csrf) config.headers['X-CSRF-Token'] = decodeURIComponent(csrf);
  }
  return config;
});

http.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const { response, config } = error;
    const envelope = response?.data;
    const status = response?.status ?? 0;

    const message =
      envelope?.message ||
      (status ? `请求失败（${status}）` : '网络异常，请检查网络后重试');

    // 只有后台接口的 401 才代表管理员会话失效；公共接口的 401 应由页面自行处理。
    const isAdminEndpoint = /^\/api\/admin(?:\/|$)/.test(config?.url ?? '');
    if (status === 401 && isAdminEndpoint) {
      unauthorizedHandler?.();
    }

    // 允许调用方传 { silent: true } 自行处理提示（例如登录页就地显示错误）
    if (!config?.silent) {
      ElMessage.error(message);
    }

    const normalized = new Error(message);
    normalized.status = status;
    normalized.code = envelope?.code ?? null;
    normalized.data = envelope?.data ?? null;
    return Promise.reject(normalized);
  },
);

export default http;
