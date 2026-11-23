# 学校部门官网

学校部门公开信息网站，包含部门概况、工作动态、食堂面对面、失物招领和学生信箱。普通访客均为 `guest`，无需注册或登录即可浏览、搜索和提交表单；网站只设一个专用 `admin` 账号，负责内容管理、投稿审核、媒体和审计。

## 身份与隐私约束

- 全站只有 `admin` 与 `guest` 两种身份。
- 没有普通用户账号、游客登录、游客注册、游客密码、个人中心或普通用户找回密码。
- 游客投稿不创建账号。投稿默认待审核；查询处理状态必须同时提供一次性查询编号和查询凭证。
- 姓名、班级、联系方式、附件、内部备注和管理字段只供管理员处理；公开信箱/意见仅在管理员明确设置公开内容后展示。
- 游客附件保存在独立私有卷中；官网公开图片和失物图片仍需有有效公开记录关联才能读取。

## 技术栈

- 前端：Vue 3、Vue Router、Pinia、Element Plus、Vite
- 后端：Node.js、Express、Zod、Prisma
- 数据库：MySQL 8.4
- 图片：Sharp 校验解码、压缩并重编码为 WebP
- 部署：Docker Compose、Nginx 同域反向代理

目录边界：`frontend/` 管公开站点与后台界面；`backend/src/routes` 管路由和访问控制；`backend/src/services` 管业务及 DTO；`backend/prisma` 管数据库模型、迁移和一次性 seed；`nginx/` 管反代与响应安全头；`scripts/` 管部署检查和备份恢复演练。

## 本地开发

需要 Node.js 20.6+、npm 和 Docker。复制两个环境模板：

```powershell
docker compose up -d mysql
npm ci
Copy-Item .env.docker.example .env
Copy-Item .env.example backend\.env
```

编辑根目录 `.env` 和 `backend/.env`，为本地 MySQL 设置密码，并确保两处的 `MYSQL_PASSWORD` / `DATABASE_URL` 密码一致；设置至少 32 位开发用 `JWT_SECRET`。然后运行迁移并初始化唯一管理员。新建管理员时密码需为 16–72 个 UTF-8 字节：

```powershell
npm run db:deploy
$env:ADMIN_STUDENT_NO = Read-Host "管理员账号"
$env:ADMIN_NAME = "系统管理员"
$securePassword = Read-Host "管理员初始密码（16–72 UTF-8 字节）" -AsSecureString
$env:ADMIN_PASSWORD = [System.Net.NetworkCredential]::new("", $securePassword).Password
npm run db:seed
Remove-Item Env:ADMIN_STUDENT_NO, Env:ADMIN_NAME, Env:ADMIN_PASSWORD
Remove-Variable securePassword
```

开发用环境变量只用于本机，不要提交 `.env`。启动 API 和前端：

```powershell
npm run dev:backend
npm run dev:frontend
```

前端地址为 `http://localhost:5173`，API 地址为 `http://localhost:3000`。开发 API 文档需显式设置 `ENABLE_API_DOCS=true`；生产环境始终关闭。

## Docker 首次部署

复制 `.env.docker.example` 为根目录 `.env`，设置数据库密码、随机 `JWT_SECRET`、正式 `PUBLIC_SITE_URL` 和 HTTPS Cookie 配置。管理员初始化凭据只在创建账号时提供给 seed 服务：

```powershell
docker compose up -d mysql
$env:ADMIN_STUDENT_NO = Read-Host "管理员账号"
$env:ADMIN_NAME = "系统管理员"
$securePassword = Read-Host "管理员初始密码（16–72 UTF-8 字节）" -AsSecureString
$env:ADMIN_PASSWORD = [System.Net.NetworkCredential]::new("", $securePassword).Password
docker compose --profile ops run --rm seed
Remove-Item Env:ADMIN_STUDENT_NO, Env:ADMIN_NAME, Env:ADMIN_PASSWORD
Remove-Variable securePassword
docker compose up -d --build
```

`seed` 是显式一次性任务；管理员凭据不会注入常驻 `backend` 或 `maintenance` 容器。seed 只创建管理员或同步同一管理员资料，不会把普通账号提升为管理员，也不会为已存在账号重置密码。后续启动使用 `docker compose up -d --build`，迁移服务只运行数据库迁移。上线前按 [上线检查清单](docs/GO-LIVE-CHECKLIST.md) 完成 HTTPS、备份恢复演练和权限验收。

## 主要 API

- 公开读取与投稿：`/api/public/*`
- 管理员登录、会话和管理：`/api/admin/*`
- 管理员写请求使用服务端会话 Cookie，并校验 `X-CSRF-Token`
- 未登录访问后台资源返回 `401`；无管理员身份返回 `403`
- 游客没有账号 API；普通认证兼容代码只在测试环境挂载，不属于开发或生产服务

公开接口只查询已发布、未删除且允许公开的数据，并用显式 DTO 返回字段。失物记录归还、清理、撤回或删除后会从公开列表、详情、图片和 sitemap 隐藏。匹配建议只供管理员审核，不自动公开或关联。

## 迁移、测试与构建

```powershell
npm run db:generate
npm run db:deploy
npm run test:db:init
npm run lint
npm run build:frontend
npm test
docker compose config --quiet
```

后端集成测试需要可用的测试 MySQL 和测试环境变量；`test:db:init` 会从 MySQL 容器环境读取 root 密码，不把密码写进命令行。测试运行方式与当前锁定依赖的兼容情况见 [安全与隐私检查报告](docs/SECURITY-PRIVACY-REPORT.md)。

## 备份和维护

`backup` 会生成数据库、公开媒体卷和游客私有附件卷组成的同一时间戳备份集。`restore-check` 将 SQL 恢复到独立空库，并校验两个文件归档；文件恢复校验使用临时目录，不覆盖线上卷。

```powershell
docker compose --profile ops run --rm backup
$env:BACKUP_FILE = "C:\备份目录\campus_lostfound-时间戳.sql.gz"
$env:UPLOADS_BACKUP_FILE = "C:\备份目录\campus_lostfound-时间戳-uploads.tar.gz"
$env:PRIVATE_UPLOADS_BACKUP_FILE = "C:\备份目录\campus_lostfound-时间戳-private-uploads.tar.gz"
$env:RESTORE_TEST_DB = "campus_lostfound_restore_check"
docker compose --profile ops run --rm restore-check
```

生产备份还必须由部署方加密并异地保存。归档与删除状态保留投稿业务数据；当前没有已批准的个人数据最终清除期限，需由学校确定并配置正式保留策略。

## 安全文档

- [安全与隐私检查报告](docs/SECURITY-PRIVACY-REPORT.md)
- [上线检查清单](docs/GO-LIVE-CHECKLIST.md)
- [服务器部署说明](docs/SERVER-SETUP.md)
- [公网部署说明](docs/PUBLIC-DEPLOY.md)
