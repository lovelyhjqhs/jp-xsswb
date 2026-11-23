<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Refresh, Warning } from '@element-plus/icons-vue';

import { getAdminStats } from '../../api/admin.js';
import TrendChart from '../../components/admin/TrendChart.vue';
import EmptyState from '../../components/EmptyState.vue';

const router = useRouter();

const stats = ref(null);
const loading = ref(true);
const errorMessage = ref('');

async function load() {
  loading.value = true;
  errorMessage.value = '';
  try {
    stats.value = await getAdminStats();
  } catch (error) {
    errorMessage.value = error.message;
  } finally {
    loading.value = false;
  }
}

const cards = computed(() => {
  if (!stats.value) return [];
  return [
    { label: '总帖子数', value: stats.value.totalItems, hint: '全部状态' },
    { label: '待审核', value: stats.value.pendingItems, hint: '需要处理' },
    { label: '本周新增', value: stats.value.weeklyNew, hint: '最近 7 天' },
    {
      label: '找回率',
      value: `${(stats.value.resolvedRate * 100).toFixed(1)}%`,
      hint: `已找回 ${stats.value.resolvedItems} / 流转中 ${stats.value.openItems + stats.value.resolvedItems}`,
    },
    {
      label: '用户数',
      value: stats.value.totalUsers,
      hint: `其中禁用 ${stats.value.bannedUsers} 人`,
    },
    {
      label: '待处理举报',
      value: stats.value.pendingReports,
      hint: '点击进入处理',
      link: '/admin/reports',
    },
    {
      label: '待审核投稿',
      value: stats.value.pendingSubmissions ?? 0,
      hint: `食堂 ${stats.value.pendingCanteen ?? 0} · 信箱 ${stats.value.pendingMailbox ?? 0}`,
    },
  ];
});

onMounted(load);
</script>

<template>
  <div class="dashboard">
    <el-skeleton v-if="loading" :rows="6" animated />

    <EmptyState
      v-else-if="errorMessage"
      :icon="Warning"
      title="数据加载失败"
      :description="errorMessage"
    >
      <el-button type="primary" :icon="Refresh" @click="load">重新加载</el-button>
    </EmptyState>

    <template v-else-if="stats">
      <section class="stat-grid">
        <article
          v-for="card in cards"
          :key="card.label"
          class="stat-card"
          :class="{ clickable: card.link }"
          @click="card.link && router.push(card.link)"
        >
          <p class="stat-label">{{ card.label }}</p>
          <p class="stat-value">{{ card.value }}</p>
          <p class="stat-hint">{{ card.hint }}</p>
        </article>
      </section>

      <section class="panel chart-panel">
        <div class="section-title">
          <h2>近 30 天发布趋势</h2>
          <el-button text :icon="Refresh" @click="load">刷新</el-button>
        </div>
        <TrendChart :points="stats.trend" :height="200" />
      </section>

      <section class="panel quick-panel">
        <div class="section-title">
          <h2>快捷入口</h2>
        </div>
        <div class="quick-links">
          <el-button @click="router.push('/admin/items?status=pending')">处理待审核</el-button>
          <el-button @click="router.push('/admin/reports?status=pending')">处理举报</el-button>
          <el-button @click="router.push('/admin/logs')">查看操作日志</el-button>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

@media (min-width: 768px) {
  .stat-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (min-width: 1200px) {
  .stat-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

.stat-card {
  padding: 22px 24px;
  background: var(--bg-alt);
  border-radius: 20px;
}

.stat-card.clickable {
  cursor: pointer;
  transition: background-color 0.2s var(--ease);
}

.stat-card.clickable:hover {
  background: #ededf0;
}

.stat-label {
  margin: 0;
  color: var(--text-2);
  font-size: 13px;
}

.stat-value {
  margin: 8px 0 4px;
  font-size: 34px;
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -0.03em;
}

.stat-hint {
  margin: 0;
  color: var(--text-3);
  font-size: 12px;
  line-height: 1.4;
}

.chart-panel,
.quick-panel {
  border: 0;
  background: var(--bg-alt);
  border-radius: 20px;
  padding: 24px;
}

.chart-panel .section-title h2,
.quick-panel .section-title h2 {
  font-size: 19px;
  font-weight: 600;
}

.quick-links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.quick-links :deep(.el-button + .el-button) {
  margin-left: 0;
}

.quick-links :deep(.el-button) {
  background: var(--surface);
  border-color: transparent;
}

.quick-links :deep(.el-button:hover) {
  border-color: var(--border);
}
</style>
