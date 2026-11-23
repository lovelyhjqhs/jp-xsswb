# 安全与隐私检查报告

最后复核日期：2026-11-11。检查范围为当前仓库的 Express/Vue/MySQL 实现、Docker Compose、Nginx、迁移/备份脚本和部署文档。本文区分代码审查、可运行检查与尚未完成的运行时验收；代码审查不等同于渗透测试或正式上线批准。

## 威胁模型

需要保护的资产包括唯一管理员凭据与会话、公开和未公开内容、署名投稿中的班级/姓名/联系方式、投稿附件、查询凭证、审计记录、数据库和备份。信任边界为访客浏览器到 Nginx、Nginx 到 Express、Express 到 MySQL/文件卷，以及 Docker 主机和备份介质。

主要攻击者和误用场景包括：未登录者枚举 ID 或直接请求后台资源；自动化程序灌入投稿或猜测查询凭证；投稿者上传伪装文件或恶意正文；窃取会话者跨站发起管理写操作；管理员误发布待审内容；运维误把密钥、备份或私有附件暴露在公网。当前采用默认拒绝的服务端路由鉴权、字段白名单 DTO、CSRF、限流、图片重编码、私有附件隔离、审计和备份控制降低这些风险。

## 已修复与当前防护

| 范围 | 结果 |
| --- | --- |
| 管理员权限 | 除管理员登录外，`/api/admin/*` 路由先经过服务端会话鉴权。管理员会话需匹配数据库中的有效会话、未撤销、未过期且账户仍有效；管理员数量不是唯一时拒绝登录和访问。管理写请求校验会话绑定的 CSRF Token。前端路由守卫只负责体验。 |
| 身份模型 | 开发/生产不挂载普通注册、登录、个人中心和普通密码接口；旧兼容路由只在 `NODE_ENV=test` 挂载。清除了前端遗留的普通登录、注册、个人中心、普通用户发帖页面、Bearer Token 存储和对应 API；前端请求不再从 `localStorage` 读取或发送普通账号 Token。公开页面不提供普通账号入口。管理员由 seed 初始化，不提供管理员注册 API。 |
| 管理员初始化秘密 | Compose 中的 `backend`、`maintenance` 和迁移服务不再接收管理员初始密码；迁移只运行 schema 部署。新增 `seed` 一次性服务，使用 `docker compose --profile ops run --rm seed`，执行后容器自动移除。seed 只同步同一管理员，不会把普通账号提升为管理员或创建第二个管理员。 |
| 密码与会话 | 新建管理员密码使用 bcrypt 12 轮哈希，seed 强制 16–72 UTF-8 字节；已有账号的密码哈希保持不变，数据库不保存明文。登录按 IP 限流并对不存在的账号执行 dummy bcrypt 比对，失败消息一致。会话令牌为服务端随机值，数据库只保存 HMAC；Cookie 配置 HttpOnly、SameSite=Lax、过期时间，生产强制 Secure。登出写入撤销时间，旧 Cookie 随后不能访问。每次成功登录都会创建新的随机会话，不接受客户端指定的 session id。 |
| CSRF 与跨域 | 管理员变更请求必须提供与服务端会话绑定的 CSRF Token；CORS 来源使用配置白名单，生产同域 Nginx 部署不需要开放跨域。 |
| 越权与对象范围 | 公开失物列表、详情和图片均限定为允许公开、未删除且当前公开状态的记录；图片还要匹配记录和图片 ID。公开媒体需有关联的公开媒体记录。私有附件只经管理员 API 读取。公开查询状态需要同时匹配高熵查询编号和查询凭证，响应不含身份资料。 |
| 公开 DTO 与投稿隐私 | 公开服务使用显式 select/DTO，不返回联系方式、班级、姓名、内部备注、审核原因或管理员字段。匿名模式不保存客户端姓名/班级；信箱公开列表只返回管理员编辑的 `publicContent` 且必须显式允许公开。所有游客投稿默认待审核。 |
| 投稿滥用 | 投稿设置 15 分钟/IP 20 次限额、状态查询 15 分钟/IP 30 次限额、全局 API 限流、蜜罐字段、强制幂等键、数据库唯一约束、同内容短时重复检测和查询凭证过期清理。接口不创建访客账号。 |
| 文件 | 只接收 JPEG/PNG/WebP；单文件最大 5 MiB，游客投稿最多 3 个附件；Sharp 实际解码、限制像素数、压缩并转成 WebP，原始文件名不用于存储。公开媒体与游客私有附件分卷；私有附件不可静态访问。下载响应固定 MIME、`nosniff` 和 `no-store`。 |
| 注入与脚本 | 数据库操作使用 Prisma 参数化查询；未发现 `$queryRawUnsafe` 或用户输入拼接到命令执行。测试库初始化使用静态参数调用 Docker，不把密码放入命令参数。仓库前端未发现 `v-html`/`innerHTML`，Vue 插值默认转义。CMS 正文以普通文本显示，不应在后续变更中引入不可信 HTML 渲染。恢复脚本将数据库名限制为字母、数字、下划线，并限制恢复库名称前缀。 |
| 错误与日志 | 未知异常响应统一为通用 500，不回传堆栈或驱动消息；未匹配路由返回通用 404。访问日志和异常日志只记路由模板，无法匹配路由时记 `/unmatched`，不记录攻击者控制的原始路径；请求体、Cookie、授权头和查询串不记录。审计日志只保留允许的状态/计数类字段。 |
| 文档与自检 | API 文档即使设置 `ENABLE_API_DOCS=true`，生产也不挂载。部署自检移除硬编码数据库口令和旧账号 API 检查，改查公开 API、根 robots.txt 和唯一管理员计数。恢复检查要求 SQL、公开媒体和私有附件来自同一命名时间戳。 |
| SEO 与内容边界 | 根 `robots.txt`、`sitemap.xml` 由 Nginx 转发到公开 API；地图来源只包含已发布内容和仍公开的失物记录，不含表单查询页。待审、归档、删除和已归还/清理失物从公开入口隐藏。 |

## 文件和操作策略

官网图片与游客投稿附件分别持久化到 `uploads_data`、`private_uploads_data`；访客附件仅管理员可下载。投稿归档/软删除会从公开面隐藏，但不会自动物理删除业务记录或相关私有附件。查询凭证、幂等键和内容指纹哈希可在 `PUBLIC_QUERY_TTL_DAYS` 后清除；操作日志由维护任务按 `AUDIT_LOG_RETENTION_DAYS` 清理。当前默认日志期限为 365 天，但该默认值不是学校批准的个人数据保留政策。

备份脚本包含 MySQL dump 和两个文件卷归档，并按数据库备份集轮转；恢复检查恢复 SQL 到独立数据库，并把文件归档解压到临时目录验证后清理。该脚本不覆盖生产数据卷，也不自动提供加密或异地复制。

## 仍需人工配置或决策

1. **正式密钥**：安全配置 `JWT_SECRET`、`DATABASE_URL`、`MYSQL_ROOT_PASSWORD`、`MYSQL_PASSWORD`；管理员首次初始化时临时提供 `ADMIN_STUDENT_NO`、`ADMIN_NAME`、`ADMIN_PASSWORD`。初始密码不能留在常驻服务环境中，seed 完成后应从部署环境移除。
2. **HTTPS 与域名**：配置边缘 TLS、证书续期、HTTPS Cookie `ADMIN_COOKIE_SECURE=true`、不带账号密码/路径/查询串的正式 `PUBLIC_SITE_URL`、正确的 `TRUST_PROXY` 和最小化的 `CORS_ORIGINS`。
3. **限流扩展**：应用限流和登录失败计数使用进程内存，进程重启会清空，多副本之间不共享。多副本上线前需使用 Redis/网关共享限流，并配置真实代理层数；单副本生产也建议增加边缘 WAF/限流。
4. **恶意文件扫描**：Sharp 解码重编码能排除伪装格式、移除元数据并限制像素数，但不是杀毒扫描。若学校要求病毒扫描，应在管理员发布附件前接入隔离扫描服务。
5. **保留和清除期限**：需由学校确定署名投稿资料、联系方式、私有附件、已删除/已归档数据、旧学生账号数据及审计日志的最终保留期限和删除责任人。现行软删除策略不会自动清除个人信息或附件。
6. **管理员密码轮换**：seed 不会重置已有账号密码，后台当前没有密码修改/找回入口。上线前需建立由授权运维人员执行的离线轮换与会话撤销流程，并留存不含明文密码的审计记录。
7. **备份保护**：部署方需配置加密、异地/离线副本、访问控制、密钥保管和恢复目标时间；至少定期演练从异地备份恢复数据库与两个文件卷。
8. **旧数据**：数据库模型仍保留历史 `User`/白名单/旧失物字段，以兼容迁移和测试。开发/生产没有普通账号 API，但既有数据库可能仍有旧学生账号或关联数据；上线前需由数据负责人确认迁移、匿名化或保留方案，不应未经授权批量删除。
9. **浏览器验收**：本轮未能连接 Docker 容器，也未完成真实浏览器测试；需人工验收手机/桌面、键盘、屏幕阅读器、对比度、错误/成功态和图片加载。

## 环境变量清单

不在报告或仓库中记录任何实际密钥值。

| 变量 | 用途与配置要求 |
| --- | --- |
| `DATABASE_URL` | 后端 Prisma 数据库连接串；只给需要访问数据库的服务。 |
| `JWT_SECRET` | 会话 HMAC 和兼容认证密钥，使用随机值且至少 32 字符。 |
| `MYSQL_DATABASE`、`MYSQL_USER`、`MYSQL_PASSWORD`、`MYSQL_ROOT_PASSWORD` | Compose MySQL 初始化参数；root 与应用凭据分离。 |
| `ADMIN_STUDENT_NO`、`ADMIN_NAME`、`ADMIN_PASSWORD` | 一次性 seed 输入；不传给常驻 backend/maintenance，seed 使用 `--rm`。 |
| `ADMIN_COOKIE_SECURE`、`ADMIN_SESSION_TTL_MINUTES` | 生产 Secure Cookie 与会话有效期。 |
| `PUBLIC_SITE_URL` | 正式站点绝对 URL，用于 sitemap；生产必须配置。 |
| `CORS_ORIGINS`、`TRUST_PROXY` | 跨域白名单、可信代理层数。 |
| `RATE_LIMIT_WINDOW_MS`、`RATE_LIMIT_MAX` | 全局 API 限流；投稿与查询另有专用上限。 |
| `PUBLIC_QUERY_TTL_DAYS` | 游客查询凭证期限。 |
| `AUDIT_LOG_RETENTION_DAYS` | 操作日志清理期限，范围由应用校验；最终策略由学校批准。 |
| `UPLOAD_DIR`、`PRIVATE_UPLOAD_DIR` | 公开媒体目录和私有投稿附件目录/卷。 |
| `ENABLE_API_DOCS` | 仅非生产环境可启用；生产代码强制关闭文档路由。 |
| `HTTP_PORT` | Compose 对外端口；生产通常由外层 TLS 代理接入。 |

## 验证记录

- `npm run lint`：通过。
- `npm run build:frontend`：通过；Vite 报告主 JavaScript chunk 为 887.29 KiB，超过 500 KiB 提示阈值；不影响构建成功，但上线前应评估拆包。
- `npm test`：通过，24 个测试文件、280 项测试全部通过。测试库 `campus_lostfound_test` 的 12 个迁移均已应用；会话用例覆盖伪造、过期、登出失效、非管理员身份和 CSRF 拒绝，失物搜索覆盖 SQL 注入形态关键词。
- `npm --workspace backend exec prisma validate -- --schema prisma/schema.prisma`：通过；Prisma 同时提示 `package.json#prisma` 配置将在 Prisma 7 移除，建议迁移到 `prisma.config.ts`。
- `docker compose config --quiet`：通过。
- `docker compose build`：锁文件更新后 backend、frontend、migrate 三个镜像均成功构建。新 backend 镜像连隔离测试库启动成功；健康检查及公开 profile/news/canteen/lost-found/mailbox API 返回 200，未登录后台和私有附件 API 返回 401。新 frontend 镜像的公开页面、管理员登录和未知路径均返回 SPA shell。
- 当前 `http://localhost:8080` 运行服务的只读冒烟：首页、五个栏目入口、管理员登录页、健康检查和公开读取 API 返回 200；未登录访问 `/admin` 与 `/admin/items` 返回带登录目标的 302，后台 stats/items/session API 返回 401。Nginx 页面保护使用内部会话子请求，未登录页面不再只依赖前端路由守卫。
- 管理员一次性初始化在隔离库验证成功：只创建一个启用管理员，密码为 bcrypt 哈希。备份恢复演练在隔离数据库和合成文件归档上成功；不代表生产或异地备份已验证。
- `npm audit --workspace=frontend --omit=dev --audit-level=high`：0 个漏洞。全仓 `npm audit --omit=dev --audit-level=high` 仍报告 3 个 high，来自 Prisma 6 CLI 的 `@prisma/config` 与 `deepmerge-ts` 开发迁移工具链；自动修复要求升级 Prisma 7，属于破坏性主版本升级，本轮未执行。Docker runtime 镜像显式移除了 Prisma CLI 工具链。
- 当前主开发数据库 `campus_lostfound` 仍有 `20261110030000_expire_query_credentials` 和 `20261110040000_unique_submission_idempotency` 两个待应用迁移；为避免改动现有开发数据，本轮没有对该库执行迁移。部署新镜像前应在经批准的目标库运行 Compose migration。
- 未完成真实桌面/移动浏览器交互、屏幕阅读器、键盘焦点、色彩对比、生产 TLS、生产数据迁移或生产恢复验收。HTTP SPA shell 检查不等同于浏览器 E2E。

## 上线前检查清单

- [ ] 按 [上线检查清单](GO-LIVE-CHECKLIST.md) 配置密钥、TLS、域名、代理和来源白名单。
- [ ] 确认只有一个启用的管理员，且不提供普通用户账号入口；隔离检查旧账号数据。
- [ ] 运行迁移和一次性 seed，随后移除初始化凭据；生产环境文档 API 不可访问。
- [ ] 验证未登录后台为 401、伪造/过期/登出会话拒绝、CSRF 缺失为 403。
- [ ] 逐项验证草稿/待审/驳回/归档/删除和已归还失物不能从 API、图片和 sitemap 读取。
- [ ] 验证匿名/署名投稿 DTO、附件访问、查询编号与凭证、重复键、蜜罐和限流。
- [ ] 配置数据库、公开媒体和私有附件的加密异地备份；在隔离环境完成恢复演练。
- [ ] 获得学校个人数据保留/删除期限审批并安排维护任务。
- [ ] 完成桌面和手机浏览器、键盘与屏幕阅读器验收。
