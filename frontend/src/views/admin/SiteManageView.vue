<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Refresh, UploadFilled } from '@element-plus/icons-vue';
import EmptyState from '../../components/EmptyState.vue';
import {
  actionAdminCanteenReport,
  actionAdminNews,
  actionAdminProfile,
  changeAdminSubmission,
  createAdminCanteenReport,
  createAdminNews,
  updateAdminCanteenReport,
  updateAdminNews,
  getAdminProfile,
  listAdminCanteenReports,
  listAdminMedia,
  listAdminNews,
  listAdminRecycleBin,
  listAdminSubmissions,
  restoreAdminRecycleItem,
  saveAdminProfile,
  uploadAdminMedia,
} from '../../api/admin.js';

const tab = ref('profile');
const loading = ref(false);
const errorMessage = ref('');
const profile = reactive({ history: '', organization: '', spirit: '' });
const profileExists = ref(false);
const news = ref([]);
const reports = ref([]);
const submissions = ref([]);
const media = ref([]);
const recycle = ref([]);
const submissionType = ref('canteen_feedback');
const submissionStatus = ref('pending_review');
const mediaFile = ref(null);
const newsForm = reactive({ slug: '', title: '', summary: '', body: '' });
const reportForm = reactive({ reportMonth: '', surveySummary: '', feedbackSummary: '' });
const editingNewsId = ref(null);
const editingReportId = ref(null);

const statusText = {
  draft: '草稿', pending_review: '待审核', published: '已发布', rejected: '已驳回', archived: '已归档', deleted: '已删除',
  approved: '已通过', processing: '处理中', processed: '已处理', pending: '待审核', open: '进行中', resolved: '已找回', offline: '已归档',
};

const currentList = computed(() => tab.value === 'news' ? news.value : tab.value === 'canteen' ? reports.value : tab.value === 'submissions' ? submissions.value : tab.value === 'media' ? media.value : recycle.value);

async function loadProfile() {
  const data = await getAdminProfile();
  if (data) { Object.assign(profile, data); profileExists.value = true; } else profileExists.value = false;
}
async function loadLists() {
  const [newsData, reportData, mediaData, recycleData, submissionData] = await Promise.all([
    listAdminNews({ page: 1, pageSize: 50 }),
    listAdminCanteenReports({ page: 1, pageSize: 50 }),
    listAdminMedia({}),
    listAdminRecycleBin({ page: 1, pageSize: 100 }),
    listAdminSubmissions({ type: submissionType.value, status: submissionStatus.value, page: 1, pageSize: 50 }),
  ]);
  news.value = newsData.list || [];
  reports.value = reportData.list || [];
  media.value = mediaData || [];
  recycle.value = recycleData.list || [];
  submissions.value = submissionData.list || [];
}
async function load() {
  loading.value = true; errorMessage.value = '';
  try { await Promise.all([loadProfile(), loadLists()]); } catch (error) { errorMessage.value = error.message || '加载失败'; } finally { loading.value = false; }
}
onMounted(load);

async function saveProfileForm() { await saveAdminProfile({ ...profile }); profileExists.value = true; ElMessage.success('部门概况已保存为草稿'); }
async function publishProfile() { await actionAdminProfile('publish'); ElMessage.success('部门概况已发布'); await loadProfile(); }
async function createNews() { if (editingNewsId.value) await updateAdminNews(editingNewsId.value, { ...newsForm }); else await createAdminNews({ ...newsForm }); editingNewsId.value = null; Object.assign(newsForm, { slug: '', title: '', summary: '', body: '' }); ElMessage.success('动态已保存为草稿'); await loadLists(); }
function editNews(row) { editingNewsId.value = row.id; Object.assign(newsForm, { slug: row.slug, title: row.title, summary: row.summary, body: row.body }); tab.value = 'news'; }
async function newsAction(row, action) { await actionAdminNews(row.id, action); ElMessage.success('操作成功'); await loadLists(); }
async function createReport() { if (editingReportId.value) await updateAdminCanteenReport(editingReportId.value, { ...reportForm }); else await createAdminCanteenReport({ ...reportForm }); editingReportId.value = null; Object.assign(reportForm, { reportMonth: '', surveySummary: '', feedbackSummary: '' }); ElMessage.success('月报已保存为草稿'); await loadLists(); }
function editReport(row) { editingReportId.value = row.id; Object.assign(reportForm, { reportMonth: String(row.reportMonth).slice(0, 7), surveySummary: row.surveySummary, feedbackSummary: row.feedbackSummary }); tab.value = 'canteen'; }
async function reportAction(row, action) { await actionAdminCanteenReport(row.id, action); ElMessage.success('操作成功'); await loadLists(); }
async function review(row, action) {
  const payload = {};
  if (action === 'reject') {
    try { const result = await ElMessageBox.prompt('请输入驳回原因', '驳回投稿', { inputValidator: (value) => value.trim().length >= 2 || '至少填写 2 个字' }); payload.reason = result.value; } catch { return; }
  }
  await changeAdminSubmission(submissionType.value, row.id, action, payload); ElMessage.success('投稿状态已更新'); await loadLists();
}
async function onUpload(event) {
  const file = event.target.files?.[0]; if (!file) return;
  mediaFile.value = file;
  try { await uploadAdminMedia(file, file.name, 'private'); ElMessage.success('图片已上传'); await loadLists(); } catch { /* interceptor handles message */ } finally { event.target.value = ''; mediaFile.value = null; }
}
async function restore(row) { await restoreAdminRecycleItem(row.type, row.id); ElMessage.success('已恢复'); await loadLists(); }
function safe(action) { return action.catch((error) => { ElMessage.error(error.message || '操作失败'); }); }
</script>

<template>
  <div class="site-manage">
    <section class="panel site-toolbar">
      <div><h2>官网内容管理</h2><p class="muted">所有内容先保存为草稿，发布后才会出现在公开端。</p></div>
      <el-button :icon="Refresh" :loading="loading" @click="safe(load)">刷新</el-button>
    </section>
    <EmptyState v-if="errorMessage" title="内容加载失败" :description="errorMessage"><el-button type="primary" @click="safe(load)">重新加载</el-button></EmptyState>
    <section v-else class="panel site-panel">
      <el-tabs v-model="tab" type="card">
        <el-tab-pane label="部门概况" name="profile">
          <el-form label-position="top" class="form-grid">
            <el-form-item label="历史沿革"><el-input v-model="profile.history" type="textarea" :rows="6" maxlength="50000" show-word-limit /></el-form-item>
            <el-form-item label="组织架构"><el-input v-model="profile.organization" type="textarea" :rows="6" maxlength="50000" show-word-limit /></el-form-item>
            <el-form-item label="精神风貌"><el-input v-model="profile.spirit" type="textarea" :rows="6" maxlength="50000" show-word-limit /></el-form-item>
          </el-form>
          <div class="actions"><el-button type="primary" @click="safe(saveProfileForm)">保存草稿</el-button><el-button :disabled="!profileExists" @click="safe(publishProfile)">发布</el-button></div>
        </el-tab-pane>
        <el-tab-pane label="工作动态" name="news">
          <el-form inline class="inline-form"><el-form-item label="Slug"><el-input v-model="newsForm.slug" placeholder="如 sports-day-2026" /></el-form-item><el-form-item label="标题"><el-input v-model="newsForm.title" /></el-form-item><el-form-item label="摘要"><el-input v-model="newsForm.summary" /></el-form-item><el-form-item><el-button type="primary" @click="safe(createNews)">{{ editingNewsId ? '保存修改' : '新增草稿' }}</el-button></el-form-item></el-form>
          <el-form label-position="top"><el-form-item label="正文"><el-input v-model="newsForm.body" type="textarea" :rows="5" /></el-form-item></el-form>
          <el-table :data="news" row-key="id" size="small"><el-table-column prop="title" label="标题" min-width="220" /><el-table-column label="状态" width="100"><template #default="{ row }">{{ statusText[row.status] || row.status }}</template></el-table-column><el-table-column label="操作" width="240"><template #default="{ row }"><el-button size="small" text @click="editNews(row)">编辑</el-button><el-button v-if="row.status !== 'published'" size="small" @click="safe(() => newsAction(row, 'publish'))">发布</el-button><el-button v-else size="small" @click="safe(() => newsAction(row, 'withdraw'))">撤回</el-button><el-button size="small" text @click="safe(() => newsAction(row, 'archive'))">归档</el-button></template></el-table-column></el-table>
          <EmptyState v-if="!news.length" title="暂无动态" description="新增动态草稿后会显示在这里" />
        </el-tab-pane>
        <el-tab-pane label="食堂月报" name="canteen">
          <el-form inline class="inline-form"><el-form-item label="月份"><el-input v-model="reportForm.reportMonth" placeholder="YYYY-MM" /></el-form-item><el-form-item label="问卷汇总"><el-input v-model="reportForm.surveySummary" /></el-form-item><el-form-item label="食堂反馈"><el-input v-model="reportForm.feedbackSummary" /></el-form-item><el-form-item><el-button type="primary" @click="safe(createReport)">{{ editingReportId ? '保存修改' : '新增草稿' }}</el-button></el-form-item></el-form>
          <el-table :data="reports" row-key="id" size="small"><el-table-column label="月份" width="120"><template #default="{ row }">{{ String(row.reportMonth).slice(0, 7) }}</template></el-table-column><el-table-column prop="surveySummary" label="问卷汇总" min-width="180" show-overflow-tooltip /><el-table-column label="状态" width="100"><template #default="{ row }">{{ statusText[row.status] || row.status }}</template></el-table-column><el-table-column label="操作" width="240"><template #default="{ row }"><el-button size="small" text @click="editReport(row)">编辑</el-button><el-button v-if="row.status !== 'published'" size="small" @click="safe(() => reportAction(row, 'publish'))">发布</el-button><el-button v-else size="small" @click="safe(() => reportAction(row, 'withdraw'))">撤回</el-button><el-button size="small" text @click="safe(() => reportAction(row, 'archive'))">归档</el-button></template></el-table-column></el-table>
          <EmptyState v-if="!reports.length" title="暂无月报" description="按月份创建食堂月报" />
        </el-tab-pane>
        <el-tab-pane label="游客投稿审核" name="submissions">
          <div class="inline-form"><el-select v-model="submissionType" style="width: 190px" @change="safe(loadLists)"><el-option label="食堂意见" value="canteen_feedback" /><el-option label="学生信箱" value="mailbox" /><el-option label="失物登记" value="lost_found_item" /><el-option label="失物线索" value="lost_found_inquiry" /></el-select><el-select v-model="submissionStatus" style="width: 150px" @change="safe(loadLists)"><el-option label="待审核" value="pending_review" /><el-option label="已通过" value="approved" /><el-option label="处理中" value="processing" /><el-option label="已处理" value="processed" /><el-option label="已驳回" value="rejected" /><el-option label="已归档" value="archived" /></el-select></div>
          <el-table :data="submissions" row-key="id" size="small"><el-table-column prop="queryNo" label="查询编号" width="185" /><el-table-column label="内容" min-width="230"><template #default="{ row }">{{ row.subject || row.content || row.message || row.title || '失物登记' }}</template></el-table-column><el-table-column label="状态" width="100"><template #default="{ row }">{{ statusText[row.status] || row.status }}</template></el-table-column><el-table-column label="操作" width="250"><template #default="{ row }"><el-button size="small" @click="safe(() => review(row, 'approve'))">通过</el-button><el-button size="small" @click="safe(() => review(row, 'process'))">处理</el-button><el-button size="small" type="danger" plain @click="safe(() => review(row, 'reject'))">驳回</el-button><el-button size="small" text @click="safe(() => review(row, 'archive'))">归档</el-button></template></el-table-column></el-table>
          <EmptyState v-if="!submissions.length" title="暂无投稿" description="当前筛选条件下没有记录" />
        </el-tab-pane>
        <el-tab-pane label="媒体管理" name="media">
          <label class="upload-button"><UploadFilled /> 上传图片<input type="file" accept="image/jpeg,image/png,image/webp" @change="onUpload" /></label>
          <div class="media-grid"><figure v-for="item in media" :key="item.id" class="media-card"><img :src="`/api/admin/site/media/${item.id}/file`" :alt="item.altText" /><figcaption>{{ item.altText }}<small>{{ item.visibility }}</small></figcaption></figure></div>
          <EmptyState v-if="!media.length" title="暂无媒体" description="上传图片后可用于官网内容" />
        </el-tab-pane>
        <el-tab-pane label="回收站" name="recycle">
          <el-table :data="recycle" row-key="id" size="small"><el-table-column prop="type" label="类型" width="150" /><el-table-column label="标题/编号" min-width="220"><template #default="{ row }">{{ row.title || row.subject || row.queryNo || row.profileKey || row.url }}</template></el-table-column><el-table-column prop="deletedAt" label="删除时间" width="190" /><el-table-column label="操作" width="90"><template #default="{ row }"><el-button size="small" @click="safe(() => restore(row))">恢复</el-button></template></el-table-column></el-table>
          <EmptyState v-if="!recycle.length" title="回收站为空" />
        </el-tab-pane>
      </el-tabs>
      <div v-if="currentList.length === 0 && ['profile'].includes(tab)" class="sr-only">当前页面没有列表内容</div>
    </section>
  </div>
</template>

<style scoped>
.site-manage { display: flex; flex-direction: column; gap: 14px; }
.site-toolbar { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 20px 22px; border: 0; background: var(--bg-alt); border-radius: 18px; }
.site-toolbar h2 { margin: 0 0 4px; font-size: 19px; font-weight: 600; letter-spacing: -0.02em; }
.site-toolbar p { margin: 0; font-size: 13px; }
.site-panel { min-width: 0; padding: 20px 22px; border: 0; background: var(--bg-alt); border-radius: 18px; }
.form-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.form-grid :deep(.el-form-item) { margin-bottom: 0; }
.inline-form { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 14px; }
.inline-form :deep(.el-form-item) { margin-bottom: 0; }
.actions { display: flex; gap: 8px; margin-top: 16px; }
.upload-button { display: inline-flex; align-items: center; gap: 6px; min-height: 36px; padding: 0 20px; border-radius: var(--radius-pill); background: var(--brand); color: #fff; cursor: pointer; margin-bottom: 16px; font-size: 14px; }
.upload-button input { display: none; }
.media-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
.media-card { margin: 0; border-radius: 16px; overflow: hidden; background: var(--surface); }
.media-card img { display: block; width: 100%; aspect-ratio: 4 / 3; object-fit: cover; background: #e8e8ed; }
.media-card figcaption { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.media-card small { color: var(--text-3); }
@media (max-width: 800px) { .form-grid { grid-template-columns: 1fr; } .site-toolbar { align-items: stretch; flex-direction: column; } .site-toolbar .el-button { align-self: flex-start; } }
</style>
