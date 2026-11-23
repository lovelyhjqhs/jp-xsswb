import { createApp } from 'vue';
import { createPinia } from 'pinia';
import ElementPlus, { ElMessage } from 'element-plus';
import zhCn from 'element-plus/es/locale/lang/zh-cn';

import 'element-plus/dist/index.css';
import './styles/main.css';

import App from './App.vue';
import router from './router/index.js';
import { setUnauthorizedHandler } from './api/http.js';
import { useAdminAuthStore } from './stores/adminAuth.js';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);
app.use(ElementPlus, { locale: zhCn });

// 管理后台 401 统一处理：清掉登录态并跳管理员登录页。
// 放在这里而不是 http.js 里，是为了避免 api 层反向依赖 router / store。
setUnauthorizedHandler(() => {
  const auth = useAdminAuthStore(pinia);
  auth.logout();

  const current = router.currentRoute.value;
  if (current.path === '/admin/login') return;
  router.push({ path: '/admin/login', query: { redirect: current.fullPath } });
});

// 兜底的全局错误处理：渲染或事件里未捕获的异常，至少让用户看到提示
app.config.errorHandler = (error) => {
  console.error('[app error]', error);
  ElMessage.error('页面出了点问题，请刷新后重试');
};

app.mount('#app');
