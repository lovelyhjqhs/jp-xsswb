# 前端镜像：Vite 构建 → nginx 托管静态文件
# 构建上下文是「仓库根目录」：
#   docker build -f frontend/Dockerfile -t campus-lostfound-frontend .

FROM node:22-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/package.json
COPY backend/package.json ./backend/package.json
RUN npm ci --registry=https://registry.npmmirror.com --no-audit --no-fund

COPY frontend ./frontend
RUN npm --workspace frontend run build

FROM nginx:alpine

COPY --from=build /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
