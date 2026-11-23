<script setup>
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const menuOpen = ref(false);
const isAdminArea = computed(() => route.path.startsWith('/admin'));
const isHome = computed(() => route.path === '/');
const year = new Date().getFullYear();

const navItems = [
  { label: '首页', to: '/' },
  { label: '部门概况', to: '/about' },
  { label: '工作动态', to: '/news' },
  { label: '食堂面对面', to: '/canteen' },
  { label: '失物招领', to: '/lost-found' },
  { label: '学生信箱', to: '/mailbox' },
];

function closeMenu() {
  menuOpen.value = false;
}

watch(
  () => route.fullPath,
  () => {
    menuOpen.value = false;
  },
);
</script>

<template>
  <div class="app-shell">
    <header v-if="!isAdminArea" class="app-header" :class="{ 'is-home': isHome }">
      <div class="header-inner">
        <RouterLink to="/" class="brand" @click="closeMenu">
          <span class="brand-mark" aria-hidden="true">事</span>
          <span class="brand-text">学生事务部</span>
        </RouterLink>

        <nav id="public-navigation" class="header-nav" :class="{ 'is-open': menuOpen }" aria-label="主导航">
          <RouterLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="nav-link"
            :class="{ active: route.path === item.to || (item.to !== '/' && route.path.startsWith(item.to)) }"
            @click="closeMenu"
          >
            {{ item.label }}
          </RouterLink>
        </nav>

        <div class="header-actions">
          <RouterLink to="/mailbox/submit" class="header-cta" @click="closeMenu">写信给我们</RouterLink>
          <button
            class="mobile-menu-button"
            type="button"
            :aria-expanded="menuOpen"
            aria-controls="public-navigation"
            :aria-label="menuOpen ? '关闭网站导航' : '打开网站导航'"
            @click="menuOpen = !menuOpen"
          >
            <span class="menu-icon" :class="{ 'is-open': menuOpen }" aria-hidden="true">
              <span></span>
              <span></span>
            </span>
          </button>
        </div>
      </div>
    </header>

    <main class="app-main">
      <RouterView />
    </main>

    <footer v-if="!isAdminArea" class="app-footer">
      <div class="footer-inner">
        <div class="footer-mast">
          <p class="footer-eyebrow">服务同学 · 连接校园</p>
          <h2>让每一份意见，<br />都有回应。</h2>
        </div>
        <div class="footer-groups">
          <div class="footer-group">
            <strong>了解部门</strong>
            <RouterLink to="/about">部门概况</RouterLink>
            <RouterLink to="/news">工作动态</RouterLink>
          </div>
          <div class="footer-group">
            <strong>校园服务</strong>
            <RouterLink to="/lost-found">失物招领</RouterLink>
            <RouterLink to="/canteen">食堂面对面</RouterLink>
          </div>
          <div class="footer-group">
            <strong>联系我们</strong>
            <RouterLink to="/mailbox">学生信箱</RouterLink>
            <RouterLink to="/mailbox/query">查询进度</RouterLink>
            <RouterLink to="/admin/login">管理员入口</RouterLink>
          </div>
        </div>
      </div>
      <div class="footer-bottom">
        <span>学生事务部</span>
        <span>Copyright © {{ year }} 保留所有权利。</span>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  min-height: 100vh;
  flex-direction: column;
  background: #fff;
}

.app-header {
  position: sticky;
  top: 0;
  z-index: 40;
  color: var(--text);
  background: rgba(255, 255, 255, 0.78);
  border-bottom: 1px solid rgba(0, 0, 0, 0.07);
  -webkit-backdrop-filter: saturate(180%) blur(24px);
  backdrop-filter: saturate(180%) blur(24px);
  transition: color 0.25s var(--ease), background-color 0.25s var(--ease);
}

.app-header.is-home {
  color: var(--text);
  background: rgba(255, 255, 255, 0.78);
  border-bottom-color: rgba(0, 0, 0, 0.07);
}

.header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 28px;
  width: 100%;
  max-width: 1280px;
  min-height: 52px;
  margin: 0 auto;
  padding: 0 28px;
}

.brand {
  display: inline-flex;
  align-items: center;
  color: var(--text);
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.012em;
  white-space: nowrap;
  transition: opacity 0.2s var(--ease);
}

.app-header.is-home .brand {
  color: var(--text);
}

.brand:hover {
  opacity: 0.72;
}

.brand-mark {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 8px;
  color: #fff;
  background:
    radial-gradient(circle at 28% 18%, rgba(255, 255, 255, 0.55), transparent 32%),
    linear-gradient(145deg, #64b5ff 0%, #0071e3 48%, #004aa8 100%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0;
}

.header-nav {
  display: flex;
  align-items: center;
  gap: 4px;
}

.nav-link {
  position: relative;
  display: inline-flex;
  align-items: center;
  height: 44px;
  padding: 0 12px;
  color: rgba(29, 29, 31, 0.72);
  font-size: 12px;
  font-weight: 400;
  letter-spacing: 0.015em;
  transition: color 0.2s var(--ease);
}

.app-header.is-home .nav-link {
  color: rgba(29, 29, 31, 0.72);
}

.nav-link:hover,
.nav-link:focus-visible,
.nav-link.active {
  color: var(--text);
}

.app-header.is-home .nav-link:hover,
.app-header.is-home .nav-link:focus-visible,
.app-header.is-home .nav-link.active {
  color: var(--text);
}

.nav-link.active::after {
  position: absolute;
  right: 12px;
  bottom: 8px;
  left: 12px;
  height: 1px;
  border-radius: 1px;
  background: currentColor;
  content: '';
  opacity: 0.75;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-cta {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 14px;
  border-radius: 999px;
  color: #fff;
  background: #1d1d1f;
  font-size: 12px;
  font-weight: 500;
  transition: transform 0.2s var(--ease), opacity 0.2s var(--ease);
}

.header-cta:hover {
  transform: translateY(-1px);
  opacity: 0.9;
}

.app-header.is-home .header-cta {
  color: #fff;
  background: #1d1d1f;
}

.mobile-menu-button {
  display: none;
  place-items: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--text);
  cursor: pointer;
}

.menu-icon {
  position: relative;
  display: block;
  width: 18px;
  height: 12px;
}

.menu-icon span {
  position: absolute;
  left: 0;
  width: 100%;
  height: 1.5px;
  border-radius: 1px;
  background: currentColor;
  transition: transform 0.24s var(--ease), top 0.24s var(--ease);
}

.menu-icon span:first-child {
  top: 1px;
}

.menu-icon span:last-child {
  top: 9px;
}

.menu-icon.is-open span:first-child {
  top: 5px;
  transform: rotate(45deg);
}

.menu-icon.is-open span:last-child {
  top: 5px;
  transform: rotate(-45deg);
}

/* ---------- 主体 ---------- */

.app-main {
  flex: 1;
}

/* ---------- 页脚 ---------- */

.app-footer {
  margin-top: 0;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  background: #fff;
  color: var(--text-2);
}

.app-footer ::selection {
  color: #fff;
  background: rgba(10, 132, 255, 0.82);
}

.app-footer ::-moz-selection {
  color: #fff;
  background: rgba(10, 132, 255, 0.82);
}

.footer-inner {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(420px, 0.75fr);
  gap: 72px;
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  padding: 88px 28px 72px;
}

.footer-eyebrow {
  margin: 0 0 22px;
  color: var(--text-3);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.14em;
}

.footer-mast h2 {
  max-width: 760px;
  color: var(--text);
  font-size: clamp(40px, 5.4vw, 72px);
  font-weight: 600;
  letter-spacing: -0.045em;
  line-height: 1.04;
}

.footer-groups {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 32px;
  padding-top: 8px;
}

.footer-group {
  display: flex;
  flex-direction: column;
  gap: 11px;
  font-size: 13px;
}

.footer-group strong {
  margin-bottom: 6px;
  color: var(--text);
  font-size: 12px;
  font-weight: 500;
}

.footer-group a {
  color: var(--text-2);
  transition: color 0.2s var(--ease);
}

.footer-group a:hover,
.footer-group a:focus-visible {
  color: var(--text);
}

.footer-bottom {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  padding: 22px 28px 30px;
  border-top: 1px solid rgba(0, 0, 0, 0.09);
  color: var(--text-3);
  font-size: 11px;
}

@media (max-width: 900px) {
  .header-inner {
    position: relative;
    min-height: 52px;
    padding: 0 18px;
  }

  .header-cta {
    display: none;
  }

  .mobile-menu-button {
    display: grid;
  }

  .header-nav {
    position: fixed;
    top: 52px;
    right: 0;
    left: 0;
    display: none;
    flex-direction: column;
    align-items: stretch;
    gap: 0;
    min-height: calc(100dvh - 52px);
    margin: 0;
    padding: 16px 24px 40px;
    overflow-y: auto;
    border-bottom: 0;
    background: rgba(250, 250, 252, 0.98);
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.12);
  }

  .app-header.is-home .header-nav {
    background: rgba(250, 250, 252, 0.98);
  }

  .header-nav.is-open {
    display: flex;
  }

  .nav-link {
    justify-content: flex-start;
    height: 56px;
    padding: 0;
    border-bottom: 1px solid rgba(0, 0, 0, 0.09);
    color: rgba(29, 29, 31, 0.68);
    font-size: 19px;
    font-weight: 500;
  }

  .nav-link:hover,
  .nav-link:focus-visible,
  .nav-link.active,
  .app-header.is-home .nav-link:hover,
  .app-header.is-home .nav-link:focus-visible,
  .app-header.is-home .nav-link.active {
    color: var(--text);
  }

  .nav-link.active::after {
    display: none;
  }

  .nav-link:last-child {
    border-bottom: 0;
  }

  .footer-inner {
    grid-template-columns: 1fr;
    gap: 56px;
    padding: 64px 18px 52px;
  }

  .footer-groups {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .footer-bottom {
    flex-direction: column;
    gap: 6px;
    padding: 20px 18px 26px;
  }
}

@media (max-width: 560px) {
  .header-nav {
    max-height: calc(100dvh - 52px);
  }

  .footer-groups {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    row-gap: 40px;
  }

  .footer-mast h2 {
    font-size: 42px;
  }
}
</style>
