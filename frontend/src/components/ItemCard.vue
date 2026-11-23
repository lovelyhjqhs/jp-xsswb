<script setup>
import { computed } from 'vue';
import { Clock, Location, Picture } from '@element-plus/icons-vue';

import { relativeTime, typeClass, typeShort } from '../utils/format.js';

const props = defineProps({
  item: { type: Object, required: true },
});

defineEmits(['open']);

const cover = computed(() => props.item.images?.[0]?.url || '');
const isResolved = computed(() => props.item.status === 'resolved');
</script>

<template>
  <article class="item-card" role="button" tabindex="0" @click="$emit('open')" @keyup.enter="$emit('open')">
    <div class="cover">
      <img v-if="cover" :src="cover" :alt="item.title" loading="lazy" />
      <div v-else class="cover-empty">
        <el-icon :size="26"><Picture /></el-icon>
        <span>暂无图片</span>
      </div>

      <span class="tag cover-tag" :class="typeClass(item.type)">{{ typeShort(item.type) }}</span>
      <span v-if="isResolved" class="resolved-mask">已找回</span>
    </div>

    <div class="body">
      <h3 class="title clamp-2">{{ item.title }}</h3>

      <p class="meta">
        <el-icon><Location /></el-icon>
        <span class="ellipsis">{{ item.location }}</span>
      </p>
      <p class="meta">
        <el-icon><Clock /></el-icon>
        <span>{{ relativeTime(item.createdAt) }}</span>
        <span class="dot">·</span>
        <span class="ellipsis">{{ item.category?.name || '未分类' }}</span>
      </p>
    </div>
  </article>
</template>

<style scoped>
.item-card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 26px;
  cursor: pointer;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.02);
  transition: transform 0.3s var(--ease), box-shadow 0.3s var(--ease), border-color 0.3s var(--ease);
}

.item-card:hover {
  border-color: rgba(0, 0, 0, 0.1);
  transform: translateY(-4px);
  box-shadow: 0 22px 52px rgba(0, 0, 0, 0.09);
}

.item-card:active {
  transform: scale(0.995);
}

.cover {
  position: relative;
  aspect-ratio: 1.18;
  background: #f0f0f2;
  overflow: hidden;
}

.cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.5s var(--ease);
}

.item-card:hover .cover img {
  transform: scale(1.03);
}

.cover-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 100%;
  color: var(--text-3);
  font-size: 12px;
}

.cover-tag {
  position: absolute;
  top: 14px;
  left: 14px;
  background: rgba(255, 255, 255, 0.8);
  -webkit-backdrop-filter: saturate(180%) blur(16px);
  backdrop-filter: saturate(180%) blur(16px);
}

.resolved-mask {
  position: absolute;
  top: 14px;
  right: 14px;
  padding: 0 10px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.8);
  -webkit-backdrop-filter: saturate(180%) blur(16px);
  backdrop-filter: saturate(180%) blur(16px);
  color: var(--success);
  font-size: 12px;
  font-weight: 500;
}

.body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 20px 20px 22px;
}

.title {
  font-size: 19px;
  font-weight: 600;
  line-height: 1.35;
  letter-spacing: -0.01em;
  color: var(--text);
}

.meta {
  display: flex;
  align-items: center;
  gap: 5px;
  margin: 0;
  color: var(--text-3);
  font-size: 12px;
  min-width: 0;
}

.meta .el-icon {
  flex: 0 0 auto;
  font-size: 13px;
}

.dot {
  flex: 0 0 auto;
}

@media (min-width: 768px) {
  .title {
    font-size: 20px;
  }
}
</style>
