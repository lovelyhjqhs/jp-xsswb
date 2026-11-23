<script setup>
import { onMounted, ref } from 'vue';
import { Refresh, Warning } from '@element-plus/icons-vue';
import { useRoute, useRouter } from 'vue-router';
import { getCanteenReport } from '../../api/public.js';
import EmptyState from '../../components/EmptyState.vue';

const route = useRoute(); const router = useRouter(); const report = ref(null); const loading = ref(true); const errorMessage = ref('');
function monthOf(value) { return String(value || '').slice(0, 7); }
async function load() { loading.value = true; errorMessage.value = ''; try { report.value = await getCanteenReport(route.params.month); } catch (error) { errorMessage.value = error.message || '月报加载失败'; } finally { loading.value = false; } }
onMounted(load);
</script>

<template>
  <div class="page public-page">
    <el-skeleton v-if="loading" :rows="12" animated />
    <EmptyState v-else-if="errorMessage" :icon="Warning" title="月报加载失败" :description="errorMessage">
      <el-button type="primary" :icon="Refresh" @click="load">重新加载</el-button>
    </EmptyState>
    <EmptyState v-else-if="!report" title="月报不存在或暂未公开">
      <el-button type="primary" @click="router.push('/canteen')">返回月报列表</el-button>
    </EmptyState>
    <article v-else class="report-detail">
      <header class="page-heading">
        <span class="report-month">{{ monthOf(report.reportMonth || report.month) }}</span>
        <h1>{{ report.title || '食堂面对面月报' }}</h1>
      </header>

      <section class="content-section">
        <h2>问卷汇总</h2>
        <p class="rich-text">{{ report.surveySummary || report.survey || '本月暂无公开问卷汇总。' }}</p>
      </section>
      <section class="content-section">
        <h2>食堂反馈</h2>
        <p class="rich-text">{{ report.feedbackSummary || report.feedback || '本月暂无公开反馈。' }}</p>
      </section>
      <section v-if="(report.photos || report.media || []).length" class="content-section">
        <h2>现场照片</h2>
        <div class="photo-grid">
          <figure v-for="photo in (report.photos || report.media)" :key="photo.id || photo.url">
            <img :src="photo.url" :alt="photo.altText || photo.alt || '食堂面对面现场照片'" loading="lazy" />
            <figcaption v-if="photo.caption">{{ photo.caption }}</figcaption>
          </figure>
        </div>
      </section>

      <section class="submit-callout">
        <div>
          <strong>有想法，欢迎告诉我们</strong>
          <p>提交意见无需注册或登录，提交后会获得查询编号。</p>
        </div>
        <el-button type="primary" @click="router.push('/canteen/feedback')">提交食堂意见</el-button>
      </section>
    </article>
  </div>
</template>

<style scoped>
.public-page { max-width: 880px; }

.page-heading { padding: 38px 0 40px; }
.report-month { color: #0066cc; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; }
.page-heading h1 { margin: 14px 0 0; font-size: clamp(40px, 5.2vw, 60px); font-weight: 600; letter-spacing: -0.045em; line-height: 1.02; }

.content-section { padding: 40px 0; border-bottom: 1px solid var(--hairline); }
.content-section h2 { margin-bottom: 18px; font-size: 30px; font-weight: 600; letter-spacing: -0.035em; }
.rich-text { margin: 0; white-space: pre-wrap; color: var(--text-2); font-size: 17px; line-height: 1.7; }
.photo-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
.photo-grid figure { margin: 0; overflow: hidden; border-radius: 24px; background: #f5f5f7; }
.photo-grid img { display: block; width: 100%; aspect-ratio: 4 / 3; object-fit: cover; background: #e8e8ed; }
.photo-grid figcaption { padding-top: 8px; color: var(--text-2); font-size: 12px; }

.submit-callout {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-top: 40px;
  padding: 36px;
  border-radius: 30px;
  color: #f5f5f7;
  background: #1d1d1f;
}
.submit-callout strong { font-size: 20px; font-weight: 600; letter-spacing: -0.02em; }
.submit-callout p { margin: 6px 0 0; color: rgba(255, 255, 255, 0.5); font-size: 14px; }

@media (max-width: 620px) {
  .page-heading { padding-top: 30px; }
  .page-heading h1 { font-size: 40px; }
  .photo-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .submit-callout { align-items: flex-start; flex-direction: column; padding: 24px; }
}
</style>
