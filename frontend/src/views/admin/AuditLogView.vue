<script setup>
import { onMounted, reactive, ref, watch } from 'vue';
import { Refresh } from '@element-plus/icons-vue';

import { listAdminAuditLogs } from '../../api/admin.js';
import EmptyState from '../../components/EmptyState.vue';
import { formatDateTime } from '../../utils/format.js';

/** 动作标识 → 中文名，与后端 audit.service 里写入的一致 */
const ACTION_LABELS = {
  'item.approve': '审核通过',
  'item.reject': '驳回帖子',
  'item.offline': '下架帖子',
  'item.restore': '恢复帖子',
  'item.delete': '删除帖子',
  'user.ban': '禁用用户',
  'user.unban': '启用用户',
  'user.resetPassword': '重置密码',
  'report.offline': '举报→下架',
  'report.ignore': '举报→忽略',
  'category.create': '新建分类',
  'category.update': '更新分类',
  'category.delete': '删除分类',
  'whitelist.import': '导入名单',
};

const TARGET_LABELS = {
  item: '帖子',
  user: '用户',
  report: '举报',
  category: '分类',
  whitelist: '名单',
};

const filters = reactive({ action: '', targetType: '' });
const list = ref([]);
const pagination = ref({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
const loading = ref(false);
const errorMessage = ref('');

async function load(page = pagination.value.page) {
  loading.value = true;
  errorMessage.value = '';
  try {
    const params = { page, pageSize: pagination.value.pageSize };
    if (filters.action) params.action = filters.action;
    if (filters.targetType) params.targetType = filters.targetType;

    const data = await listAdminAuditLogs(params);
    list.value = data.list;
    pagination.value = data.pagination;
  } catch (error) {
    errorMessage.value = error.message;
  } finally {
    loading.value = false;
  }
}

watch(
  () => [filters.action, filters.targetType],
  () => load(1),
);

onMounted(() => load(1));

function formatDetail(detail) {
  if (!detail) return '—';
  try {
    return JSON.stringify(detail, null, 2);
  } catch {
    return String(detail);
  }
}
</script>

<template>
  <div class="admin-logs">
    <section class="panel filter-panel">
      <el-select v-model="filters.action" style="width: 180px" placeholder="全部动作">
        <el-option label="全部动作" value="" />
        <el-option
          v-for="(label, key) in ACTION_LABELS"
          :key="key"
          :label="label"
          :value="key"
        />
      </el-select>

      <el-select v-model="filters.targetType" style="width: 150px" placeholder="全部对象">
        <el-option label="全部对象" value="" />
        <el-option
          v-for="(label, key) in TARGET_LABELS"
          :key="key"
          :label="label"
          :value="key"
        />
      </el-select>

      <el-button :icon="Refresh" @click="load()">刷新</el-button>
      <span class="tiny">共 {{ pagination.total }} 条记录</span>
    </section>

    <section class="panel table-panel">
      <el-skeleton v-if="loading && !list.length" :rows="6" animated />

      <EmptyState v-else-if="errorMessage" title="加载失败" :description="errorMessage">
        <el-button type="primary" :icon="Refresh" @click="load()">重新加载</el-button>
      </EmptyState>

      <EmptyState
        v-else-if="!list.length"
        title="还没有操作记录"
        description="管理员在后台的每一次写操作都会记录在这里"
      />

      <template v-else>
        <el-table :data="list" row-key="id" class="admin-table">
          <el-table-column label="时间" width="150">
            <template #default="{ row }">
              <span class="tiny">{{ formatDateTime(row.createdAt) }}</span>
            </template>
          </el-table-column>

          <el-table-column label="管理员" width="140">
            <template #default="{ row }">
              <div class="cell-stack">
                <span>{{ row.admin?.name }}</span>
                <span class="tiny">{{ row.admin?.studentNo }}</span>
              </div>
            </template>
          </el-table-column>

          <el-table-column label="动作" width="130">
            <template #default="{ row }">
              <el-tag size="small" effect="plain">{{ ACTION_LABELS[row.action] || row.action }}</el-tag>
            </template>
          </el-table-column>

          <el-table-column label="对象" width="130">
            <template #default="{ row }">
              <span class="tiny">
                {{ TARGET_LABELS[row.targetType] || row.targetType }}
                <template v-if="row.targetId"> #{{ row.targetId }}</template>
              </span>
            </template>
          </el-table-column>

          <el-table-column label="明细" min-width="260">
            <template #default="{ row }">
              <pre class="detail">{{ formatDetail(row.detail) }}</pre>
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
  </div>
</template>

<style scoped>
.admin-logs {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.filter-panel {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 16px;
  border: 0;
  background: var(--bg-alt);
  border-radius: 18px;
}

.table-panel {
  padding: 16px 18px 12px;
  border: 0;
  background: var(--bg-alt);
  border-radius: 18px;
}

.admin-table {
  --el-table-bg-color: transparent;
  --el-table-tr-bg-color: transparent;
  --el-table-header-bg-color: transparent;
  --el-table-row-hover-bg-color: rgba(255, 255, 255, 0.7);
}

.cell-stack {
  display: flex;
  flex-direction: column;
}

.detail {
  margin: 0;
  max-height: 140px;
  overflow: auto;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.7);
  border-radius: 8px;
  color: var(--text-2);
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;
}

.pager {
  display: flex;
  justify-content: flex-end;
  padding: 12px 10px 0;
}
</style>
