<script setup>
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import {
  DataLine,
  Document,
  EditPen,
  Files,
  Fold,
  Tickets,
  Warning,
} from '@element-plus/icons-vue';

import { useAdminAuthStore } from '../stores/adminAuth.js';

const route = useRoute();
const router = useRouter();
const auth = useAdminAuthStore();

const MENU = [
  { path: '/admin', title: '数据概览', icon: DataLine },
  { path: '/admin/items', title: '内容管理', icon: Document },
  { path: '/admin/site', title: '官网内容', icon: EditPen },
  { path: '/admin/reports', title: '举报处理', icon: Warning },
  { path: '/admin/categories', title: '分类管理', icon: Files },
  { path: '/admin/logs', title: '操作日志', icon: Tickets },
];

const drawerVisible = ref(false);
const activeMenu = computed(() => route.path);
const pageTitle = computed(() => route.meta.title || '管理后台');

function go(path) {
  drawerVisible.value = false;
  router.push(path);
}

function logout() {
  auth.logout();
  ElMessage.success('已退出管理员后台');
  router.replace('/admin/login');
}
</script>

<template>
  <div class="admin-shell">
    <!-- 桌面端侧边栏 -->
    <aside class="admin-aside">
      <RouterLink to="/admin" class="admin-brand">
        <strong>学生事务部</strong>
        <small>管理后台</small>
      </RouterLink>

      <el-menu :default-active="activeMenu" class="admin-menu" router>
        <el-menu-item v-for="item in MENU" :key="item.path" :index="item.path">
          <el-icon><component :is="item.icon" /></el-icon>
          <span>{{ item.title }}</span>
        </el-menu-item>
      </el-menu>

      <div class="aside-footer">
        <RouterLink class="tiny" to="/">‹ 返回前台</RouterLink>
      </div>
    </aside>

    <!-- 移动端抽屉菜单 -->
    <el-drawer v-model="drawerVisible" direction="ltr" size="260px" :with-header="false">
      <div class="drawer-head">
        <strong>学生事务部</strong>
        <small>管理后台</small>
      </div>
      <el-menu :default-active="activeMenu" class="admin-menu drawer-menu">
        <el-menu-item
          v-for="item in MENU"
          :key="item.path"
          :index="item.path"
          @click="go(item.path)"
        >
          <el-icon><component :is="item.icon" /></el-icon>
          <span>{{ item.title }}</span>
        </el-menu-item>
      </el-menu>
      <div class="drawer-footer">
        <RouterLink class="tiny" to="/" @click="drawerVisible = false">‹ 返回前台</RouterLink>
      </div>
    </el-drawer>

    <div class="admin-main">
      <header class="admin-header">
        <el-button class="only-mobile" text :icon="Fold" @click="drawerVisible = true" />
        <h1 class="admin-title">{{ pageTitle }}</h1>

        <div class="header-right">
          <span class="admin-name only-desktop">{{ auth.user?.name }}</span>
          <el-button text size="small" @click="logout">退出</el-button>
        </div>
      </header>

      <div class="admin-body">
        <RouterView />
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-shell {
  display: flex;
  min-height: 100vh;
  background: var(--bg);
}

/* ---------- 侧栏 ---------- */

.admin-aside {
  position: sticky;
  top: 0;
  display: flex;
  flex: 0 0 232px;
  flex-direction: column;
  width: 232px;
  height: 100vh;
  background: var(--bg-alt);
}

.admin-brand {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 20px 22px 16px;
}

.admin-brand strong {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.admin-brand small {
  color: var(--text-3);
  font-size: 12px;
}

.admin-menu {
  flex: 1 1 auto;
  padding: 4px 10px;
  border-right: 0;
  overflow-y: auto;
}

.admin-menu :deep(.el-menu-item) {
  height: 40px;
  margin-bottom: 2px;
  border-radius: 10px;
  color: var(--text-2);
  font-size: 14px;
}

.admin-menu :deep(.el-menu-item:hover) {
  background: rgba(0, 0, 0, 0.04);
}

.admin-menu :deep(.el-menu-item.is-active) {
  background: var(--surface);
  color: var(--text);
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.aside-footer {
  padding: 16px 22px 20px;
}

.aside-footer a {
  color: var(--text-3);
  font-size: 13px;
  transition: color 0.2s var(--ease);
}

.aside-footer a:hover {
  color: var(--text);
}

/* ---------- 主区 ---------- */

.admin-main {
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  flex-direction: column;
}

.admin-header {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 10px;
  height: 56px;
  padding: 0 24px;
  background: rgba(255, 255, 255, 0.72);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  backdrop-filter: saturate(180%) blur(20px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.admin-title {
  flex: 1 1 auto;
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 14px;
}

.admin-name {
  color: var(--text-2);
  font-size: 13px;
}

.admin-body {
  flex: 1 1 auto;
  padding: 20px 16px 48px;
}

.drawer-head {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 20px 22px 16px;
}

.drawer-head strong {
  font-size: 15px;
  font-weight: 600;
}

.drawer-head small {
  color: var(--text-3);
  font-size: 12px;
}

.drawer-menu {
  border-right: 0;
}

.drawer-footer {
  padding: 16px 22px;
  border-top: 1px solid var(--hairline);
}

@media (max-width: 991px) {
  .admin-aside {
    display: none;
  }
}

@media (min-width: 992px) {
  .admin-body {
    padding: 28px 36px 64px;
  }
}
</style>
