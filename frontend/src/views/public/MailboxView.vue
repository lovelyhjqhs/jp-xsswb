<script setup>
import { onMounted, ref } from 'vue';
import { Refresh, Warning } from '@element-plus/icons-vue';
import { useRouter } from 'vue-router';
import { listPublicCategories, listPublicMailbox } from '../../api/public.js';
import EmptyState from '../../components/EmptyState.vue';
import { formatDateTime } from '../../utils/format.js';

const router = useRouter(); const items = ref([]); const categories = ref([]); const category = ref(''); const loading = ref(true); const errorMessage = ref('');
function listOf(data) { return data?.items || data?.list || data?.records || []; }
async function load() { loading.value = true; errorMessage.value = ''; try { items.value = listOf(await listPublicMailbox({ page: 1, pageSize: 12, categoryId: category.value || undefined })); } catch (error) { errorMessage.value = error.message || '公开信箱加载失败'; } finally { loading.value = false; } }
async function loadCategories() { try { categories.value = listOf(await listPublicCategories('mailbox')); } catch { categories.value = []; } }
onMounted(() => { load(); loadCategories(); });
</script>

<template>
  <div class="page public-page public-section-page">
    <header class="public-section-heading">
      <h1>学生信箱</h1>
      <p>匿名或署名，向学校管理和部门建设提出意见。</p>
      <div class="heading-actions">
        <el-button type="primary" @click="router.push('/mailbox/submit')">写信给我们</el-button>
        <el-button @click="router.push('/mailbox/query')">查询处理状态</el-button>
      </div>
    </header>

    <section class="mailbox-toolbar" aria-label="公开信箱筛选">
      <el-select v-model="category" clearable placeholder="全部分类" aria-label="信箱分类" @change="load">
        <el-option v-for="item in categories" :key="item.id || item.slug" :label="item.name" :value="item.id || item.slug" />
      </el-select>
    </section>

    <div v-if="loading" class="mailbox-list" aria-busy="true">
      <div v-for="n in 4" :key="n" class="skeleton-row"><el-skeleton :rows="3" animated /></div>
    </div>
    <EmptyState v-else-if="errorMessage" :icon="Warning" title="加载失败" :description="errorMessage">
      <el-button type="primary" :icon="Refresh" @click="load">重新加载</el-button>
    </EmptyState>
    <EmptyState v-else-if="!items.length" title="暂未公开学生信箱内容" description="投稿默认不公开，审核通过且允许公开后才会显示。" />
    <div v-else class="mailbox-list">
      <article v-for="item in items" :key="item.id" class="mailbox-item">
        <div class="mailbox-meta">
          <span>{{ item.category?.name || item.categoryName || '部门建设' }}</span>
          <time>{{ formatDateTime(item.publishedAt || item.createdAt) }}</time>
        </div>
        <h2>{{ item.subject || item.title }}</h2>
        <p>{{ item.publicContent || item.content }}</p>
      </article>
    </div>
  </div>
</template>

<style scoped>
.public-page { max-width: var(--content-max); }

.heading-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 28px; }
.heading-actions :deep(.el-button + .el-button) { margin-left: 0; }

.mailbox-toolbar { margin-bottom: 8px; padding: 16px 0 20px; border-top: 1px solid var(--hairline); border-bottom: 1px solid var(--hairline); }
.mailbox-toolbar .el-select { width: 240px; }

.mailbox-list { display: grid; gap: 0; margin-top: 0; }
.mailbox-item { padding: 36px 0; border-bottom: 1px solid var(--hairline); }
.mailbox-meta { display: flex; justify-content: space-between; gap: 10px; color: var(--text-3); font-size: 11px; }
.mailbox-meta span { color: #0066cc; font-weight: 600; letter-spacing: 0.04em; }
.mailbox-item h2 { margin: 18px 0 12px; font-size: 27px; font-weight: 600; letter-spacing: -0.035em; line-height: 1.25; }
.mailbox-item p { margin: 0; white-space: pre-wrap; color: var(--text-2); font-size: 16px; line-height: 1.65; }
.skeleton-row { padding: 28px 0; border-bottom: 1px solid var(--hairline); }

@media (max-width: 520px) {
  .mailbox-toolbar .el-select { width: 100%; }
  .mailbox-meta { align-items: flex-start; flex-direction: column; gap: 4px; }
  .mailbox-item { padding: 24px; }
}
</style>
