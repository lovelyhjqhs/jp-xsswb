<script setup>
import { computed } from 'vue';

const props = defineProps({
  /** [{ date: '2026-10-01', count: 3 }, ...] */
  points: { type: Array, default: () => [] },
  height: { type: Number, default: 180 },
});

// 用 SVG 手绘折线图：不引入任何图表库（echarts 一个包就 1MB+），
// 这里只需要「一条线 + 网格 + 坐标」，原生 SVG 足够。
const WIDTH = 720;
const PADDING = { top: 16, right: 16, bottom: 26, left: 32 };

const innerWidth = WIDTH - PADDING.left - PADDING.right;
const innerHeight = computed(() => props.height - PADDING.top - PADDING.bottom);

const maxValue = computed(() => Math.max(1, ...props.points.map((point) => point.count)));

const coords = computed(() => {
  const total = props.points.length;
  return props.points.map((point, index) => ({
    ...point,
    x: PADDING.left + (total <= 1 ? 0 : (index / (total - 1)) * innerWidth),
    y: PADDING.top + innerHeight.value - (point.count / maxValue.value) * innerHeight.value,
  }));
});

const linePath = computed(() =>
  coords.value
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(' '),
);

const areaPath = computed(() => {
  if (!coords.value.length) return '';
  const baseline = PADDING.top + innerHeight.value;
  const first = coords.value[0];
  const last = coords.value[coords.value.length - 1];
  return `${linePath.value} L${last.x.toFixed(1)},${baseline} L${first.x.toFixed(1)},${baseline} Z`;
});

const yTicks = computed(() => {
  const max = maxValue.value;
  return max <= 2 ? [0, max] : [0, Math.ceil(max / 2), max];
});

const xTicks = computed(() =>
  coords.value.filter((_, index) => index % 5 === 0 || index === coords.value.length - 1),
);

const totalCount = computed(() => props.points.reduce((sum, point) => sum + point.count, 0));
</script>

<template>
  <div class="trend-wrap">
    <div class="trend-head">
      <span class="tiny">近 {{ points.length }} 天共发布 {{ totalCount }} 条</span>
      <span class="tiny">峰值 {{ maxValue }} 条/天</span>
    </div>

    <svg
      class="trend"
      :viewBox="`0 0 ${WIDTH} ${height}`"
      role="img"
      aria-label="发布趋势折线图"
    >
      <defs>
        <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0071e3" stop-opacity="0.16" />
          <stop offset="100%" stop-color="#0071e3" stop-opacity="0" />
        </linearGradient>
      </defs>

      <!-- 横向网格 + Y 轴刻度 -->
      <g>
        <template v-for="tick in yTicks" :key="tick">
          <line
            :x1="PADDING.left"
            :x2="WIDTH - PADDING.right"
            :y1="PADDING.top + innerHeight - (tick / maxValue) * innerHeight"
            :y2="PADDING.top + innerHeight - (tick / maxValue) * innerHeight"
            stroke="#e3e3e8"
            stroke-width="1"
          />
          <text
            :x="PADDING.left - 8"
            :y="PADDING.top + innerHeight - (tick / maxValue) * innerHeight + 4"
            text-anchor="end"
            class="axis"
          >
            {{ tick }}
          </text>
        </template>
      </g>

      <path :d="areaPath" fill="url(#trendFill)" />
      <path :d="linePath" fill="none" stroke="#0071e3" stroke-width="2" stroke-linejoin="round" />

      <circle
        v-for="point in coords"
        :key="point.date"
        :cx="point.x"
        :cy="point.y"
        r="2.4"
        fill="#ffffff"
        stroke="#0071e3"
        stroke-width="1.6"
      >
        <title>{{ point.date }}：{{ point.count }} 条</title>
      </circle>

      <text
        v-for="point in xTicks"
        :key="`x-${point.date}`"
        :x="point.x"
        :y="height - 8"
        text-anchor="middle"
        class="axis"
      >
        {{ point.date.slice(5) }}
      </text>
    </svg>
  </div>
</template>

<style scoped>
.trend-wrap {
  width: 100%;
}

.trend-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 6px;
}

.trend {
  display: block;
  width: 100%;
  height: auto;
}

.axis {
  font-size: 11px;
  fill: #86868b;
  font-family: var(--font-sans);
}
</style>
