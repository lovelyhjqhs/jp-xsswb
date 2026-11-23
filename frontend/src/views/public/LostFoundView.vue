<script setup>
import { onMounted, reactive, ref } from 'vue';
import { Refresh, Search, Warning } from '@element-plus/icons-vue';
import { useRouter } from 'vue-router';
import { listPublicCategories, listPublicLostFound } from '../../api/public.js';
import EmptyState from '../../components/EmptyState.vue';
import { formatDateTime, typeShort } from '../../utils/format.js';

const router = useRouter();
const filters = reactive({ keyword: '', area: '', type: '', categoryId: '', itemNo: '', status: '', dateFrom: '', dateTo: '' });
const categories = ref([]);
const items = ref([]);
const pagination = ref({ page: 1, pageSize: 12, total: 0 });
const loading = ref(true);
const errorMessage = ref('');
const showFilters = ref(false);

function listOf(data) { return data?.items || data?.list || data?.records || []; }
function pageOf(data) { return data?.pagination || { page: 1, pageSize: 12, total: listOf(data).length, totalPages: 1 }; }

async function load(page = 1) {
  if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
    items.value = [];
    errorMessage.value = '开始日期不能晚于结束日期';
    loading.value = false;
    return;
  }
  loading.value = true;
  errorMessage.value = '';
  try {
    const params = {
      page,
      pageSize: pagination.value.pageSize,
      ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== '' && value !== null && value !== undefined)),
    };
    const data = await listPublicLostFound(params);
    items.value = listOf(data);
    pagination.value = pageOf(data);
  } catch (error) {
    errorMessage.value = error.message || '失物记录加载失败';
  } finally {
    loading.value = false;
  }
}
async function loadCategories() { try { categories.value = listOf(await listPublicCategories('lost_found')); } catch { categories.value = []; } }
function reset() { Object.keys(filters).forEach((key) => { filters[key] = ''; }); load(1); }
onMounted(() => { load(1); loadCategories(); });
</script>

<template>
  <div class="page public-page public-section-page">
    <header class="public-section-heading">
      <h1>失物招领</h1>
      <p>按区域、物品类型、编号和特征，查找公开登记。</p>
      <div class="heading-actions">
        <el-button type="primary" @click="router.push('/lost-found/found')">拾物登记</el-button>
        <el-button @click="router.push('/lost-found/report')">报失登记</el-button>
      </div>
    </header>

    <section class="toolbar" aria-label="失物筛选">
      <div class="toolbar-row">
        <el-input
          v-model="filters.keyword"
          class="search-field"
          size="large"
          clearable
          placeholder="搜索标题、地点或特征"
          aria-label="关键词"
          :prefix-icon="Search"
          @keyup.enter="load(1)"
        />
        <el-button class="filter-toggle" type="text" @click="showFilters = !showFilters">
          {{ showFilters ? '收起筛选' : '更多筛选' }}
        </el-button>
      </div>

      <transition name="reveal">
        <div v-show="showFilters" class="filter-panel">
          <el-select v-model="filters.area" clearable placeholder="区域" aria-label="区域" @change="load(1)">
            <el-option label="A 区" value="A" /><el-option label="B 区" value="B" /><el-option label="D 区" value="D" />
          </el-select>
          <el-select v-model="filters.type" clearable placeholder="报失 / 拾物" aria-label="记录类型" @change="load(1)">
            <el-option label="报失" value="lost" /><el-option label="拾物" value="found" />
          </el-select>
          <el-select v-model="filters.categoryId" clearable placeholder="物品类型" aria-label="物品类型" @change="load(1)">
            <el-option v-for="category in categories" :key="category.id || category.slug" :label="category.name" :value="category.id || category.slug" />
          </el-select>
          <el-input v-model="filters.itemNo" clearable placeholder="编号" aria-label="编号" @keyup.enter="load(1)" />
          <el-input v-model="filters.features" clearable placeholder="外观和特征" aria-label="外观和特征" @keyup.enter="load(1)" />
          <el-select v-model="filters.status" clearable placeholder="状态" aria-label="状态" @change="load(1)">
            <el-option label="进行中" value="open" /><el-option label="已归还" value="resolved" />
          </el-select>
          <el-date-picker v-model="filters.dateFrom" type="date" value-format="YYYY-MM-DD" placeholder="开始日期" aria-label="开始日期" @change="load(1)" />
          <el-date-picker v-model="filters.dateTo" type="date" value-format="YYYY-MM-DD" placeholder="结束日期" aria-label="结束日期" @change="load(1)" />
          <div class="filter-actions">
            <el-button type="primary" @click="load(1)">搜索</el-button>
            <el-button @click="reset">清空</el-button>
          </div>
        </div>
      </transition>
    </section>

    <p class="result-count">共 {{ pagination.total || 0 }} 条公开记录</p>

    <div v-if="loading" class="lost-grid" aria-busy="true">
      <div v-for="n in 6" :key="n" class="skeleton-card"><el-skeleton :rows="4" animated /></div>
    </div>
    <EmptyState v-else-if="errorMessage" :icon="Warning" title="加载失败" :description="errorMessage">
      <el-button type="primary" :icon="Refresh" @click="load(pagination.page)">重新加载</el-button>
    </EmptyState>
    <EmptyState v-else-if="!items.length" title="没有找到公开记录" description="可以调整筛选条件，或提交一条登记。" />
    <div v-else class="lost-grid">
      <RouterLink v-for="item in items" :key="item.id" :to="`/lost-found/${item.id}`" class="lost-card">
        <div class="lost-image">
          <img v-if="item.images?.[0]?.url || item.coverUrl" :src="item.images?.[0]?.url || item.coverUrl" :alt="item.title || '失物图片'" loading="lazy" />
          <span v-else class="placeholder">暂无图片</span>
          <span class="tag image-tag">{{ typeShort(item.itemType || item.type) }}</span>
        </div>
        <div class="lost-body">
          <h2>{{ item.title || item.features || '未命名物品' }}</h2>
          <p>{{ item.features || item.description || '暂无特征描述' }}</p>
          <div class="lost-meta">
            <span>{{ item.area }} 区 · {{ item.itemNo || '暂无编号' }}</span>
            <time>{{ formatDateTime(item.happenedAt || item.createdAt) }}</time>
          </div>
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

.heading-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 28px; }
.heading-actions :deep(.el-button + .el-button) { margin-left: 0; }

.toolbar {
  padding: 18px 0 22px;
  border-top: 1px solid var(--hairline);
  border-bottom: 1px solid var(--hairline);
}
.toolbar-row { display: flex; align-items: center; gap: 14px; }
.search-field { max-width: 460px; }
.filter-toggle { flex: 0 0 auto; color: var(--text-2); }
.filter-panel {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  padding-top: 16px;
}
.filter-panel .el-date-editor { width: 100%; }
.filter-actions { display: flex; gap: 8px; grid-column: span 4; }
.filter-actions :deep(.el-button + .el-button) { margin-left: 0; }

.reveal-enter-active,
.reveal-leave-active { transition: opacity 0.25s var(--ease), transform 0.25s var(--ease); }
.reveal-enter-from,
.reveal-leave-to { opacity: 0; transform: translateY(-4px); }

.result-count { margin: 28px 0 20px; color: var(--text-3); font-size: 12px; }

.lost-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.lost-card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 20px;
  background: #fff;
  transition: transform 0.3s var(--ease), box-shadow 0.3s var(--ease), border-color 0.3s var(--ease);
}
.lost-card:hover,
.lost-card:focus-visible { border-color: rgba(0, 0, 0, 0.1); transform: translateY(-2px); box-shadow: 0 12px 34px rgba(0, 0, 0, 0.07); }
.lost-image { position: relative; display: grid; place-items: center; aspect-ratio: 1.18; background: #f0f0f2; color: var(--text-3); font-size: 13px; overflow: hidden; }
.lost-image img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.5s var(--ease); }
.lost-card:hover .lost-image img { transform: scale(1.03); }
.placeholder { color: var(--text-3); font-size: 12px; }
.image-tag { position: absolute; top: 14px; left: 14px; background: rgba(255, 255, 255, 0.8); -webkit-backdrop-filter: saturate(180%) blur(16px); backdrop-filter: saturate(180%) blur(16px); }
.lost-body { display: flex; flex: 1; flex-direction: column; gap: 8px; padding: 21px 22px 23px; }
.lost-body h2 { font-size: 20px; font-weight: 600; letter-spacing: -0.025em; line-height: 1.3; }
.lost-body p { display: -webkit-box; overflow: hidden; margin: 0; color: var(--text-2); font-size: 14px; line-height: 1.55; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.lost-meta { display: flex; justify-content: space-between; gap: 8px; margin-top: auto; padding-top: 10px; color: var(--text-3); font-size: 11px; }
.lost-meta time { flex: 0 0 auto; }
.skeleton-card { padding: 24px; border-radius: 20px; background: #f5f5f7; }
.pagination { justify-content: center; margin: 40px 0 0; }

@media (max-width: 900px) {
  .filter-panel { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .filter-actions { grid-column: span 2; }
  .lost-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 560px) {
  .toolbar-row { align-items: stretch; flex-direction: column; gap: 8px; }
  .search-field { max-width: none; }
  .filter-toggle { align-self: flex-end; }
  .filter-panel { grid-template-columns: 1fr; }
  .filter-panel > * { width: 100% !important; }
  .filter-actions { grid-column: auto; }
  .lost-grid { grid-template-columns: 1fr; }
}
</style>
