# 上线检查清单

带“阻断”的项目未完成前不要开放公网访问。不要把 `.env`、管理员密码、数据库连接串或备份加入版本库。

## 身份与密钥

| 状态 | 检查项 |
| --- | --- |
| 阻断 | 仅存在一个启用的专用管理员账号；通过一次性 `seed` 初始化，不存在游客注册/登录、普通用户密码、个人中心或找回密码入口。 |
| 阻断 | `JWT_SECRET` 使用安全随机值且不少于 32 字符，且不是任何模板值；数据库 root 和应用账号使用不同的强密码。数据库密码采用 URL 安全字符，或正确编码到 `DATABASE_URL`。 |
| 阻断 | 生产 `ADMIN_COOKIE_SECURE=true`，会话 TTL 符合学校管理要求；管理员初始化密码只注入 seed 容器，成功后从部署环境移除。 |
| 阻断 | `.env` 和备份目录被忽略且没有进入 Git 历史；如曾提交过密钥，必须轮换。 |
| 建议 | `ADMIN_SESSION_TTL_MINUTES` 设为学校可接受的短时长；仅在需要更改 Cookie 名称时设置 `ADMIN_SESSION_COOKIE`、`ADMIN_CSRF_COOKIE`。 |

## 网络与配置

| 状态 | 检查项 |
| --- | --- |
| 阻断 | 正式域名已启用 HTTPS；外层 TLS 代理配置正确，并在 HTTPS 确认后启用 HSTS。 |
| 阻断 | `PUBLIC_SITE_URL` 是正式 HTTPS 规范地址；根路径 `robots.txt` 与 `sitemap.xml` 可访问，站点地图只含已公开页面。 |
| 阻断 | 生产 `ENABLE_API_DOCS=false`；即使误设为 true，生产后端仍不挂载文档路由。 |
| 阻断 | 公网只开放必要的 HTTPS 入口；MySQL、backend、frontend 不直接暴露公网。 |
| 检查 | `TRUST_PROXY` 与实际可信代理层数一致；`CORS_ORIGINS` 只列出实际前端来源。 |
| 检查 | `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` 与服务容量匹配。当前限流在单进程内存中，多副本必须改用共享存储或边缘限流。 |
| 阻断 | 在 npm registry 可访问的环境运行 `npm audit --omit=dev --audit-level=high` 并处理高危及严重依赖漏洞；本地审计若因网络失败，不能据此判定依赖安全。 |

## 文件、数据与保留

| 状态 | 检查项 |
| --- | --- |
| 阻断 | `uploads_data` 与 `private_uploads_data` 均为持久卷；游客附件不由静态目录直接提供，私有附件接口需要管理员会话。 |
| 阻断 | 每日备份数据库、公开媒体卷和游客私有附件卷；确认三份文件使用同一时间戳。 |
| 阻断 | 备份加密后传输并异地保存，限制解密密钥和 Docker 主机访问；本机 `./backups` 不是灾难恢复副本。 |
| 阻断 | 至少完成一次 `restore-check`：恢复到独立空数据库并验证两种文件归档；另行演练从异地备份恢复到隔离环境。 |
| 阻断 | 学校负责人批准投稿身份资料、私有附件、已删除内容和操作日志的最终保留/清除期限；设置 `AUDIT_LOG_RETENTION_DAYS` 并安排维护任务。 |
| 检查 | `PUBLIC_QUERY_TTL_DAYS` 与业务承诺一致；到期清除查询凭证哈希，但不自动删除待审核/归档业务记录。 |

## 权限与功能验收

1. 游客无需登录访问五个栏目；页面不存在注册、普通登录、账号或个人中心入口。
2. 未登录访问 `/admin`、`/admin/...` 页面由 Nginx 重定向到 `/admin/login`；未登录请求 `/api/admin/*` 返回 `401`；伪造、过期、非管理员和已登出的会话均被拒绝；管理员写请求缺少/伪造 CSRF Token 返回 `403`。
3. 草稿、待审核、驳回、归档、删除记录不出现在公开列表、详情、图片或 sitemap；归还/清理失物立即从公开面隐藏。
4. 匿名投稿不回显姓名/班级；署名资料、联系方式、原始正文、附件和内部备注不出现在公开 DTO、日志或错误响应。
5. 投稿需要有效幂等键；重复内容、限流和蜜罐场景得到清晰提示；附件类型、大小和图片解码校验生效。
6. 管理员手工确认失物匹配；系统建议不自动公开或变更关联。
7. 手机和桌面浏览器检查导航、表单、筛选、加载/空/错误/成功状态、键盘焦点顺序、图片替代文本、颜色对比和无横向滚动。

## 生产环境变量

按服务配置，不要将真实值写入模板：`DATABASE_URL`、`JWT_SECRET`、`MYSQL_ROOT_PASSWORD`、`MYSQL_PASSWORD`、`ADMIN_COOKIE_SECURE`、`ADMIN_SESSION_TTL_MINUTES`、`PUBLIC_SITE_URL`、`CORS_ORIGINS`、`TRUST_PROXY`、`RATE_LIMIT_WINDOW_MS`、`RATE_LIMIT_MAX`、`PUBLIC_QUERY_TTL_DAYS`、`AUDIT_LOG_RETENTION_DAYS`、`UPLOAD_DIR`、`PRIVATE_UPLOAD_DIR`、`ENABLE_API_DOCS`。初始化时临时提供 `ADMIN_STUDENT_NO`、`ADMIN_NAME`、`ADMIN_PASSWORD` 给 `seed` 服务；常驻 backend 不需要这些值。

运行命令、风险和验证限制见 [安全与隐私检查报告](SECURITY-PRIVACY-REPORT.md)。
