import { createRouter, createWebHistory } from 'vue-router';

import HomeView from '../views/HomeView.vue';
import { useAdminAuthStore } from '../stores/adminAuth.js';

const routes = [
  { path: '/', name: 'home', component: HomeView, meta: { title: '首页' } },
  { path: '/about', name: 'about', component: () => import('../views/public/ProfileView.vue'), meta: { title: '部门概况' } },
  { path: '/news', name: 'news', component: () => import('../views/public/NewsListView.vue'), meta: { title: '工作动态' } },
  { path: '/news/:idOrSlug', name: 'news-detail', component: () => import('../views/public/NewsDetailView.vue'), meta: { title: '工作动态详情' } },
  { path: '/canteen', name: 'canteen', component: () => import('../views/public/CanteenView.vue'), meta: { title: '食堂面对面' } },
  { path: '/canteen/feedback', name: 'canteen-feedback', component: () => import('../views/public/PublicSubmitView.vue'), meta: { title: '提交食堂意见' } },
  { path: '/canteen/:month', name: 'canteen-detail', component: () => import('../views/public/CanteenDetailView.vue'), meta: { title: '食堂月报' } },
  { path: '/lost-found', name: 'lost-found', component: () => import('../views/public/LostFoundView.vue'), meta: { title: '失物招领' } },
  { path: '/lost-found/report', name: 'lost-found-report', component: () => import('../views/public/PublicSubmitView.vue'), meta: { title: '报失登记' } },
  { path: '/lost-found/found', name: 'lost-found-found', component: () => import('../views/public/PublicSubmitView.vue'), meta: { title: '拾物登记' } },
  { path: '/lost-found/inquiry', name: 'lost-found-inquiry', component: () => import('../views/public/PublicSubmitView.vue'), meta: { title: '提交招领线索' } },
  { path: '/lost-found/:id', name: 'lost-found-detail', component: () => import('../views/public/LostFoundDetailView.vue'), meta: { title: '失物详情' } },
  { path: '/mailbox', name: 'mailbox', component: () => import('../views/public/MailboxView.vue'), meta: { title: '学生信箱' } },
  { path: '/mailbox/submit', name: 'mailbox-submit', component: () => import('../views/public/PublicSubmitView.vue'), meta: { title: '写信给我们' } },
  { path: '/mailbox/query', name: 'mailbox-query', component: () => import('../views/public/QueryView.vue'), meta: { title: '查询处理状态' } },
  { path: '/admin/login', name: 'admin-login', component: () => import('../views/AdminLoginView.vue'), meta: { title: '管理员登录' } },
  {
    path: '/admin',
    component: () => import('../layouts/AdminLayout.vue'),
    meta: { requiresAuth: true, requiresAdmin: true },
    children: [
      { path: '', name: 'admin-dashboard', component: () => import('../views/admin/DashboardView.vue'), meta: { title: '数据概览' } },
      { path: 'items', name: 'admin-items', component: () => import('../views/admin/ItemsManageView.vue'), meta: { title: '内容管理' } },
      { path: 'site', name: 'admin-site', component: () => import('../views/admin/SiteManageView.vue'), meta: { title: '官网内容' } },
      { path: 'reports', name: 'admin-reports', component: () => import('../views/admin/ReportsManageView.vue'), meta: { title: '举报处理' } },
      { path: 'categories', name: 'admin-categories', component: () => import('../views/admin/CategoriesManageView.vue'), meta: { title: '分类管理' } },
      { path: 'logs', name: 'admin-logs', component: () => import('../views/admin/AuditLogView.vue'), meta: { title: '操作日志' } },
    ],
  },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('../views/NotFoundView.vue'), meta: { title: '页面不存在' } },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, _from, savedPosition) {
    if (savedPosition) return savedPosition;
    return { top: 0 };
  },
});

router.beforeEach((to) => {
  const auth = useAdminAuthStore();
  if (to.meta.requiresAuth || to.path.startsWith('/admin')) {
    if (to.name === 'admin-login') return true;
    if (!auth.initialized) {
      return auth.refreshMe().then(() => {
        if (!auth.isAdmin) return { name: 'admin-login', query: { redirect: to.fullPath } };
        return true;
      }).catch(() => ({ name: 'admin-login', query: { redirect: to.fullPath } }));
    }
    if (!auth.isAdmin) return { name: 'admin-login', query: { redirect: to.fullPath } };
  }
  if (to.name === 'admin-login' && auth.isAdmin) return { name: 'admin-dashboard' };
  return true;
});

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · 学生事务部` : '学生事务部';
});

export default router;
