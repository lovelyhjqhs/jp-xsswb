<script setup>
import { onMounted, ref } from 'vue';
import { Refresh, Warning } from '@element-plus/icons-vue';
import { useRoute, useRouter } from 'vue-router';
import { getPublicLostFound } from '../../api/public.js';
import EmptyState from '../../components/EmptyState.vue';
import { formatDateTime, statusText, typeText } from '../../utils/format.js';

const route = useRoute(); const router = useRouter(); const item = ref(null); const loading = ref(true); const errorMessage = ref('');
async function load() { loading.value = true; errorMessage.value = ''; try { item.value = await getPublicLostFound(route.params.id); } catch (error) { errorMessage.value = error.message || '失物详情加载失败'; } finally { loading.value = false; } }
onMounted(load);
</script>

<template>
  <div class="page public-page">
    <el-skeleton v-if="loading" :rows="10" animated />
    <EmptyState v-else-if="errorMessage" :icon="Warning" title="记录不存在或已下线" :description="errorMessage">
      <el-button type="primary" :icon="Refresh" @click="load">重新加载</el-button>
    </EmptyState>
    <EmptyState v-else-if="!item" title="记录不存在或已下线">
      <el-button type="primary" @click="router.push('/lost-found')">返回失物招领</el-button>
    </EmptyState>
    <article v-else class="detail-grid">
      <section class="gallery">
        <div v-if="item.images?.length" class="photo-grid">
          <figure v-for="image in item.images" :key="image.id || image.url">
            <img :src="image.url" :alt="image.altText || image.alt || item.title || '失物图片'" loading="lazy" />
          </figure>
        </div>
        <div v-else class="gallery-empty">暂无图片</div>
      </section>

      <section class="info-panel">
        <div class="tag-row">
          <span class="tag" :class="item.itemType === 'found' || item.type === 'found' ? 'tag-found' : 'tag-lost'">{{ typeText(item.itemType || item.type) }}</span>
          <span class="tag tag-open">{{ statusText(item.status) }}</span>
        </div>
        <h1>{{ item.title || item.features || '未命名物品' }}</h1>
        <dl class="facts">
          <div><dt>编号</dt><dd>{{ item.itemNo || '暂无' }}</dd></div>
          <div><dt>区域</dt><dd>{{ item.area || '暂无' }} 区</dd></div>
          <div><dt>物品类型</dt><dd>{{ item.category?.name || item.categoryName || '未分类' }}</dd></div>
          <div><dt>地点</dt><dd>{{ item.location || '暂无' }}</dd></div>
          <div><dt>时间</dt><dd>{{ formatDateTime(item.happenedAt || item.createdAt) }}</dd></div>
        </dl>
        <el-button type="primary" size="large" @click="router.push({ path: '/lost-found/inquiry', query: { itemId: item.id } })">提交招领线索</el-button>
      </section>

      <section class="description-panel">
        <h2>物品特征</h2>
        <p>{{ item.features || item.description || '暂无公开特征描述。' }}</p>
        <p class="privacy-note">为保护投稿人隐私，公开页面不展示私人联系方式和管理员备注。</p>
      </section>
    </article>
  </div>
</template>

<style scoped>
.public-page { max-width: 1040px; }

.detail-grid { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(320px, 0.9fr); gap: 16px; padding-top: 12px; }

.gallery { min-height: 380px; border: 1px solid rgba(0, 0, 0, 0.06); border-radius: 30px; background: #f5f5f7; overflow: hidden; }
.photo-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px; }
.photo-grid figure { margin: 0; overflow: hidden; }
.photo-grid img { display: block; width: 100%; aspect-ratio: 4 / 3; object-fit: cover; }
.gallery-empty { display: grid; place-items: center; min-height: 380px; color: var(--text-3); font-size: 14px; }

.info-panel {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 36px;
  border-radius: 30px;
  background: #f5f5f7;
}
.info-panel h1 { margin: 22px 0 28px; font-size: clamp(32px, 4vw, 46px); font-weight: 600; line-height: 1.08; letter-spacing: -0.045em; }
.tag-row { display: flex; gap: 8px; }
.facts { display: grid; gap: 0; width: 100%; margin: 0 0 30px; }
.facts div { display: grid; grid-template-columns: 84px minmax(0, 1fr); gap: 10px; padding: 12px 0; border-top: 1px solid rgba(0, 0, 0, 0.07); font-size: 14px; }
.facts dt { color: var(--text-3); }
.facts dd { margin: 0; color: var(--text); word-break: break-word; }

.description-panel { grid-column: 1 / -1; padding: 38px; border: 1px solid rgba(0, 0, 0, 0.06); border-radius: 30px; background: #fff; }
.description-panel h2 { margin-bottom: 16px; font-size: 30px; letter-spacing: -0.035em; }
.description-panel p { margin: 0; white-space: pre-wrap; color: var(--text-2); font-size: 16px; line-height: 1.7; }
.description-panel .privacy-note { margin-top: 20px; color: var(--text-3); font-size: 13px; }

@media (max-width: 760px) {
  .detail-grid { grid-template-columns: 1fr; }
  .description-panel { grid-column: auto; }
  .info-panel,
  .description-panel { padding: 24px; border-radius: 26px; }
}
</style>
