<script setup>
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Refresh } from '@element-plus/icons-vue';

import {
  createAdminCategory,
  deleteAdminCategory,
  listAdminCategories,
  updateAdminCategory,
} from '../../api/admin.js';
import EmptyState from '../../components/EmptyState.vue';

const list = ref([]);
const loading = ref(false);
const errorMessage = ref('');
const acting = ref(false);

const dialog = reactive({ visible: false, mode: 'create', id: null });
const formRef = ref(null);
const form = reactive({ name: '', sortOrder: 0, enabled: true });

const rules = {
  name: [
    { required: true, message: '请输入分类名称', trigger: 'blur' },
    { min: 1, max: 30, message: '分类名称最多 30 个字', trigger: 'blur' },
  ],
  sortOrder: [{ required: true, message: '请输入排序值', trigger: 'blur' }],
};

async function load() {
  loading.value = true;
  errorMessage.value = '';
  try {
    list.value = await listAdminCategories();
  } catch (error) {
    errorMessage.value = error.message;
  } finally {
    loading.value = false;
  }
}

onMounted(load);

function openCreate() {
  dialog.mode = 'create';
  dialog.id = null;
  Object.assign(form, { name: '', sortOrder: (list.value.at(-1)?.sortOrder ?? 0) + 1, enabled: true });
  dialog.visible = true;
}

function openEdit(row) {
  dialog.mode = 'edit';
  dialog.id = row.id;
  Object.assign(form, { name: row.name, sortOrder: row.sortOrder, enabled: row.enabled });
  dialog.visible = true;
}

async function submit() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;

  acting.value = true;
  try {
    if (dialog.mode === 'create') {
      await createAdminCategory({ ...form });
      ElMessage.success('分类已创建');
    } else {
      await updateAdminCategory(dialog.id, { ...form });
      ElMessage.success('分类已更新');
    }
    dialog.visible = false;
    await load();
  } catch {
    // 拦截器已提示
  } finally {
    acting.value = false;
  }
}

async function toggleEnabled(row) {
  try {
    await updateAdminCategory(row.id, { enabled: row.enabled });
    ElMessage.success(row.enabled ? '已启用' : '已停用');
  } catch {
    // 失败时把开关恢复原状
    row.enabled = !row.enabled;
  }
}

async function remove(row) {
  try {
    await ElMessageBox.confirm(
      `确定删除分类「${row.name}」吗？该分类下还有 ${row._count.items} 条帖子。`,
      '删除分类',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' },
    );
  } catch {
    return;
  }

  acting.value = true;
  try {
    await deleteAdminCategory(row.id);
    ElMessage.success('分类已删除');
    await load();
  } catch {
    // 分类下有帖子时后端会返回 409，提示已由拦截器弹出
  } finally {
    acting.value = false;
  }
}
</script>

<template>
  <div class="admin-categories">
    <section class="panel toolbar">
      <div>
        <h2 class="panel-title">分类管理</h2>
        <p class="tiny">停用后的分类不会出现在发布页，但历史帖子仍保留原分类。</p>
      </div>
      <div class="toolbar-actions">
        <el-button :icon="Refresh" @click="load">刷新</el-button>
        <el-button type="primary" :icon="Plus" @click="openCreate">新建分类</el-button>
      </div>
    </section>

    <section class="panel table-panel">
      <el-skeleton v-if="loading" :rows="5" animated />

      <EmptyState v-else-if="errorMessage" title="加载失败" :description="errorMessage">
        <el-button type="primary" :icon="Refresh" @click="load">重新加载</el-button>
      </EmptyState>

      <el-table v-else :data="list" row-key="id" class="admin-table">
        <el-table-column label="排序" width="80" prop="sortOrder" align="center" />
        <el-table-column label="分类名称" min-width="160" prop="name" />

        <el-table-column label="帖子数" width="100" align="center">
          <template #default="{ row }">{{ row._count.items }}</template>
        </el-table-column>

        <el-table-column label="启用" width="100" align="center">
          <template #default="{ row }">
            <el-switch v-model="row.enabled" @change="toggleEnabled(row)" />
          </template>
        </el-table-column>

        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button size="small" text @click="openEdit(row)">编辑</el-button>
            <el-button size="small" text type="danger" :loading="acting" @click="remove(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <el-dialog
      v-model="dialog.visible"
      :title="dialog.mode === 'create' ? '新建分类' : '编辑分类'"
      width="400px"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-form-item label="分类名称" prop="name">
          <el-input v-model="form.name" maxlength="30" show-word-limit placeholder="例如：电子产品" />
        </el-form-item>
        <el-form-item label="排序（数字越小越靠前）" prop="sortOrder">
          <el-input-number v-model="form.sortOrder" :min="0" :max="9999" style="width: 100%" />
        </el-form-item>
        <el-form-item label="是否启用">
          <el-switch v-model="form.enabled" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="acting" @click="submit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.admin-categories {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 20px 22px;
  border: 0;
  background: var(--bg-alt);
  border-radius: 18px;
}

.panel-title {
  font-size: 19px;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.tiny {
  margin: 4px 0 0;
}

.toolbar-actions {
  display: flex;
  gap: 8px;
}

.toolbar-actions :deep(.el-button + .el-button) {
  margin-left: 0;
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
</style>
