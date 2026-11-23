<script setup>
import { computed, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import {
  submitCanteenFeedback,
  submitLostFoundInquiry,
  submitLostFoundItem,
  submitMailboxMessage,
} from '../../api/public.js';

const route = useRoute();
const router = useRouter();
const submitting = ref(false);
const errorMessage = ref('');
const receipt = ref(null);
const attachments = ref([]);
const lastPayload = ref(null);
const idempotencyKey = ref('');

const kind = computed(() => {
  if (route.path.startsWith('/canteen')) return 'canteen';
  if (route.path.startsWith('/lost-found/inquiry')) return 'inquiry';
  if (route.path.startsWith('/lost-found')) return 'lost';
  return 'mailbox';
});

const isFound = computed(() => route.path.endsWith('/found'));
const title = computed(() => ({
  canteen: '提交食堂意见',
  lost: isFound.value ? '拾物登记' : '报失登记',
  inquiry: '提交招领线索',
  mailbox: '写信给学生事务部',
}[kind.value]));

const form = reactive({
  submitMode: 'anonymous',
  className: '',
  name: '',
  contactType: '',
  contactValue: '',
  content: '',
  subject: '',
  categoryId: '',
  publicAllowed: false,
  area: '',
  type: isFound.value ? 'found' : 'lost',
  title: '',
  features: '',
  location: '',
  happenedAt: '',
  itemNo: '',
  website: '',
});

const needsIdentity = computed(() => form.submitMode === 'signed' && kind.value !== 'inquiry');
const isMailbox = computed(() => kind.value === 'mailbox');
const isLost = computed(() => kind.value === 'lost');
const maxAttachments = 3;
const maxAttachmentBytes = 5 * 1024 * 1024;
const allowedAttachmentTypes = ['image/jpeg', 'image/png', 'image/webp'];

function validate() {
  if (form.website.trim()) return '提交失败，请稍后重试';
  if (kind.value === 'inquiry' && !/^\d+$/.test(String(route.query.itemId || ''))) return '请从具体失物记录进入招领线索表单';
  if (needsIdentity.value && (!form.className.trim() || !form.name.trim())) return '署名提交需要填写班级和姓名';
  if (form.contactValue.trim() && !form.contactType) return '请选择联系方式类型';
  if (isMailbox.value && (!form.subject.trim() || !form.content.trim())) return '请填写主题和内容';
  if (kind.value === 'canteen' && !form.content.trim()) return '请填写意见内容';
  if (kind.value === 'inquiry' && !form.content.trim()) return '请填写留言内容';
  if (isLost.value && (!form.title.trim() || !form.area || !form.features.trim() || !form.location.trim() || !form.happenedAt)) {
    return '请填写物品名称、区域、物品特征、地点和时间';
  }
  if (form.content.trim().length > 2000) return '内容不能超过 2000 个字';
  if (form.subject.trim().length > 160) return '主题不能超过 160 个字';
  return '';
}

function onFilesSelected(event) {
  const selected = Array.from(event.target.files || []);
  event.target.value = '';
  if (selected.length + attachments.value.length > maxAttachments) {
    errorMessage.value = `最多上传 ${maxAttachments} 个附件`;
    return;
  }
  const invalid = selected.find((file) => !allowedAttachmentTypes.includes(file.type));
  if (invalid) {
    errorMessage.value = '附件仅支持 JPG、PNG 或 WebP 图片格式';
    return;
  }
  const tooLarge = selected.find((file) => file.size > maxAttachmentBytes);
  if (tooLarge) {
    errorMessage.value = '单个附件不能超过 5MB';
    return;
  }
  errorMessage.value = '';
  attachments.value.push(...selected);
}

function removeAttachment(index) {
  attachments.value.splice(index, 1);
}

function buildPayload() {
  const payload = {
    ...form,
    submitMode: kind.value === 'inquiry' ? 'anonymous' : form.submitMode,
    content: form.content.trim(),
    className: form.className.trim() || undefined,
    name: form.name.trim() || undefined,
    contactType: form.contactType || undefined,
    contactValue: form.contactValue.trim() || undefined,
    subject: form.subject.trim() || undefined,
    categoryId: form.categoryId || undefined,
    attachments: attachments.value,
    idempotencyKey: idempotencyKey.value,
  };
  if (kind.value === 'inquiry') payload.message = payload.content;
  if (isLost.value) payload.description = payload.content || payload.features;
  return payload;
}

async function submit() {
  errorMessage.value = validate();
  if (errorMessage.value) return;
  submitting.value = true;
  errorMessage.value = '';
  if (!idempotencyKey.value) idempotencyKey.value = `guest-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  const payload = buildPayload();
  lastPayload.value = payload;
  try {
    let data;
    if (kind.value === 'canteen') data = await submitCanteenFeedback(payload);
    else if (kind.value === 'mailbox') data = await submitMailboxMessage(payload);
    else if (kind.value === 'inquiry') data = await submitLostFoundInquiry(route.query.itemId, payload);
    else data = await submitLostFoundItem(payload);
    receipt.value = data;
    ElMessage.success('提交成功，请保存查询凭证');
  } catch (error) {
    errorMessage.value = error.message || '提交失败，请稍后重试';
  } finally {
    submitting.value = false;
  }
}

function retry() {
  if (lastPayload.value) submit();
}
</script>

<template>
  <div class="page form-page">
    <header class="page-heading">
      <h1>{{ title }}</h1>
      <p>无需注册或登录，提交后会获得查询编号和一次性查询凭证。</p>
    </header>

    <section v-if="receipt" class="receipt-panel" aria-live="polite">
      <div class="success-mark" aria-hidden="true">✓</div>
      <h2>提交成功</h2>
      <p>当前状态：待审核。请立即保存下面的查询信息。</p>
      <dl>
        <div><dt>查询编号</dt><dd>{{ receipt.queryNo }}</dd></div>
        <div><dt>查询凭证</dt><dd>{{ receipt.queryCredential || receipt.secret }}</dd></div>
      </dl>
      <el-alert title="查询凭证只展示一次，离开此页面后无法找回。" type="warning" :closable="false" />
      <div class="receipt-actions">
        <el-button type="primary" @click="router.push('/mailbox/query')">查询处理状态</el-button>
        <el-button @click="router.push('/')">返回首页</el-button>
      </div>
    </section>

    <section v-else class="form-panel">
      <el-form label-position="top" @submit.prevent="submit">
        <el-form-item v-if="kind !== 'inquiry'" label="提交方式" required>
          <el-radio-group v-model="form.submitMode" aria-label="提交方式">
            <el-radio value="anonymous">匿名提交</el-radio>
            <el-radio value="signed">署名提交</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-alert class="privacy-alert" title="匿名投稿不要求姓名和班级；署名资料仅供管理员处理，不会出现在公开页面。" type="info" :closable="false" />

        <div v-if="needsIdentity" class="form-grid">
          <el-form-item label="班级" required><el-input v-model="form.className" maxlength="80" autocomplete="off" /></el-form-item>
          <el-form-item label="姓名" required><el-input v-model="form.name" maxlength="80" autocomplete="off" /></el-form-item>
        </div>

        <el-form-item v-if="isMailbox" label="主题" required><el-input v-model="form.subject" maxlength="160" show-word-limit /></el-form-item>

        <el-form-item v-if="isLost" label="物品名称" required><el-input v-model="form.title" maxlength="60" /></el-form-item>
        <div v-if="isLost" class="form-grid">
          <el-form-item label="区域" required>
            <el-select v-model="form.area" placeholder="选择区域">
              <el-option label="A 区" value="A" /><el-option label="B 区" value="B" /><el-option label="D 区" value="D" />
            </el-select>
          </el-form-item>
          <el-form-item label="发生时间" required>
            <el-date-picker v-model="form.happenedAt" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" />
          </el-form-item>
        </div>
        <el-form-item v-if="isLost" label="地点" required><el-input v-model="form.location" maxlength="160" /></el-form-item>
        <el-form-item v-if="isLost" label="物品特征" required><el-input v-model="form.features" type="textarea" :rows="4" maxlength="1000" show-word-limit /></el-form-item>

        <div class="form-grid">
          <el-form-item label="联系方式类型">
            <el-select v-model="form.contactType" clearable placeholder="可选">
              <el-option label="手机号" value="phone" /><el-option label="微信" value="wechat" /><el-option label="QQ" value="qq" /><el-option label="其他" value="other" />
            </el-select>
          </el-form-item>
          <el-form-item label="联系方式"><el-input v-model="form.contactValue" maxlength="160" autocomplete="off" placeholder="可选" /></el-form-item>
        </div>

        <el-form-item label="内容" required><el-input v-model="form.content" type="textarea" :rows="6" maxlength="2000" show-word-limit placeholder="请尽量具体描述" /></el-form-item>

        <el-form-item v-if="isMailbox" label="公开意愿">
          <el-checkbox v-model="form.publicAllowed">允许审核通过后公开内容</el-checkbox>
          <p class="field-tip">勾选不代表立即公开，仍需管理员审核；署名资料永不公开。</p>
        </el-form-item>

        <el-form-item label="附件（可选）">
          <input class="file-input" type="file" accept="image/jpeg,image/png,image/webp" multiple aria-describedby="attachment-help" @change="onFilesSelected" />
          <p id="attachment-help" class="field-tip">最多 3 个，每个不超过 5MB，支持 JPG、PNG、WebP 图片。</p>
          <ul v-if="attachments.length" class="attachment-list">
            <li v-for="(file, index) in attachments" :key="`${file.name}-${file.lastModified}`">
              <span>{{ file.name }}</span>
              <el-button text type="danger" @click="removeAttachment(index)">移除</el-button>
            </li>
          </ul>
        </el-form-item>

        <div class="honeypot" aria-hidden="true"><label for="website">网站</label><input id="website" v-model="form.website" tabindex="-1" autocomplete="off" /></div>
        <el-alert v-if="errorMessage" class="form-error" type="error" :closable="false" :title="errorMessage" />
        <div class="form-actions">
          <el-button @click="router.back()">取消</el-button>
          <el-button type="primary" :loading="submitting" @click="submit">提交</el-button>
          <el-button v-if="errorMessage && lastPayload" type="warning" :disabled="submitting" @click="retry">再次提交</el-button>
        </div>
      </el-form>
    </section>
  </div>
</template>

<style scoped>
.form-page { max-width: 760px; }

.page-heading { padding: 38px 0 40px; }
.page-heading h1 { font-size: clamp(40px, 5.2vw, 60px); font-weight: 600; letter-spacing: -0.045em; line-height: 1.02; }
.page-heading p { margin: 16px 0 0; max-width: 590px; color: var(--text-2); font-size: 17px; line-height: 1.55; }

.form-panel,
.receipt-panel { padding: 38px; border: 1px solid rgba(0, 0, 0, 0.06); border-radius: 24px; background: #f5f5f7; }

.privacy-alert { margin: 2px 0 24px; }
.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 16px; }
.form-error { margin-top: 4px; }
.field-tip { display: block; width: 100%; margin: 6px 0 0; color: var(--text-3); font-size: 12px; line-height: 1.5; }
.file-input { display: block; max-width: 100%; padding: 4px 0; color: var(--text-2); font-size: 14px; }
.file-input::file-selector-button {
  margin-right: 12px;
  padding: 8px 18px;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  background: #fff;
  color: var(--text);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.attachment-list { display: grid; gap: 6px; width: 100%; margin: 10px 0 0; padding: 0; list-style: none; }
.attachment-list li { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 14px; border-radius: 12px; background: #fff; font-size: 13px; }
.attachment-list span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.form-actions,
.receipt-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px; }
.form-actions :deep(.el-button + .el-button),
.receipt-actions :deep(.el-button + .el-button) { margin-left: 0; }

.receipt-panel { text-align: center; }
.success-mark {
  display: inline-grid;
  place-items: center;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: #e9f7ee;
  color: var(--success);
  font-size: 30px;
  font-weight: 700;
}
.receipt-panel h2 { margin: 18px 0 8px; font-size: 26px; letter-spacing: -0.02em; }
.receipt-panel p { margin: 0; color: var(--text-2); font-size: 15px; }
.receipt-panel dl { display: grid; gap: 12px; max-width: 440px; margin: 24px auto; padding: 24px; border-radius: 20px; background: #fff; text-align: left; }
.receipt-panel dl div { display: grid; grid-template-columns: 90px minmax(0, 1fr); gap: 8px; font-size: 15px; }
.receipt-panel dt { color: var(--text-3); }
.receipt-panel dd { margin: 0; word-break: break-all; font-weight: 600; }
.receipt-panel :deep(.el-alert) { max-width: 440px; margin: 0 auto; text-align: left; }

.honeypot { position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden; }

@media (max-width: 560px) {
  .page-heading { padding-top: 30px; }
  .page-heading h1 { font-size: 40px; }
  .form-grid { grid-template-columns: 1fr; }
  .form-panel,
  .receipt-panel { padding: 24px; }
  .form-actions,
  .receipt-actions { flex-wrap: wrap; justify-content: stretch; }
  .form-actions .el-button,
  .receipt-actions .el-button { flex: 1 1 140px; }
}
</style>
