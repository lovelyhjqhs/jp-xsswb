<script setup>
import { reactive, ref } from 'vue';
import { Lock, UserFilled } from '@element-plus/icons-vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { useAdminAuthStore } from '../stores/adminAuth.js';

const route = useRoute(); const router = useRouter(); const auth = useAdminAuthStore(); const form = reactive({ username: '', password: '' }); const submitting = ref(false); const errorMessage = ref('');
async function submit() { if (!form.username.trim() || !form.password) { errorMessage.value = '请输入管理员账号和密码'; return; } submitting.value = true; errorMessage.value = ''; try { await auth.login({ studentNo: form.username.trim(), password: form.password }); ElMessage.success('登录成功'); const redirect = route.query.redirect; router.replace(typeof redirect === 'string' && redirect.startsWith('/admin') ? redirect : '/admin'); } catch (error) { errorMessage.value = error.message || '账号或密码错误'; } finally { submitting.value = false; } }
</script>

<template>
  <div class="page admin-login-page">
    <section class="admin-login-panel">
      <p class="eyebrow">管理员</p>
      <h1>登录管理后台</h1>
      <p class="intro">仅限部门管理员使用，游客无需登录即可浏览网站。</p>
      <el-form label-position="top" @submit.prevent="submit">
        <el-form-item label="管理员账号" required>
          <el-input v-model="form.username" size="large" :prefix-icon="UserFilled" autocomplete="username" placeholder="请输入账号" />
        </el-form-item>
        <el-form-item label="密码" required>
          <el-input v-model="form.password" size="large" type="password" show-password :prefix-icon="Lock" autocomplete="current-password" placeholder="请输入密码" @keyup.enter="submit" />
        </el-form-item>
        <el-alert v-if="errorMessage" type="error" :closable="false" :title="errorMessage" />
        <el-button class="submit-button" type="primary" size="large" :loading="submitting" @click="submit">登录</el-button>
      </el-form>
    </section>
  </div>
</template>

<style scoped>
.admin-login-page {
  display: grid;
  max-width: none;
  min-height: 100vh;
  place-items: center;
  margin: 0;
  padding: 40px 24px;
  background: #f5f5f7;
}

.admin-login-panel {
  width: 100%;
  max-width: 420px;
  padding: 42px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 24px;
  background: #fff;
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.07);
}

.eyebrow {
  margin: 0 0 10px;
  color: #0066cc;
  font-size: 12px;
  font-weight: 500;
}

.admin-login-panel h1 {
  font-size: 36px;
  font-weight: 600;
  letter-spacing: -0.045em;
  line-height: 1.06;
}

.intro {
  margin: 12px 0 28px;
  color: var(--text-2);
  font-size: 15px;
  line-height: 1.5;
}

.submit-button {
  width: 100%;
  margin-top: 8px;
}

@media (max-width: 560px) {
  .admin-login-panel { padding: 30px; border-radius: 28px; }
}
</style>
