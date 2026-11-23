# 服务器部署说明

当前部署方式为 Docker Compose：Nginx 作为唯一 HTTP 入口，转发到 Vue 前端和 Express API；MySQL、公开媒体和游客私有附件分别使用持久卷。

操作步骤和需要人工确认的生产配置以 [上线检查清单](GO-LIVE-CHECKLIST.md) 为准；首次运行命令见 [README](../README.md#docker-首次部署)。

部署时注意：

- 正式服务必须使用 HTTPS，启用 `Secure` 管理员 Cookie，并将 `PUBLIC_SITE_URL` 配成规范站点 URL。
- 管理员初始账号只通过环境变量提供给一次性 `seed` 服务；`backend` 和 `maintenance` 不接收初始管理员密码。
- 公网不得直接暴露 MySQL、后端或前端容器端口；正确设置 `TRUST_PROXY` 和 CORS 来源。
- 每日备份数据库、公开媒体和私有附件；备份需加密、异地保存，并定期运行隔离库恢复演练。
- Docker 命令、`.env`、数据库备份及 Docker Socket 均属于可信运维边界；限制宿主机访问权限。
