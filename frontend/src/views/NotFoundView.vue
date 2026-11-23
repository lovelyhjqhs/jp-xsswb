<script setup>
import { useRouter } from 'vue-router';

const router = useRouter();
</script>

<template>
  <div class="page notfound-page">
    <div class="notfound-content">
      <p class="code">404</p>
      <h1>页面走丢了</h1>
      <p class="muted">你访问的页面不存在，或者链接已经失效。</p>
      <div class="actions">
        <el-button type="primary" size="large" @click="router.push('/')">回到首页</el-button>
        <el-button size="large" @click="router.back()">返回上一页</el-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.notfound-page {
  display: grid;
  place-items: center;
  min-height: 60vh;
  text-align: center;
}

.notfound-content {
  max-width: 460px;
}

.code {
  margin: 0;
  font-size: clamp(80px, 14vw, 128px);
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.04em;
  background: linear-gradient(180deg, #1d1d1f 0%, #86868b 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.notfound-content h1 {
  margin: 20px 0 10px;
  font-size: 28px;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.notfound-content .muted {
  margin: 0;
  font-size: 17px;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  margin-top: 28px;
}

.actions :deep(.el-button + .el-button) {
  margin-left: 0;
}
</style>
