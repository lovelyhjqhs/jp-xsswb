<script setup>
import { computed, onMounted, ref } from 'vue';
import { Refresh, Warning } from '@element-plus/icons-vue';
import { getPublicProfile } from '../../api/public.js';
import EmptyState from '../../components/EmptyState.vue';

const profile = ref(null);
const loading = ref(true);
const errorMessage = ref('');
const paragraphs = computed(() => [
  profile.value?.organization || profile.value?.orgStructure,
  profile.value?.history,
  profile.value?.spirit,
].filter(Boolean));

async function load() {
  loading.value = true;
  errorMessage.value = '';
  try { profile.value = await getPublicProfile(); }
  catch (error) { errorMessage.value = error.message || '部门概况加载失败'; }
  finally { loading.value = false; }
}

onMounted(load);
</script>

<template>
  <div class="page public-page public-section-page profile-page">
    <section v-if="loading" class="profile-loading" aria-label="部门概况正在加载">
      <el-skeleton :rows="14" animated />
    </section>
    <EmptyState v-else-if="errorMessage" :icon="Warning" title="加载失败" :description="errorMessage">
      <el-button type="primary" :icon="Refresh" @click="load">重新加载</el-button>
    </EmptyState>
    <EmptyState v-else-if="!profile" title="部门概况正在整理中" description="相关内容发布后会在这里公开。" />
    <article v-else class="profile-document">
      <header class="public-section-heading">
        <h1>部门概况</h1>
      </header>
      <figure v-if="profile.logo" class="department-logo">
        <img :src="profile.logo.url" :alt="profile.logo.altText" />
      </figure>
      <div class="profile-text">
        <p v-for="(paragraph, index) in paragraphs" :key="index">{{ paragraph }}</p>
      </div>
    </article>
  </div>
</template>

<style scoped>
.profile-page { max-width: var(--content-max); background: var(--bg); }
.profile-loading { min-height: 420px; padding: 24px; }
.profile-document { width: 100%; min-width: 0; max-width: 980px; margin: 0 auto; }
.profile-document :deep(.public-section-heading h1) { text-align: center; }

.department-logo { width: min(100%, 900px); margin: 0 auto 38px; }
.department-logo img { display: block; width: 100%; height: auto; }
.profile-text {
  max-width: 900px;
  margin: 0 auto;
  color: #36363a;
  font-size: 17px;
  line-height: 1.9;
}
.profile-text p { margin: 0; text-align: justify; text-indent: 2em; }
.profile-text p + p { margin-top: 18px; }

@media (max-width: 760px) {
  .profile-loading { min-height: 360px; padding: 8px 0; }
  .department-logo { margin-bottom: 28px; }
  .profile-text { font-size: 16px; line-height: 1.85; }
  .profile-text p { text-align: left; }
  .profile-text p + p { margin-top: 16px; }
}
</style>
