<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Refresh, Search } from '@element-plus/icons-vue';

import {
  approveAdminItem,
  batchAdminItems,
  confirmAdminItemMatch,
  deleteAdminItem,
  ignoreAdminItemMatch,
  listAdminItems,
  listAdminItemMatches,
  manuallyLinkAdminItemMatch,
  offlineAdminItem,
  rejectAdminItem,
  restoreAdminItem,
} from '../../api/admin.js';
import EmptyState from '../../components/EmptyState.vue';
import { formatDateTime, statusClass, statusText, typeClass, typeShort } from '../../utils/format.js';

const route = useRoute();

const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'pending', label: '待审核' },
  { value: 'open', label: '进行中' },
  { value: 'resolved', label: '已找回' },
  { value: 'cleaned', label: '已清理' },
  { value: 'rejected', label: '已驳回' },
  { value: 'offline', label: '已下架' },
];

const filters = reactive({
  status: typeof route.query.status === 'string' ? route.query.status : '',
  type: '',
  area: '',
  dateFrom: '',
  dateTo: '',
  keyword: '',
});

const list = ref([]);
const pagination = ref({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
const loading = ref(false);
const errorMessage = ref('');
const acting = ref(false);
const selectedIds = ref([]);

const rejectDialog = reactive({ visible: false, reason: '', targetIds: [], batch: false });
const matchDialog = reactive({ visible: false, source: null, suggestions: [], loading: false, error: '', acting: false });
const manualTargetRef = ref('');

const hasSelection = computed(() => selectedIds.value.length > 0);

async function load(page = pagination.value.page) {
  loading.value = true;
  errorMessage.value = '';
  try {
    const params = { page, pageSize: pagination.value.pageSize };
    if (filters.status) params.status = filters.status;
    if (filters.type) params.type = filters.type;
    if (filters.area) params.area = filters.area;
    if (filters.dateFrom) params.dateFrom = filters.dateFrom;
    if (filters.dateTo) params.dateTo = filters.dateTo;
    if (filters.keyword.trim()) params.keyword = filters.keyword.trim();

    const data = await listAdminItems(params);
    list.value = data.list;
    pagination.value = data.pagination;
  } catch (error) {
    errorMessage.value = error.message;
  } finally {
    loading.value = false;
  }
}

watch(
  () => [filters.status, filters.type, filters.area, filters.dateFrom, filters.dateTo],
  () => load(1),
);

onMounted(() => load(1));

function onSelectionChange(rows) {
  selectedIds.value = rows.map((row) => row.id);
}

async function openMatchDialog(row) {
  matchDialog.visible = true;
  matchDialog.source = row;
  matchDialog.suggestions = [];
  matchDialog.error = '';
  matchDialog.loading = true;
  manualTargetRef.value = '';
  try {
    const data = await listAdminItemMatches(row.id, { limit: 20 });
    matchDialog.suggestions = data?.suggestions || data?.list || [];
  } catch (error) {
    matchDialog.error = error.message || '匹配建议加载失败';
  } finally {
    matchDialog.loading = false;
  }
}

async function reloadMatches() {
  if (matchDialog.source) await openMatchDialog(matchDialog.source);
}

async function actOnMatch(action, suggestion) {
  const sourceId = matchDialog.source?.id;
  const matchId = suggestion?.matchId;
  if (!sourceId || !matchId || suggestion.status !== 'suggested') return;
  matchDialog.acting = true;
  try {
    if (action === 'confirm') await confirmAdminItemMatch(sourceId, matchId);
    else await ignoreAdminItemMatch(sourceId, matchId);
    ElMessage.success(action === 'confirm' ? '已确认匹配建议' : '已忽略匹配建议');
    await reloadMatches();
  } catch {
    // 请求拦截器负责显示错误
  } finally {
    matchDialog.acting = false;
  }
}

async function manuallyLink() {
  const sourceId = matchDialog.source?.id;
  const targetRef = manualTargetRef.value.trim();
  if (!sourceId || !targetRef) {
    ElMessage.warning('请输入有效的目标记录 ID 或编号');
    return;
  }
  const payload = /^\d+$/.test(targetRef)
    ? { targetItemId: Number(targetRef) }
    : { targetItemNo: targetRef };
  matchDialog.acting = true;
  try {
    await manuallyLinkAdminItemMatch(sourceId, payload);
    ElMessage.success('已建立人工关联');
    manualTargetRef.value = '';
    await reloadMatches();
  } catch {
    // 请求拦截器负责显示错误
  } finally {
    matchDialog.acting = false;
  }
}

/** 表格里那一个「主操作」按钮，按状态决定语义 */
function primaryAction(row) {
  if (row.status === 'pending' || row.status === 'rejected') return { action: 'approve', label: '通过' };
  if (row.status === 'offline') return { action: 'restore', label: '恢复' };
  return { action: 'offline', label: '下架' };
}

const RUNNERS = {
  approve: (id) => approveAdminItem(id),
  offline: (id) => offlineAdminItem(id),
  restore: (id) => restoreAdminItem(id),
  delete: (id) => deleteAdminItem(id),
};

/** 单条操作成功后的提示文案（后端返回的是数据，这里给出面向人的结果） */
const ACTION_OK = {
  approve: '已审核通过',
  offline: '已下架',
  restore: '已恢复',
  delete: '已删除',
};

async function runAction(action, ids) {
  if (action === 'matches') {
    const row = list.value.find((item) => item.id === ids[0]);
    if (row) await openMatchDialog(row);
    return;
  }

  if (action === 'reject') {
    rejectDialog.targetIds = ids;
    rejectDialog.batch = ids.length > 1;
    rejectDialog.reason = '';
    rejectDialog.visible = true;
    return;
  }

  if (ids.length > 1) {
    // 破坏性批量操作同样要二次确认，避免误点一片
    if (action === 'delete' || action === 'offline') {
      const text =
        action === 'delete'
          ? `将删除选中的 ${ids.length} 条帖子，删除后无法恢复。确定吗？`
          : `将下架选中的 ${ids.length} 条帖子，它们会从前台消失。确定吗？`;
      try {
        await ElMessageBox.confirm(text, action === 'delete' ? '批量删除' : '批量下架', {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning',
        });
      } catch {
        return;
      }
    }

    // 批量：交给后端逐条执行，失败明细由它返回
    acting.value = true;
    try {
      const result = await batchAdminItems({ action, ids });
      ElMessage({
        type: result.failed ? 'warning' : 'success',
        message:
          result.failed === 0
            ? `已处理 ${result.succeeded} 条`
            : `成功 ${result.succeeded} 条，失败 ${result.failed} 条`,
      });
      await load();
    } catch {
      // 拦截器已提示
    } finally {
      acting.value = false;
    }
    return;
  }

  const [id] = ids;
  if (action === 'delete' || action === 'offline') {
    const text =
      action === 'delete' ? '删除后无法恢复，确定删除这条帖子吗？' : '下架后该帖子将不在前台展示，确定吗？';
    try {
      await ElMessageBox.confirm(text, action === 'delete' ? '删除帖子' : '下架帖子', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      });
    } catch {
      return;
    }
  }

  acting.value = true;
  try {
    await RUNNERS[action](id);
    ElMessage.success(ACTION_OK[action] ?? '操作成功');
    await load();
  } catch {
    // 拦截器已提示
  } finally {
    acting.value = false;
  }
}

async function submitReject() {
  const reason = rejectDialog.reason.trim();
  if (reason.length < 2) {
    ElMessage.warning('请填写至少 2 个字的驳回原因');
    return;
  }

  acting.value = true;
  try {
    if (rejectDialog.targetIds.length > 1) {
      const result = await batchAdminItems({
        action: 'reject',
        ids: rejectDialog.targetIds,
        reason,
      });
      ElMessage({
        type: result.failed ? 'warning' : 'success',
        message: `成功 ${result.succeeded} 条，失败 ${result.failed} 条`,
      });
    } else {
      await rejectAdminItem(rejectDialog.targetIds[0], reason);
      ElMessage.success('已驳回');
    }
    rejectDialog.visible = false;
    await load();
  } catch {
    // 拦截器已提示
  } finally {
    acting.value = false;
  }
}

function onBatch(action) {
  if (!hasSelection.value) {
    ElMessage.warning('请先选择要操作的帖子');
    return;
  }
  runAction(action, selectedIds.value);
}
</script>

<template>
  <div class="admin-items">
    <!-- 筛选 -->
    <section class="panel filter-panel">
      <el-select v-model="filters.status" placeholder="全部状态" style="width: 140px">
        <el-option
          v-for="option in STATUS_OPTIONS"
          :key="option.value"
          :label="option.label"
          :value="option.value"
        />
      </el-select>

      <el-select v-model="filters.type" placeholder="全部类型" style="width: 130px">
        <el-option label="全部类型" value="" />
        <el-option label="寻物" value="lost" />
        <el-option label="招领" value="found" />
      </el-select>

      <el-select v-model="filters.area" placeholder="全部区域" clearable style="width: 130px">
        <el-option label="A 区" value="A" />
        <el-option label="B 区" value="B" />
        <el-option label="D 区" value="D" />
      </el-select>

      <el-date-picker v-model="filters.dateFrom" type="date" value-format="YYYY-MM-DD" placeholder="开始日期" clearable />
      <el-date-picker v-model="filters.dateTo" type="date" value-format="YYYY-MM-DD" placeholder="结束日期" clearable />

      <el-input
        v-model="filters.keyword"
        class="keyword-input"
        clearable
        placeholder="搜索标题、描述或发布者学号/姓名"
        :prefix-icon="Search"
        @keyup.enter="load(1)"
        @clear="load(1)"
      />

      <el-button type="primary" @click="load(1)">搜索</el-button>
      <el-button :icon="Refresh" @click="((filters.status = ''), (filters.type = ''), (filters.area = ''), (filters.dateFrom = ''), (filters.dateTo = ''), (filters.keyword = ''), load(1))">
        重置
      </el-button>
    </section>

    <!-- 批量操作条 -->
    <section v-if="hasSelection" class="batch-bar">
      <span>已选 {{ selectedIds.length }} 项</span>
      <div class="batch-actions">
        <el-button size="small" :loading="acting" @click="onBatch('approve')">批量通过</el-button>
        <el-button size="small" :loading="acting" @click="onBatch('reject')">批量驳回</el-button>
        <el-button size="small" :loading="acting" @click="onBatch('offline')">批量下架</el-button>
        <el-button size="small" :loading="acting" @click="onBatch('restore')">批量恢复</el-button>
        <el-button size="small" type="danger" plain :loading="acting" @click="onBatch('delete')">
          批量删除
        </el-button>
      </div>
    </section>

    <!-- 列表 -->
    <section class="panel table-panel">
      <el-skeleton v-if="loading && !list.length" :rows="6" animated />

      <EmptyState
        v-else-if="errorMessage"
        title="加载失败"
        :description="errorMessage"
      >
        <el-button type="primary" :icon="Refresh" @click="load()">重新加载</el-button>
      </EmptyState>

      <EmptyState v-else-if="!list.length" title="没有符合条件的帖子" description="换个筛选条件试试" />

      <template v-else>
        <el-table
          :data="list"
          row-key="id"
          class="admin-table"
          @selection-change="onSelectionChange"
        >
          <el-table-column type="selection" width="44" />

          <el-table-column label="帖子" min-width="240">
            <template #default="{ row }">
              <div class="cell-title">
                <a class="title-link" :href="`/items/${row.id}`" target="_blank" rel="noopener">
                  {{ row.title }}
                </a>
                <div class="cell-meta">
                  <span class="tag" :class="typeClass(row.type)">{{ typeShort(row.type) }}</span>
                  <span class="tag" :class="statusClass(row.status)">{{ statusText(row.status) }}</span>
                  <span v-if="row.area" class="tiny">{{ row.area }} 区</span>
                  <span v-if="row.itemNo" class="tiny">编号 {{ row.itemNo }}</span>
                  <span class="tiny">{{ row.category?.name || '未分类' }}</span>
                </div>
                <p v-if="row.features" class="item-features">{{ row.features }}</p>
                <p v-if="row.rejectReason" class="reject-reason">驳回原因：{{ row.rejectReason }}</p>
              </div>
            </template>
          </el-table-column>

          <el-table-column label="发布者" width="150">
            <template #default="{ row }">
              <div class="cell-stack">
                <span>{{ row.user?.name }}</span>
                <span class="tiny">{{ row.user?.studentNo }}</span>
              </div>
            </template>
          </el-table-column>

          <el-table-column label="举报" width="70" align="center">
            <template #default="{ row }">
              <el-badge v-if="row._count.reports" :value="row._count.reports" type="danger" />
              <span v-else class="tiny">0</span>
            </template>
          </el-table-column>

          <el-table-column label="发布时间" width="150">
            <template #default="{ row }">
              <span class="tiny">{{ formatDateTime(row.createdAt) }}</span>
            </template>
          </el-table-column>

          <el-table-column label="私有信息" min-width="190">
            <template #default="{ row }">
              <div class="cell-stack private-cell">
                <span v-if="row.contactValue">{{ row.contactType || '联系方式' }}：{{ row.contactValue }}</span>
                <span v-else class="tiny">暂无联系方式</span>
                <span v-if="row.internalNote" class="internal-note">备注：{{ row.internalNote }}</span>
              </div>
            </template>
          </el-table-column>

          <el-table-column label="操作" width="220" fixed="right">
            <template #default="{ row }">
              <div class="row-actions">
                <el-button
                  size="small"
                  type="primary"
                  plain
                  :loading="acting"
                  @click="runAction(primaryAction(row).action, [row.id])"
                >
                  {{ primaryAction(row).label }}
                </el-button>

                <el-button size="small" text :loading="acting" @click="openMatchDialog(row)">匹配</el-button>

                <el-dropdown trigger="click" @command="(command) => runAction(command, [row.id])">
                  <el-button size="small" text>更多</el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <!-- 可选项必须与后端 TRANSITIONS 一致，否则点了只会拿到 409 -->
                      <el-dropdown-item v-if="['open', 'resolved'].includes(row.status)" command="reject">
                        驳回（需填原因）
                      </el-dropdown-item>
                      <el-dropdown-item v-if="['pending', 'rejected'].includes(row.status)" command="approve">
                        审核通过
                      </el-dropdown-item>
                      <el-dropdown-item v-if="row.status !== 'offline'" command="offline">
                        下架
                      </el-dropdown-item>
                      <el-dropdown-item v-if="['offline', 'rejected'].includes(row.status)" command="restore">
                        恢复
                      </el-dropdown-item>
                      <el-dropdown-item command="matches">匹配建议</el-dropdown-item>
                      <el-dropdown-item divided command="delete">
                        <span class="danger-text">删除</span>
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
            </template>
          </el-table-column>
        </el-table>

        <div class="pager">
          <el-pagination
            layout="total, prev, pager, next"
            :current-page="pagination.page"
            :page-size="pagination.pageSize"
            :total="pagination.total"
            background
            @current-change="load"
          />
        </div>
      </template>
    </section>

    <!-- 匹配建议：只提供人工决策，不自动改变公开状态 -->
    <el-dialog
      v-model="matchDialog.visible"
      :title="`匹配建议${matchDialog.source ? ` · ${matchDialog.source.title}` : ''}`"
      width="720px"
      destroy-on-close
    >
      <el-skeleton v-if="matchDialog.loading" :rows="5" animated />
      <EmptyState v-else-if="matchDialog.error" title="匹配建议加载失败" :description="matchDialog.error">
        <el-button type="primary" @click="reloadMatches">重新加载</el-button>
      </EmptyState>
      <template v-else>
        <p class="dialog-hint">
          以下结果仅根据区域、类型、时间、关键词和特征计算，需管理员人工确认后才建立关联。
        </p>
        <EmptyState v-if="!matchDialog.suggestions.length" title="暂无匹配建议" description="可以输入目标记录编号进行人工关联。" />
        <div v-else class="match-list">
          <article v-for="suggestion in matchDialog.suggestions" :key="suggestion.matchId || suggestion.targetItemId" class="match-row">
            <div class="match-main">
              <div class="match-title">
                <strong>{{ suggestion.candidate?.title || `记录 #${suggestion.targetItemId}` }}</strong>
                <span class="match-score">{{ Math.round(Number(suggestion.score || 0)) }}%</span>
              </div>
              <p class="match-meta">
                {{ suggestion.candidate?.area ? `${suggestion.candidate.area} 区 · ` : '' }}
                {{ suggestion.candidate?.itemNo || `记录 #${suggestion.targetItemId}` }}
                <span v-if="suggestion.candidate?.status"> · {{ statusText(suggestion.candidate.status) }}</span>
              </p>
              <ul v-if="suggestion.reasons?.length" class="match-reasons">
                <li v-for="(reason, index) in suggestion.reasons" :key="reason.code || index">
                  {{ reason.label || reason }}<span v-if="reason.points">（{{ reason.points }} 分）</span>
                </li>
              </ul>
            </div>
            <div class="match-actions">
              <template v-if="suggestion.status === 'suggested'">
                <el-button size="small" type="primary" :loading="matchDialog.acting" @click="actOnMatch('confirm', suggestion)">确认关联</el-button>
                <el-button size="small" :loading="matchDialog.acting" @click="actOnMatch('ignore', suggestion)">忽略</el-button>
              </template>
              <span v-else class="match-decision">{{ suggestion.status === 'confirmed' ? '已确认' : '已忽略' }}</span>
            </div>
          </article>
        </div>
        <div class="manual-match">
          <el-input v-model="manualTargetRef" clearable placeholder="目标记录 ID 或公开编号" aria-label="目标记录 ID 或公开编号" />
          <el-button :loading="matchDialog.acting" @click="manuallyLink">手动关联</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 驳回原因 -->
    <el-dialog v-model="rejectDialog.visible" :title="rejectDialog.batch ? '批量驳回' : '驳回帖子'" width="420px">
      <p class="dialog-hint">
        驳回后作者会看到原因，并可修改后重新提交。
        <template v-if="rejectDialog.batch">本次将驳回 {{ rejectDialog.targetIds.length }} 条。</template>
      </p>
      <el-input
        v-model="rejectDialog.reason"
        type="textarea"
        :rows="4"
        maxlength="200"
        show-word-limit
        placeholder="例如：图片与描述不符 / 疑似虚假信息"
      />
      <template #footer>
        <el-button @click="rejectDialog.visible = false">取消</el-button>
        <el-button type="danger" :loading="acting" @click="submitReject">确认驳回</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.admin-items {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.filter-panel {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  padding: 16px;
  border: 0;
  background: var(--bg-alt);
  border-radius: 18px;
}

.keyword-input {
  flex: 1 1 220px;
  min-width: 180px;
}

.batch-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 16px;
  background: #e8f2ff;
  border: 0;
  border-radius: 16px;
  font-size: 13px;
}

.batch-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.batch-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}

.table-panel {
  padding: 16px 18px 12px;
  border: 0;
  background: var(--bg-alt);
  border-radius: 18px;
}

.admin-table {
  width: 100%;
  --el-table-bg-color: transparent;
  --el-table-tr-bg-color: transparent;
  --el-table-header-bg-color: transparent;
  --el-table-row-hover-bg-color: rgba(255, 255, 255, 0.7);
}

.cell-title {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.title-link {
  color: var(--text);
  font-weight: 600;
}

.title-link:hover {
  color: var(--brand);
}

.cell-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.reject-reason {
  margin: 0;
  color: var(--danger);
  font-size: 12px;
}

.item-features {
  margin: 0;
  color: var(--text-2);
  font-size: 12px;
  line-height: 1.5;
}

.match-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 420px;
  overflow: auto;
}

.match-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px;
  border: 0;
  border-radius: 14px;
  background: var(--bg-alt);
}

.match-main {
  min-width: 0;
}

.match-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.match-title strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.match-score {
  flex: 0 0 auto;
  color: var(--success);
  font-size: 12px;
  font-weight: 700;
}

.match-meta {
  margin: 5px 0 0;
  color: var(--text-3);
  font-size: 12px;
}

.match-reasons {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  margin: 6px 0 0;
  padding-left: 18px;
  color: var(--text-2);
  font-size: 12px;
}

.match-actions {
  display: flex;
  flex: 0 0 auto;
  gap: 4px;
}

.match-decision {
  color: var(--text-3);
  font-size: 12px;
  white-space: nowrap;
}

.manual-match {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--hairline);
}

.manual-match .el-input-number {
  width: 180px;
}

.cell-stack {
  display: flex;
  flex-direction: column;
}

.private-cell {
  gap: 3px;
  color: var(--text-2);
  font-size: 12px;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.internal-note {
  color: var(--warning, #b7791f);
}

.row-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.danger-text {
  color: var(--danger);
}

.pager {
  display: flex;
  justify-content: flex-end;
  padding: 12px 10px 0;
}

.dialog-hint {
  margin: 0 0 12px;
  color: var(--text-2);
  font-size: 13px;
  line-height: 1.6;
}

@media (max-width: 640px) {
  .match-row { flex-direction: column; }
  .match-actions { width: 100%; }
  .match-actions .el-button { flex: 1; }
  .manual-match { align-items: stretch; flex-direction: column; }
  .manual-match .el-input-number { width: 100%; }
}
</style>
