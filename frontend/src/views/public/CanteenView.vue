<script setup>
import { onMounted, ref } from 'vue';
import { Refresh, Warning } from '@element-plus/icons-vue';
import { listCanteenReports } from '../../api/public.js';
import EmptyState from '../../components/EmptyState.vue';

const reports = ref([]); const loading = ref(true); const errorMessage = ref('');
function listOf(data) { return data?.items || data?.list || data?.records || []; }
function monthOf(value) { return String(value || '').slice(0, 7); }
async function load() { loading.value = true; errorMessage.value = ''; try { reports.value = listOf(await listCanteenReports({ page: 1, pageSize: 24, sort: 'reportMonth_desc' })); } catch (error) { errorMessage.value = error.message || '月报加载失败'; } finally { loading.value = false; } }
onMounted(load);
</script>

<template>
  <div class="page public-page public-section-page">
    <header class="public-section-heading">
      <h1>食堂面对面</h1>
      <p>按月份查看问卷汇总、食堂反馈和现场照片。</p>
      <div class="heading-actions">
        <el-button type="primary" @click="$router.push('/canteen/feedback')">提交意见</el-button>
      </div>
    </header>

    <div v-if="loading" class="report-grid" aria-busy="true">
      <div v-for="n in 6" :key="n" class="skeleton-card"><el-skeleton :rows="3" animated /></div>
    </div>
    <EmptyState v-else-if="errorMessage" :icon="Warning" title="加载失败" :description="errorMessage">
      <el-button type="primary" :icon="Refresh" @click="load">重新加载</el-button>
    </EmptyState>
    <EmptyState v-else-if="!reports.length" title="暂未发布食堂月报" description="月报整理完成后会在这里公开。" />
    <div v-else class="report-grid">
      <RouterLink v-for="report in reports" :key="report.id || report.reportMonth" class="report-card" :to="`/canteen/${monthOf(report.reportMonth || report.month)}`">
        <span class="report-month">{{ monthOf(report.reportMonth || report.month) }}</span>
        <h2>{{ report.title || '食堂面对面月报' }}</h2>
        <p>{{ report.surveySummary || report.summary || '查看问卷汇总和现场反馈' }}</p>
        <span class="report-link">查看详情 <span aria-hidden="true">›</span></span>
      </RouterLink>
    </div>
  </div>
</template>

<style scoped>
.public-page { max-width: var(--content-max); }

.heading-actions { margin-top: 28px; }

.report-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.report-card {
  display: flex;
  min-height: 300px;
  flex-direction: column;
  gap: 10px;
  padding: 30px;
  border-radius: 22px;
  background: #f5f5f7;
  transition: transform 0.3s var(--ease), box-shadow 0.3s var(--ease);
}
.report-card:hover,
.report-card:focus-visible { transform: translateY(-2px); box-shadow: 0 12px 34px rgba(0, 0, 0, 0.07); }
.report-card:first-child {
  color: #f5f5f7;
  background: #1d1d1f;
}
.report-month { color: #0066cc; font-size: 11px; font-weight: 600; letter-spacing: 0.06em; }
.report-card:first-child .report-month { color: #ffad66; }
.report-card h2 { margin-top: 24px; font-size: 27px; font-weight: 600; letter-spacing: -0.035em; line-height: 1.15; }
.report-card p { flex: 1; margin: 0; color: var(--text-2); font-size: 15px; line-height: 1.55; }
.report-card:first-child p { color: rgba(255, 255, 255, 0.52); }
.report-link { color: #0066cc; font-size: 12px; font-weight: 500; }
.report-card:first-child .report-link { color: #2997ff; }
.skeleton-card { padding: 30px; border-radius: 28px; background: #f5f5f7; }

@media (max-width: 720px) {
  .report-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 520px) {
  .report-grid { grid-template-columns: 1fr; }
}
</style>
