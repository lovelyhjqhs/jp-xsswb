# frontend

Vue 3 + Vite + Vue Router + Pinia + Element Plus（JavaScript，无 TypeScript）。

## 开发

```powershell
npm run dev          # 根目录，等价于 npm --workspace frontend run dev
```

默认地址 <http://localhost:5173>，开发服务器会把 `/api` 与 `/uploads` 代理到
`http://127.0.0.1:3000`，因此**需要先启动后端**：

```powershell
npm run dev:backend
```

## 构建

```powershell
npm run build        # 输出到 frontend/dist
```

## 目录

```
src/
├── api/          # axios 封装与接口函数（http.js 统一处理 token / 错误 / 401）
├── components/   # 可复用组件（帖子卡片、空状态、举报弹窗）
├── router/       # 路由表与登录守卫
├── stores/       # Pinia（登录态）
├── styles/       # 全局样式与主题变量
├── utils/        # 时间格式化、状态文案映射
└── views/        # 页面
```

## 约定

- 所有请求走 `src/api/`，组件里不直接调用 axios
- 不使用 `v-html`；用户输入的多行文本用 `white-space: pre-wrap` 渲染
- 移动端优先：默认按 375px 适配，`min-width: 768px` / `900px` / `1024px` 逐级增强
