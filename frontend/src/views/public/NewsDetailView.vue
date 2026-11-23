<script setup>
import { onMounted, ref } from 'vue';
import { Refresh, Warning } from '@element-plus/icons-vue';
import { useRoute, useRouter } from 'vue-router';
import { getPublicNews } from '../../api/public.js';
import EmptyState from '../../components/EmptyState.vue';
import { formatDateTime } from '../../utils/format.js';

const route = useRoute();
const router = useRouter();
const item = ref(null);
const loading = ref(true);
const errorMessage = ref('');
const notFound = ref(false);

async function load() {
  loading.value = true; errorMessage.value = ''; notFound.value = false;
  try { item.value = await getPublicNews(route.params.idOrSlug); }
  catch (error) { if (error.status === 404) notFound.value = true; else errorMessage.value = error.message || '动态加载失败'; }
  finally { loading.value = false; }
}
onMounted(load);
</script>

<template>
  <div class="page public-page detail-page">
    <el-skeleton v-if="loading" :rows="12" animated />
    <EmptyState v-else-if="notFound" title="内容不存在或已下线" description="这条工作动态可能尚未发布，或已经归档。">
      <el-button type="primary" @click="router.push('/news')">返回工作动态</el-button>
    </EmptyState>
    <EmptyState v-else-if="errorMessage" :icon="Warning" title="加载失败" :description="errorMessage">
      <el-button type="primary" :icon="Refresh" @click="load">重新加载</el-button>
    </EmptyState>
    <article v-else-if="item" class="article-content">
      <header class="article-header">
        <span class="news-category">{{ item.category?.name || item.categoryName || '工作动态' }}</span>
        <h1>{{ item.title }}</h1>
        <time>{{ formatDateTime(item.publishedAt || item.createdAt) }}</time>
      </header>
      <img v-if="item.cover?.url || item.coverUrl" class="article-cover" :src="item.cover?.url || item.coverUrl" :alt="item.title" />
      <div class="rich-text">{{ item.body || item.content || item.description }}</div>
      <div class="article-foot">
        <el-button type="text" @click="router.push('/news')">‹ 返回工作动态</el-button>
      </div>
    </article>
  </div>
</template>

<style scoped>
.public-page { max-width: 880px; }

.article-header { padding: 48px 0 34px; }
.news-category { color: #0066cc; font-size: 11px; font-weight: 600; letter-spacing: 0.06em; }
.article-header h1 { margin: 16px 0 20px; font-size: clamp(40px, 5.4vw, 62px); font-weight: 600; line-height: 1.02; letter-spacing: -0.045em; }
.article-header time { color: var(--text-3); font-size: 12px; }

.article-cover { display: block; width: 100%; max-height: 560px; margin: 12px 0 48px; border-radius: 30px; object-fit: cover; box-shadow: 0 22px 60px rgba(0, 0, 0, 0.08); }

.rich-text {
  white-space: pre-wrap;
  color: var(--text);
  font-size: 20px;
  line-height: 1.75;
  letter-spacing: -0.01em;
}

.article-foot { margin-top: 64px; padding-top: 28px; border-top: 1px solid var(--hairline); }

@media (max-width: 560px) {
  .article-header { padding-top: 32px; }
  .article-header h1 { font-size: 40px; }
  .rich-text { font-size: 17px; }
}
</style>
