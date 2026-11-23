<script setup>
import { onMounted, reactive, ref } from 'vue';
import { Refresh, Warning } from '@element-plus/icons-vue';
import { listPublicCategories, listPublicNews } from '../../api/public.js';
import EmptyState from '../../components/EmptyState.vue';
import { formatDateTime } from '../../utils/format.js';

const filters = reactive({ categoryId: '', dateFrom: '', dateTo: '' });
const categories = ref([]);
const items = ref([]);
const pagination = ref({ page: 1, pageSize: 10, total: 0, totalPages: 1 });
const loading = ref(true);
const errorMessage = ref('');

function listOf(data) { return data?.items || data?.list || data?.records || []; }
function pageOf(data) { return data?.pagination || { page: 1, pageSize: 10, total: listOf(data).length, totalPages: 1 }; }

async function load(page = 1) {
  loading.value = true;
  errorMessage.value = '';
  try {
    const data = await listPublicNews({ page, pageSize: pagination.value.pageSize, ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value)) });
    items.value = listOf(data);
    pagination.value = pageOf(data);
  } catch (error) { errorMessage.value = error.message || '工作动态加载失败'; }
  finally { loading.value = false; }
}

async function loadCategories() {
  try { categories.value = listOf(await listPublicCategories('news')); }
  catch { categories.value = []; }
}

function reset() { filters.categoryId = ''; filters.dateFrom = ''; filters.dateTo = ''; load(1); }
onMounted(() => { load(1); loadCategories(); });
</script>

<template>
  <div class="page public-page public-section-page">
    <header class="public-section-heading">
      <h1>工作动态</h1>
      <p>记录运动会、共建活动与持续服务的每一步。</p>
    </header>

    <section class="filter-panel" aria-label="动态筛选">
      <el-select v-model="filters.categoryId" clearable placeholder="全部活动类型" aria-label="活动类型" @change="load(1)">
        <el-option v-for="category in categories" :key="category.id || category.slug" :label="category.name" :value="category.id || category.slug" />
      </el-select>
      <el-date-picker v-model="filters.dateFrom" type="date" value-format="YYYY-MM-DD" placeholder="开始日期" aria-label="开始日期" @change="load(1)" />
      <el-date-picker v-model="filters.dateTo" type="date" value-format="YYYY-MM-DD" placeholder="结束日期" aria-label="结束日期" @change="load(1)" />
      <el-button type="text" @click="reset">清空筛选</el-button>
    </section>

    <div v-if="loading" class="news-grid" aria-busy="true">
      <div v-for="n in 6" :key="n" class="skeleton-card"><el-skeleton :rows="4" animated /></div>
    </div>
    <EmptyState v-else-if="errorMessage" :icon="Warning" title="加载失败" :description="errorMessage">
      <el-button type="primary" :icon="Refresh" @click="load(pagination.page)">重新加载</el-button>
    </EmptyState>
    <EmptyState v-else-if="!items.length" title="没有符合条件的工作动态" description="可以调整活动类型或日期范围。" />
    <div v-else class="news-grid">
      <RouterLink
        v-for="(item, index) in items"
        :key="item.id"
        :to="`/news/${item.slug || item.id}`"
        class="news-card"
        :class="{ 'is-featured': index === 0 }"
      >
        <div v-if="item.cover?.url || item.coverUrl" class="news-cover">
          <img :src="item.cover?.url || item.coverUrl" :alt="item.title" loading="lazy" />
        </div>
        <div class="news-card-body">
          <span class="news-category">{{ item.category?.name || item.categoryName || '工作动态' }}</span>
          <h2>{{ item.title }}</h2>
          <p>{{ item.summary }}</p>
          <time>{{ formatDateTime(item.publishedAt || item.createdAt) }}</time>
        </div>
      </RouterLink>
    </div>

    <el-pagination
      v-if="pagination.total > pagination.pageSize"
      class="pagination"
      layout="prev, pager, next"
      :current-page="pagination.page"
      :page-size="pagination.pageSize"
      :total="pagination.total"
      @current-change="load"
    />
  </div>
</template>

<style scoped>
.public-page { max-width: var(--content-max); }

.filter-panel {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 30px;
  padding: 16px 0 20px;
  border-top: 1px solid var(--hairline);
  border-bottom: 1px solid var(--hairline);
}
.filter-panel .el-select { width: 200px; }

.news-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.news-card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 20px;
  background: #fff;
  transition: transform 0.3s var(--ease), box-shadow 0.3s var(--ease);
}
.news-card.is-featured {
  min-height: 390px;
  flex-direction: row;
  grid-column: span 2;
}
.news-card:only-child {
  grid-column: 1 / -1;
}
.news-card:hover,
.news-card:focus-visible { transform: translateY(-2px); box-shadow: 0 12px 34px rgba(0, 0, 0, 0.07); }
.news-cover { aspect-ratio: 16 / 10; background: #f0f0f2; overflow: hidden; }
.is-featured .news-cover { width: 54%; aspect-ratio: auto; flex: 0 0 54%; }
.news-cover img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.5s var(--ease); }
.news-card:hover .news-cover img { transform: scale(1.03); }
.news-card-body { display: flex; flex: 1; flex-direction: column; gap: 10px; padding: 24px; }
.is-featured .news-card-body { justify-content: flex-end; padding: 34px; }
.news-category { color: #0066cc; font-size: 10px; font-weight: 600; letter-spacing: 0.06em; }
.news-card h2 { font-size: 22px; font-weight: 600; letter-spacing: -0.03em; line-height: 1.25; }
.is-featured h2 { font-size: clamp(30px, 3.6vw, 46px); letter-spacing: -0.045em; }
.news-card p { display: -webkit-box; overflow: hidden; margin: 0; color: var(--text-2); font-size: 14px; line-height: 1.55; -webkit-box-orient: vertical; -webkit-line-clamp: 3; }
.news-card time { margin-top: auto; padding-top: 18px; color: var(--text-3); font-size: 11px; }
.skeleton-card { padding: 24px; border-radius: 20px; background: #f5f5f7; }
.pagination { justify-content: center; margin: 40px 0 0; }

@media (max-width: 820px) {
  .news-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .news-card.is-featured { min-height: 330px; }
  .is-featured .news-cover { width: 50%; flex-basis: 50%; }
}

@media (max-width: 560px) {
  .news-grid { grid-template-columns: 1fr; }
  .news-card.is-featured { min-height: 0; flex-direction: column; grid-column: span 1; }
  .is-featured .news-cover { width: 100%; aspect-ratio: 16 / 10; flex-basis: auto; }
  .is-featured .news-card-body { padding: 24px; }
  .is-featured h2 { font-size: 28px; }
  .filter-panel > * { width: 100% !important; }
}
</style>
