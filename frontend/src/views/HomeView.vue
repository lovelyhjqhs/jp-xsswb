<script setup>
import { computed, onMounted, ref } from 'vue';
import {
  ArrowRight,
  ChatDotRound,
  Compass,
  Food,
  Promotion,
  Search,
} from '@element-plus/icons-vue';
import { useRouter } from 'vue-router';

import { getPublicProfile } from '../api/public.js';

const router = useRouter();
const profile = ref(null);

const profileTitle = computed(() => profile.value?.title || '学生事务部');
const heroIntro = '连接同学与校园服务，及时回应每一份关切。让每一次寻找、提问和建议，都有一个清晰的入口。';

const services = [
  {
    to: '/lost-found',
    title: '失物招领',
    copy: '检索公开记录，快速报失或登记拾物。',
    meta: '公开检索 · 快速登记',
    preview: 'search',
    icon: Search,
    tone: 'light',
    size: 'wide',
  },
  {
    to: '/mailbox',
    title: '学生信箱',
    copy: '匿名或署名，让你的声音被认真听见。',
    meta: '匿名 · 署名 · 可追踪',
    preview: 'message',
    icon: ChatDotRound,
    tone: 'dark',
    size: 'standard',
  },
  {
    to: '/news',
    title: '工作动态',
    copy: '记录活动、共建与持续服务的每一步。',
    meta: '活动与服务进展',
    preview: 'stories',
    icon: Promotion,
    tone: 'light',
    size: 'third',
  },
  {
    to: '/canteen',
    title: '食堂面对面',
    copy: '查看问卷汇总、现场反馈与改进进展。',
    meta: '月度问卷与反馈',
    preview: 'report',
    icon: Food,
    tone: 'light',
    size: 'third',
  },
  {
    to: '/about',
    title: '部门概况',
    copy: '了解我们是谁，以及如何为同学服务。',
    meta: '沿革 · 组织 · 服务',
    preview: 'profile',
    icon: Compass,
    tone: 'light',
    size: 'third',
  },
];

async function load() {
  try {
    profile.value = await getPublicProfile();
  } catch {
    profile.value = null;
  }
}

onMounted(load);
</script>

<template>
  <div class="home">
    <section class="hero" aria-labelledby="home-title">
      <div class="hero-inner">
        <div class="hero-copy">
          <p class="hero-eyebrow">
            <span class="eyebrow-dot" aria-hidden="true"></span>
            {{ profileTitle }} · CAMPUS SERVICES
          </p>
          <h1 id="home-title">校园服务，<br /><span>从此更简单。</span></h1>
          <p class="hero-intro">{{ heroIntro }}</p>

          <div class="hero-actions">
            <button class="button button-primary" type="button" @click="router.push('/lost-found')">
              检索失物
              <el-icon><ArrowRight /></el-icon>
            </button>
            <button class="button button-ghost" type="button" @click="router.push('/mailbox')">
              写信给我们 <span aria-hidden="true">›</span>
            </button>
          </div>

          <div class="hero-notes" aria-label="服务特点">
            <span>无需注册浏览</span>
            <span>公开进度可查</span>
            <span>隐私信息保护</span>
          </div>
        </div>

        <div class="hero-stage" aria-hidden="true">
          <div class="stage-glow stage-glow-blue"></div>
          <div class="stage-glow stage-glow-warm"></div>

          <div class="stage-window">
            <div class="stage-toolbar">
              <span class="stage-app-mark">事</span>
              <span>今日服务</span>
              <span class="stage-live"><i></i> 在线</span>
            </div>

            <div class="stage-primary">
              <span class="stage-icon"><Search /></span>
              <div>
                <small>失物招领</small>
                <strong>找到你丢失的校园卡</strong>
              </div>
              <span class="stage-arrow">↗</span>
            </div>

            <div class="stage-grid">
              <div class="stage-tile stage-tile-blue">
                <span class="tile-kicker">学生信箱</span>
                <span class="tile-value">24h</span>
                <span class="tile-caption">持续收集你的声音</span>
              </div>
              <div class="stage-tile stage-tile-warm">
                <span class="tile-kicker">食堂面对面</span>
                <span class="tile-orbit"></span>
                <span class="tile-caption">本月反馈已整理</span>
              </div>
            </div>

            <div class="stage-progress">
              <span>校园服务状态</span>
              <span class="progress-track"><i></i></span>
              <strong>一切正常</strong>
            </div>
          </div>

          <div class="floating-card floating-card-a">
            <span class="float-check">✓</span>
            <span><small>已回应</small>你的每一条建议</span>
          </div>
          <div class="floating-card floating-card-b">
            <span class="float-pulse"></span>
            <span><small>实时更新</small>动态与月报</span>
          </div>
        </div>
      </div>

      <div class="hero-rail">
        <span>服务同学</span>
        <span>连接校园</span>
        <span>认真回应</span>
        <span class="rail-line" aria-hidden="true"></span>
        <span class="rail-hint">向下探索</span>
      </div>
    </section>

    <section class="services-section" aria-label="校园服务">
      <div class="section-inner">
        <div class="bento-grid">
          <RouterLink
            v-for="service in services"
            :key="service.to"
            :to="service.to"
            class="service-card"
            :class="[`tone-${service.tone}`, `size-${service.size}`]"
          >
            <div class="service-topline">
              <span class="service-icon"><component :is="service.icon" /></span>
              <span class="service-meta">{{ service.meta }}</span>
            </div>
            <div class="service-copy">
              <h3>{{ service.title }}</h3>
              <p>{{ service.copy }}</p>
            </div>

            <div class="service-preview" :class="`preview-${service.preview}`" aria-hidden="true">
              <template v-if="service.preview === 'search'">
                <div class="preview-search-bar">
                  <Search />
                  <span>搜索物品、地点或特征</span>
                </div>
                <div class="preview-result">
                  <span class="preview-thumb">卡</span>
                  <span class="preview-result-copy">
                    <strong>证件卡类 · 公开记录</strong>
                    <small>支持按区域与关键词检索</small>
                  </span>
                  <em>查看</em>
                </div>
                <div class="preview-result preview-result-secondary">
                  <span class="preview-thumb preview-thumb-warm">钥</span>
                  <span class="preview-result-copy">
                    <strong>钥匙 · 公开记录</strong>
                    <small>查看最新登记</small>
                  </span>
                  <em>查看</em>
                </div>
              </template>

              <template v-else-if="service.preview === 'message'">
                <div class="preview-message-head">
                  <span>学生信箱</span>
                  <small>匿名投递</small>
                </div>
                <p>你的每一条意见，都可以被持续追踪。</p>
                <span class="preview-reply">匿名或署名 · 可查询</span>
              </template>

              <template v-else-if="service.preview === 'stories'">
                <span class="preview-date">工作动态</span>
                <strong>活动、共建与<br />服务进展</strong>
                <span class="preview-text-link">阅读动态 <span aria-hidden="true">›</span></span>
              </template>

              <template v-else-if="service.preview === 'report'">
                <div class="preview-report-head">
                  <span>本月反馈</span>
                  <strong>查看汇总</strong>
                </div>
                <div class="preview-report-bars">
                  <span style="--bar: 82%"></span>
                  <span style="--bar: 63%"></span>
                  <span style="--bar: 46%"></span>
                </div>
              </template>

              <template v-else>
                <span class="preview-logo">事</span>
                <span class="preview-profile-copy">
                  <strong>学生事务部</strong>
                  <small>服务同学，连接校园</small>
                </span>
              </template>
            </div>

            <span class="service-link">了解更多 <span aria-hidden="true">›</span></span>
          </RouterLink>
        </div>
      </div>
    </section>

  </div>
</template>

<style scoped>
.home {
  overflow: hidden;
  color: var(--text);
  background: #fff;
}

.hero {
  position: relative;
  overflow: hidden;
  color: var(--text);
  background:
    radial-gradient(circle at 76% 34%, rgba(0, 113, 227, 0.13), transparent 28%),
    radial-gradient(circle at 22% 85%, rgba(255, 152, 79, 0.08), transparent 27%),
    linear-gradient(180deg, #fff 0%, #f5f5f7 68%, #fff 100%);
}

.hero::before {
  position: absolute;
  inset: 0;
  background-image: linear-gradient(rgba(0, 0, 0, 0.025) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 0, 0, 0.025) 1px, transparent 1px);
  background-size: 72px 72px;
  content: '';
  mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.65), transparent 78%);
}

.hero-inner {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(0, 1.03fr) minmax(430px, 0.97fr);
  align-items: center;
  gap: clamp(48px, 7vw, 104px);
  width: 100%;
  max-width: 1280px;
  min-height: calc(100vh - 52px);
  margin: 0 auto;
  padding: 90px 28px 72px;
}

.hero-copy {
  max-width: 680px;
}

.hero-eyebrow {
  display: flex;
  align-items: center;
  gap: 9px;
  margin: 0 0 26px;
  color: var(--text-2);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}

.eyebrow-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #4fa8ff;
  box-shadow: 0 0 0 5px rgba(79, 168, 255, 0.1), 0 0 22px rgba(79, 168, 255, 0.8);
}

.hero h1 {
  max-width: 760px;
  font-size: clamp(54px, 7vw, 96px);
  font-weight: 600;
  letter-spacing: -0.058em;
  line-height: 0.98;
}

.hero h1 span {
  background: linear-gradient(180deg, #1d1d1f 8%, #86868b 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.hero-intro {
  display: -webkit-box;
  max-width: 570px;
  margin: 30px 0 0;
  overflow: hidden;
  color: var(--text-2);
  font-size: clamp(17px, 1.7vw, 21px);
  line-height: 1.55;
  letter-spacing: -0.012em;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 22px;
  margin-top: 38px;
}

.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 46px;
  padding: 0 24px;
  border: 0;
  border-radius: 999px;
  font: inherit;
  font-size: 15px;
  font-weight: 500;
  line-height: 1;
  cursor: pointer;
  transition: transform 0.2s var(--ease), background-color 0.2s var(--ease), color 0.2s var(--ease);
}

.button:hover {
  transform: translateY(-1px);
}

.button-primary {
  color: #fff;
  background: #1d1d1f;
}

.button-primary:hover {
  background: #333336;
}

.button-primary .el-icon {
  font-size: 15px;
}

.button-ghost {
  padding: 0;
  color: #0066cc;
  background: transparent;
}

.button-ghost:hover {
  color: #0077ed;
}

.button-ghost span {
  font-size: 19px;
}

.hero-notes {
  display: flex;
  flex-wrap: wrap;
  gap: 18px 26px;
  margin-top: 48px;
  color: var(--text-3);
  font-size: 11px;
  letter-spacing: 0.02em;
}

.hero-notes span {
  position: relative;
  padding-left: 13px;
}

.hero-notes span::before {
  position: absolute;
  top: 50%;
  left: 0;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #2997ff;
  content: '';
  transform: translateY(-50%);
}

.hero-stage {
  position: relative;
  display: grid;
  place-items: center;
  min-height: 560px;
  perspective: 1200px;
}

.stage-glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(24px);
}

.stage-glow-blue {
  width: 430px;
  height: 430px;
  background: radial-gradient(circle, rgba(0, 113, 227, 0.24), rgba(0, 90, 210, 0.05) 52%, transparent 72%);
}

.stage-glow-warm {
  right: 8%;
  bottom: 7%;
  width: 210px;
  height: 210px;
  background: radial-gradient(circle, rgba(255, 145, 65, 0.13), transparent 68%);
}

.stage-window {
  position: relative;
  z-index: 2;
  width: min(100%, 490px);
  padding: 12px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 34px;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.94), rgba(245, 245, 247, 0.86));
  box-shadow:
    0 42px 100px rgba(0, 78, 160, 0.13),
    0 12px 34px rgba(0, 0, 0, 0.06),
    inset 0 1px 0 rgba(255, 255, 255, 0.92);
  -webkit-backdrop-filter: blur(24px) saturate(140%);
  backdrop-filter: blur(24px) saturate(140%);
  transform: rotateY(-7deg) rotateX(2deg);
  animation: stage-float 7s ease-in-out infinite;
}

.stage-toolbar {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 7px 9px 17px;
  color: var(--text-2);
  font-size: 12px;
}

.stage-app-mark {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 7px;
  color: #fff;
  background: linear-gradient(145deg, #64b5ff, #0071e3);
  font-size: 11px;
  font-weight: 700;
}

.stage-live {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-left: auto;
  color: var(--text-3);
  font-size: 10px;
}

.stage-live i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #30d158;
  box-shadow: 0 0 10px rgba(48, 209, 88, 0.7);
}

.stage-primary {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
  padding: 18px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 23px;
  background: rgba(255, 255, 255, 0.78);
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.035);
}

.stage-icon {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: 15px;
  color: #fff;
  background: linear-gradient(145deg, #2997ff, #0066cc);
  box-shadow: 0 10px 30px rgba(0, 113, 227, 0.28);
}

.stage-icon svg {
  width: 22px;
  height: 22px;
}

.stage-primary div {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.stage-primary small {
  color: var(--text-3);
  font-size: 10px;
}

.stage-primary strong {
  overflow: hidden;
  color: var(--text);
  font-size: 15px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stage-arrow {
  color: var(--text-3);
  font-size: 17px;
}

.stage-grid {
  display: grid;
  grid-template-columns: 1.08fr 0.92fr;
  gap: 10px;
  margin-top: 10px;
}

.stage-tile {
  position: relative;
  display: flex;
  min-height: 184px;
  flex-direction: column;
  overflow: hidden;
  padding: 18px;
  border-radius: 23px;
  background: rgba(255, 255, 255, 0.7);
}

.stage-tile-blue {
  background:
    radial-gradient(circle at 78% 18%, rgba(74, 164, 255, 0.34), transparent 37%),
    linear-gradient(145deg, #e3f1ff, #f2f8ff);
}

.stage-tile-warm {
  background:
    radial-gradient(circle at 60% 38%, rgba(255, 163, 83, 0.25), transparent 38%),
    linear-gradient(150deg, #fff0df, #fff9f2);
}

.tile-kicker {
  color: var(--text-2);
  font-size: 10px;
}

.tile-value {
  margin-top: auto;
  color: #143253;
  font-size: 43px;
  font-weight: 600;
  letter-spacing: -0.055em;
  line-height: 1;
}

.tile-caption {
  margin-top: 8px;
  color: var(--text-2);
  font-size: 10px;
}

.tile-orbit {
  position: absolute;
  top: 46px;
  right: 28px;
  width: 74px;
  height: 74px;
  border: 1px solid rgba(0, 0, 0, 0.14);
  border-radius: 50%;
}

.tile-orbit::before,
.tile-orbit::after {
  position: absolute;
  border-radius: 50%;
  content: '';
}

.tile-orbit::before {
  inset: 13px;
  border: 1px solid rgba(0, 0, 0, 0.09);
}

.tile-orbit::after {
  top: 8px;
  right: 7px;
  width: 8px;
  height: 8px;
  background: #ff9f5a;
  box-shadow: 0 0 15px rgba(255, 159, 90, 0.7);
}

.stage-progress {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 17px 9px 7px;
  color: var(--text-3);
  font-size: 10px;
}

.progress-track {
  height: 2px;
  overflow: hidden;
  border-radius: 2px;
  background: rgba(0, 0, 0, 0.08);
}

.progress-track i {
  display: block;
  width: 78%;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #0071e3, #64b5ff);
}

.stage-progress strong {
  color: var(--text-2);
  font-weight: 500;
}

.floating-card {
  position: absolute;
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 13px 16px;
  border: 1px solid rgba(255, 255, 255, 0.82);
  border-radius: 17px;
  color: var(--text-2);
  background: rgba(255, 255, 255, 0.76);
  box-shadow: 0 18px 44px rgba(0, 0, 0, 0.09);
  -webkit-backdrop-filter: blur(18px);
  backdrop-filter: blur(18px);
  font-size: 11px;
}

.floating-card small {
  display: block;
  margin-bottom: 2px;
  color: var(--text-3);
  font-size: 9px;
}

.floating-card-a {
  top: 15%;
  left: -16%;
  animation: float-a 8s ease-in-out infinite;
}

.floating-card-b {
  right: -7%;
  bottom: 17%;
  animation: float-b 8s ease-in-out 0.8s infinite;
}

.float-check {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  color: #30d158;
  background: rgba(48, 209, 88, 0.12);
  font-weight: 700;
}

.float-pulse {
  width: 8px;
  height: 8px;
  margin: 0 9px;
  border-radius: 50%;
  background: #2997ff;
  box-shadow: 0 0 0 6px rgba(41, 151, 255, 0.11), 0 0 18px rgba(41, 151, 255, 0.8);
}

.hero-rail {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 26px;
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  padding: 20px 28px 30px;
  color: var(--text-3);
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.rail-line {
  flex: 1;
  height: 1px;
  background: rgba(0, 0, 0, 0.09);
}

.rail-hint {
  color: var(--text-2);
}

.section-inner {
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 28px;
}

.services-section {
  padding: 76px 0 120px;
  background: #fff;
}

.bento-grid {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  grid-auto-rows: 240px;
  gap: 14px;
}

.service-card {
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 28px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 22px;
  transition: transform 0.3s var(--ease), background-color 0.3s var(--ease);
}

.service-card:hover,
.service-card:focus-visible {
  transform: translateY(-2px);
}

.size-wide {
  grid-column: span 7;
  grid-row: span 2;
}

.size-standard {
  grid-column: span 5;
  grid-row: span 2;
}

.size-third {
  grid-column: span 4;
}

.tone-light {
  color: var(--text);
  background: #f5f5f7;
}

.tone-light:hover {
  background: #f0f0f2;
}

.tone-dark {
  color: #f5f5f7;
  background: #1d1d1f;
}

.service-topline {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.service-icon {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border: 1px solid rgba(0, 0, 0, 0.05);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.88);
}

.service-icon svg {
  width: 20px;
  height: 20px;
}

.tone-dark .service-icon {
  border-color: transparent;
  background: #fff;
  color: #1d1d1f;
}

.service-meta {
  color: var(--text-3);
  font-size: 11px;
  letter-spacing: 0.015em;
}

.tone-dark .service-meta {
  color: rgba(255, 255, 255, 0.45);
}

.service-copy {
  position: relative;
  z-index: 2;
  margin-top: 24px;
}

.service-copy h3 {
  font-size: clamp(26px, 2.6vw, 36px);
  font-weight: 600;
  letter-spacing: -0.04em;
  line-height: 1.08;
}

.service-copy > p:last-child {
  max-width: 420px;
  margin: 12px 0 0;
  color: var(--text-2);
  font-size: 14px;
  line-height: 1.55;
}

.tone-dark .service-copy > p:last-child {
  color: rgba(255, 255, 255, 0.54);
}

.service-link {
  position: relative;
  z-index: 2;
  display: inline-block;
  align-self: flex-start;
  margin-top: auto;
  padding-top: 18px;
  color: #0066cc;
  font-size: 12px;
  font-weight: 500;
}

.tone-dark .service-link {
  color: #2997ff;
}

.service-preview {
  position: relative;
  z-index: 2;
  min-height: 140px;
  margin-top: 22px;
  overflow: hidden;
  padding: 14px;
  border: 1px solid rgba(0, 0, 0, 0.055);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.72);
}

.tone-dark .service-preview {
  border-color: rgba(255, 255, 255, 0.09);
  background: rgba(255, 255, 255, 0.065);
}

.size-third .service-preview {
  display: none;
}

.preview-search-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 11px;
  border-radius: 10px;
  color: var(--text-3);
  background: #fff;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.055);
  font-size: 11px;
}

.preview-search-bar svg {
  width: 14px;
  height: 14px;
}

.preview-result {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding-top: 10px;
}

.preview-thumb {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 10px;
  color: #315d8a;
  background: #e9f2fb;
  font-size: 12px;
  font-weight: 600;
}

.preview-thumb-warm {
  color: #8a5a27;
  background: #f8eee2;
}

.preview-result-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.preview-result-copy strong {
  overflow: hidden;
  font-size: 11px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-result-copy small {
  color: var(--text-3);
  font-size: 9px;
}

.preview-result em {
  color: var(--text-3);
  font-size: 9px;
  font-style: normal;
}

.preview-message-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--text-3);
  font-size: 9px;
}

.preview-message p {
  max-width: 310px;
  margin: 16px 0 14px;
  color: var(--text);
  font-size: 13px;
  line-height: 1.55;
}

.preview-reply {
  display: inline-flex;
  min-height: 24px;
  align-items: center;
  padding: 0 9px;
  border-radius: 999px;
  color: var(--text-2);
  background: rgba(0, 0, 0, 0.055);
  font-size: 9px;
}

.tone-dark .preview-message p {
  color: #f5f5f7;
}

.tone-dark .preview-message-head,
.tone-dark .preview-reply {
  color: rgba(255, 255, 255, 0.48);
}

.tone-dark .preview-reply {
  background: rgba(255, 255, 255, 0.08);
}

.preview-stories {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.preview-date {
  color: var(--text-3);
  font-size: 9px;
}

.preview-stories strong {
  font-size: 14px;
  font-weight: 500;
  line-height: 1.3;
}

.preview-text-link {
  color: #0066cc;
  font-size: 10px;
}

.preview-report {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.preview-report-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  color: var(--text-3);
  font-size: 9px;
}

.preview-report-head strong {
  color: var(--text);
  font-size: 15px;
  font-weight: 500;
}

.preview-report-bars {
  display: grid;
  align-items: end;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  height: 34px;
}

.preview-report-bars span {
  height: var(--bar);
  min-height: 8px;
  border-radius: 4px 4px 1px 1px;
  background: #c9d8e6;
}

.preview-report-bars span:nth-child(2) {
  background: #a8c3d9;
}

.preview-report-bars span:nth-child(3) {
  background: #7ea7c7;
}

.preview-profile {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.preview-logo {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 11px;
  color: #fff;
  background: linear-gradient(145deg, #64b5ff, #0071e3);
  font-size: 15px;
  font-weight: 600;
}

.preview-profile-copy {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.preview-profile-copy strong {
  font-size: 13px;
  font-weight: 500;
}

.preview-profile-copy small {
  color: var(--text-3);
  font-size: 9px;
}

.preview-result-secondary {
  padding-top: 8px;
}

.size-third .preview-result-secondary,
.size-third .preview-message-head,
.size-third .preview-reply,
.size-third .preview-report-bars {
  display: none;
}

@keyframes stage-float {
  0%,
  100% {
    transform: rotateY(-7deg) rotateX(2deg) translateY(0);
  }
  50% {
    transform: rotateY(-5deg) rotateX(1deg) translateY(-9px);
  }
}

@keyframes float-a {
  0%,
  100% {
    transform: translate3d(0, 0, 0);
  }
  50% {
    transform: translate3d(4px, -9px, 0);
  }
}

@keyframes float-b {
  0%,
  100% {
    transform: translate3d(0, 0, 0);
  }
  50% {
    transform: translate3d(-5px, 8px, 0);
  }
}

@media (max-width: 1080px) {
  .hero-inner {
    grid-template-columns: minmax(0, 1fr) minmax(380px, 0.85fr);
    gap: 28px;
  }

  .hero-stage {
    min-height: 500px;
    transform: scale(0.92);
  }

  .floating-card-a {
    left: -8%;
  }

  .floating-card-b {
    right: -1%;
  }

}

@media (max-width: 820px) {
  .hero-inner {
    display: block;
    min-height: auto;
    padding-top: 100px;
  }

  .hero-copy {
    max-width: 100%;
  }

  .hero h1 {
    max-width: 720px;
  }

  .hero-stage {
    width: min(100%, 580px);
    min-height: 530px;
    margin: 36px auto 0;
    transform: none;
  }

  .hero-rail {
    padding-top: 10px;
  }

  .hero-rail span:nth-child(2),
  .hero-rail span:nth-child(3) {
    display: none;
  }

  .services-section {
    padding: 96px 0;
  }

  .bento-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-auto-rows: 280px;
  }

  .size-wide,
  .size-standard {
    grid-column: span 2;
    grid-row: span 1;
  }

  .size-third {
    grid-column: span 1;
  }

  .size-third:last-child {
    grid-column: span 2;
  }

}

@media (max-width: 560px) {
  .hero-inner {
    padding: 72px 18px 46px;
  }

  .hero-eyebrow {
    margin-bottom: 22px;
    font-size: 9px;
    letter-spacing: 0.1em;
  }

  .hero h1 {
    font-size: clamp(47px, 14.4vw, 64px);
    letter-spacing: -0.06em;
  }

  .hero-intro {
    margin-top: 24px;
    font-size: 16px;
  }

  .hero-actions {
    gap: 18px;
    margin-top: 30px;
  }

  .button {
    min-height: 44px;
  }

  .hero-notes {
    gap: 12px 18px;
    margin-top: 34px;
  }

  .hero-stage {
    min-height: 430px;
    margin-top: 26px;
  }

  .stage-window {
    border-radius: 26px;
    transform: none;
    animation: none;
  }

  .stage-primary {
    padding: 14px;
  }

  .stage-icon {
    width: 42px;
    height: 42px;
  }

  .stage-grid {
    grid-template-columns: 1fr;
  }

  .stage-tile {
    min-height: 112px;
  }

  .stage-tile-warm {
    display: none;
  }

  .tile-value {
    font-size: 31px;
  }

  .floating-card {
    display: none;
  }

  .stage-progress {
    grid-template-columns: auto 1fr;
  }

  .stage-progress strong {
    display: none;
  }

  .hero-rail {
    padding: 6px 18px 24px;
  }

  .section-inner {
    padding: 0 18px;
  }

  .services-section {
    padding: 74px 0;
  }

  .bento-grid {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .service-card {
    min-height: 260px;
    padding: 24px;
  }

  .size-wide {
    min-height: 360px;
  }

  .service-copy h3 {
    font-size: 31px;
  }

}

@media (prefers-reduced-motion: reduce) {
  .stage-window,
  .floating-card {
    animation: none;
  }

  .service-card,
  .button {
    transition: none;
  }
}
</style>
