<script setup>
import { Box } from '@element-plus/icons-vue';

defineProps({
  title: { type: String, default: '暂时还没有内容' },
  description: { type: String, default: '' },
  icon: { type: [Object, Function], default: null },
});
</script>

<template>
  <div class="empty-state">
    <div class="icon-wrap">
      <el-icon :size="28"><component :is="icon || Box" /></el-icon>
    </div>
    <p class="title">{{ title }}</p>
    <p v-if="description" class="desc">{{ description }}</p>
    <div class="actions">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 9px;
  padding: 80px 20px;
  text-align: center;
}

.icon-wrap {
  display: grid;
  place-items: center;
  width: 66px;
  height: 66px;
  border: 1px solid rgba(0, 0, 0, 0.05);
  border-radius: 50%;
  background:
    radial-gradient(circle at 35% 25%, #fff, transparent 45%),
    var(--bg-alt);
  color: var(--text-3);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.04);
}

.title {
  margin: 12px 0 0;
  font-size: 19px;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.desc {
  margin: 0;
  max-width: 340px;
  color: var(--text-2);
  font-size: 13px;
  line-height: 1.6;
}

.actions {
  margin-top: 12px;
}
</style>
