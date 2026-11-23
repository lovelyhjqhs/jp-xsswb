<script setup>
import { onMounted, reactive, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Refresh } from '@element-plus/icons-vue';

import { handleAdminReport, listAdminReports } from '../../api/admin.js';
import EmptyState from '../../components/EmptyState.vue';
import { formatDateTime, statusClass, statusText } from '../../utils/format.js';

const filters = reactive({ status: 'pending' });
const list = ref([]);
const pagination = ref({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
const loading = ref(false);
const errorMessage = ref('');
const acting = ref(false);

async function load(page = pagination.value.page) {
  loading.value = true;
  errorMessage.value = '';
  try {
    const params = { page, pageSize: pagination.value.pageSize };
    if (filters.status) params.status = filters.status;

    const data = await listAdminReports(params);
    list.value = data.list;
    pagination.value = data.pagination;
  } catch (error) {
    errorMessage.value = error.message;
  } finally {
    loading.value = false;
  }
}

watch(
  () => filters.status,
  () => load(1),
);

onMounted(() => load(1));

async function handle(row, action) {
  const isOffline = action === 'offline';
  try {
    await ElMessageBox.confirm(
      isOffline
        ? `将下架帖子「${row.item.title}」，并把这条例举标记为已处理。确定吗？`
        : '忽略后该举报会被标记为已处理，帖子保持原状。确定吗？',
      isOffline ? '下架帖子' : '忽略举报',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: isOffline ? 'warning' : 'info' },
    );
  } catch {
    return;
  }

  acting.value = true;
  try {
    await handleAdminReport(row.id, { action });
    ElMessage.success(isOffline ? '已下架该帖子' : '已忽略该举报');
    await load();
  } catch {
    // 拦截器已提示
  } finally {
    acting.value = false;
  }
}
</script>

<template>
  <div class="admin-reports">
    <section class="panel filter-panel">
      <el-select v-model="filters.status" style="width: 150px">
        <el-option label="待处理" value="pending" />
        <el-option label="已处理" value="handled" />
        <el-option label="全部" value="" />
      </el-select>
      <el-button :icon="Refresh" @click="load()">刷新</el-button>
      <span class="tiny">共 {{ pagination.total }} 条</span>
    </section>

    <section class="panel table-panel">
      <el-skeleton v-if="loading && !list.length" :rows="5" animated />

      <EmptyState v-else-if="errorMessage" title="加载失败" :description="errorMessage">
        <el-button type="primary" :icon="Refresh" @click="load()">重新加载</el-button>
      </EmptyState>

      <EmptyState
        v-else-if="!list.length"
        :title="filters.status === 'pending' ? '没有待处理的举报' : '没有举报记录'"
        description="有同学举报时，这里会出现待处理项"
      />

      <el-table v-else :data="list" row-key="id" class="admin-table">
        <el-table-column label="被举报帖子" min-width="240">
          <template #default="{ row }">
            <div class="cell-stack">
              <a class="item-link" :href="`/items/${row.item.id}`" target="_blank" rel="noopener">
                {{ row.item.title }}
              </a>
              <div class="cell-meta">
                <span class="tag" :class="statusClass(row.item.status)">
                  {{ statusText(row.item.status) }}
                </span>
                <span class="tiny">ID {{ row.item.id }}</span>
                <span class="tiny">作者 {{ row.item.user?.name }}({{ row.item.user?.studentNo }})</span>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="举报理由" min-width="180">
          <template #default="{ row }">
            <span class="reason">{{ row.reason }}</span>
          </template>
        </el-table-column>

        <el-table-column label="举报人" width="150">
          <template #default="{ row }">
            <div class="cell-stack">
              <span>{{ row.reporter?.name }}</span>
              <span class="tiny">{{ row.reporter?.studentNo }}</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="时间" width="150">
          <template #default="{ row }">
            <span class="tiny">{{ formatDateTime(row.createdAt) }}</span>
          </template>
        </el-table-column>

        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <span class="tag" :class="row.status === 'handled' ? 'tag-resolved' : 'tag-pending'">
              {{ row.status === 'handled' ? '已处理' : '待处理' }}
            </span>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <div v-if="row.status === 'pending'" class="row-actions">
              <el-button size="small" type="danger" plain :loading="acting" @click="handle(row, 'offline')">
                下架帖子
              </el-button>
              <el-button size="small" :loading="acting" @click="handle(row, 'ignore')">忽略</el-button>
            </div>
            <span v-else class="tiny">
              由 {{ row.handler?.name || '—' }} 处理
            </span>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="list.length" class="pager">
        <el-pagination
          layout="total, prev, pager, next"
          :current-page="pagination.page"
          :page-size="pagination.pageSize"
          :total="pagination.total"
          background
          @current-change="load"
        />
      </div>
    </section>
  </div>
</template>

<style scoped>
.admin-reports {
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
  gap: 3px;
}

.cell-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.item-link {
  font-weight: 600;
  color: var(--text);
}

.item-link:hover {
  color: var(--brand);
}

.reason {
  color: var(--text-2);
  font-size: 13px;
}

.row-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.row-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}

.pager {
  display: flex;
  justify-content: flex-end;
  padding: 12px 10px 0;
}
</style>
