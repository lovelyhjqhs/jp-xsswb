<script setup>
import { reactive, ref } from 'vue';
import { Search } from '@element-plus/icons-vue';
import { queryPublicSubmission } from '../../api/public.js';

const form = reactive({ queryNo: '', queryCredential: '' }); const loading = ref(false); const errorMessage = ref(''); const result = ref(null);
const statusLabels = { pending_review: '待审核', approved: '已通过', processing: '处理中', processed: '已处理', rejected: '已驳回', archived: '已归档', deleted: '已删除' };
function statusText(value) { return statusLabels[value] || value || '未知状态'; }
async function submit() { if (!form.queryNo.trim() || !form.queryCredential.trim()) { errorMessage.value = '请输入查询编号和查询凭证'; return; } loading.value = true; errorMessage.value = ''; result.value = null; try { result.value = await queryPublicSubmission({ queryNo: form.queryNo.trim(), queryCredential: form.queryCredential.trim() }); } catch (error) { errorMessage.value = error.message || '查询失败，请检查编号和凭证'; } finally { loading.value = false; } }
</script>

<template>
  <div class="page query-page">
    <header class="page-heading">
      <h1>查询处理状态</h1>
      <p>使用提交成功时获得的查询编号和查询凭证。</p>
    </header>

    <section class="query-panel">
      <el-form :model="form" label-position="top" @submit.prevent="submit">
        <el-form-item label="查询编号" required>
          <el-input v-model="form.queryNo" size="large" autocomplete="off" placeholder="请输入查询编号" />
        </el-form-item>
        <el-form-item label="查询凭证" required>
          <el-input v-model="form.queryCredential" size="large" type="password" show-password autocomplete="off" placeholder="请输入查询凭证" />
        </el-form-item>
        <el-alert v-if="errorMessage" type="error" :closable="false" :title="errorMessage" />
        <el-button class="submit-button" type="primary" size="large" :loading="loading" :icon="Search" @click="submit">查询状态</el-button>
      </el-form>
    </section>

    <section v-if="result" class="result-panel" aria-live="polite">
      <div class="result-top">
        <span class="result-label">当前状态</span>
        <span class="tag tag-open">{{ statusText(result.statusText || result.status) }}</span>
      </div>
      <dl>
        <div><dt>查询编号</dt><dd>{{ result.queryNo || form.queryNo }}</dd></div>
        <div v-if="result.updatedAt"><dt>更新时间</dt><dd>{{ result.updatedAt }}</dd></div>
      </dl>
      <div v-if="result.publicReply" class="reply">
        <strong>公开回复</strong>
        <p>{{ result.publicReply }}</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.query-page { max-width: 620px; }

.page-heading { padding: 38px 0 40px; }
.page-heading h1 { font-size: clamp(40px, 5.2vw, 60px); font-weight: 600; letter-spacing: -0.045em; line-height: 1.02; }
.page-heading p { margin: 16px 0 0; color: var(--text-2); font-size: 17px; line-height: 1.55; }

.query-panel,
.result-panel { margin-top: 8px; padding: 34px; border: 1px solid rgba(0, 0, 0, 0.06); border-radius: 28px; background: #f5f5f7; }
.query-panel :deep(.el-alert) { margin-bottom: 16px; }
.submit-button { width: 100%; margin-top: 8px; }

.result-panel { margin-top: 20px; }
.result-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-bottom: 20px; border-bottom: 1px solid rgba(0, 0, 0, 0.06); }
.result-label { color: var(--text-2); font-size: 14px; }
.result-panel dl { display: grid; gap: 12px; margin: 20px 0 0; }
.result-panel dl div { display: grid; grid-template-columns: 90px minmax(0, 1fr); gap: 8px; font-size: 15px; }
.result-panel dt { color: var(--text-3); }
.result-panel dd { margin: 0; word-break: break-word; }
.reply { margin-top: 24px; padding: 20px; border-radius: 16px; background: #fff; }
.reply strong { font-size: 15px; }
.reply p { margin: 8px 0 0; white-space: pre-wrap; color: var(--text-2); font-size: 15px; line-height: 1.6; }

@media (max-width: 560px) {
  .page-heading { padding-top: 30px; }
  .page-heading h1 { font-size: 40px; }
  .query-panel,
  .result-panel { padding: 24px; }
}
</style>
