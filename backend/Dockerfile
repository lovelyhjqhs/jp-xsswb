# 后端镜像
# 构建上下文是「仓库根目录」（monorepo，npm workspaces 的 lockfile 在根上）：
#   docker build -f backend/Dockerfile -t campus-lostfound-backend .

# ---------- 构建阶段：装全部依赖 + 生成 Prisma Client ----------
FROM node:22-slim AS build
WORKDIR /app

# Prisma 的查询引擎需要 openssl。中国大陆服务器使用 Debian 镜像源。
RUN sed -i 's|deb.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources \
 && apt-get update \
 && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/*

# 先只拷清单，让依赖层可复用缓存
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
RUN npm ci --registry=https://registry.npmmirror.com --no-audit --no-fund

# 生成客户端（.prisma/client 里包含查询引擎）
COPY backend/prisma ./backend/prisma
RUN npx prisma generate --schema ./backend/prisma/schema.prisma

COPY backend/src ./backend/src
COPY backend/scripts ./backend/scripts
COPY backend/docs ./backend/docs

# ---------- 运行阶段 ----------
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN sed -i 's|deb.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources \
 && apt-get update \
 && apt-get install -y --no-install-recommends openssl tini \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --system --uid 1001 --create-home appuser

# 安装依赖
# 注意：npm 11 在 workspaces 项目里对 `--omit=dev` 的处理不可靠（实测仍会装 devDependencies），
# 所以这里先正常安装，再显式剔除「只服务于构建/测试」的包。
# 这是有意的白名单式清理：删多了会在启动或首个数据库请求时立刻暴露，构建后已用健康检查验证。
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
RUN PRISMA_SKIP_POSTINSTALL_GENERATE=true npm ci --registry=https://registry.npmmirror.com --no-audit --no-fund \
 && rm -rf \
      # ---- Prisma CLI 工具链（运行时只需要 .prisma/client 里的查询引擎）----
      node_modules/prisma \
      node_modules/@prisma/config \
      node_modules/@prisma/engines \
      node_modules/@prisma/engines-version \
      node_modules/@prisma/fetch-engine \
      node_modules/@prisma/get-platform \
      node_modules/@prisma/debug \
      node_modules/deepmerge-ts \
      # ---- 测试与构建工具 ----
      node_modules/vitest node_modules/@vitest \
      node_modules/vite node_modules/@vitejs \
      node_modules/rolldown node_modules/@rolldown node_modules/@oxc-project \
      node_modules/eslint node_modules/@eslint node_modules/@eslint-community \
      node_modules/globals node_modules/eslint-plugin-vue node_modules/vue-eslint-parser \
      node_modules/supertest node_modules/fast-check node_modules/pure-rand \
      # ---- 前端运行时库（后端用不到）----
      node_modules/vue node_modules/vue-router node_modules/pinia \
      node_modules/element-plus node_modules/@element-plus node_modules/@vue \
      node_modules/@vueuse node_modules/axios node_modules/dayjs node_modules/lodash-es

# 用构建阶段生成好的客户端（含查询引擎）覆盖安装出来的空壳
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma/client ./node_modules/@prisma/client

COPY --from=build /app/backend/src ./backend/src
COPY --from=build /app/backend/prisma ./backend/prisma
COPY --from=build /app/backend/docs ./backend/docs
COPY --from=build /app/backend/scripts ./backend/scripts

WORKDIR /app/backend

# 上传目录：容器内固定路径，由 compose 挂载为 volume
RUN mkdir -p /app/uploads /app/private-uploads && chown -R appuser:appuser /app
USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# tini 负责转发信号并回收僵尸进程，保证 SIGTERM 能触发优雅退出
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "src/server.js"]
