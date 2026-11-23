# 公网部署说明

这套站点不能只部署到 Vercel 或 Netlify：它还需要 Express API、MySQL，以及持久化的公开图片和私有附件卷。当前最稳妥的方式是把整套 Docker Compose 放到一台 Linux 云服务器上，再用 Caddy 提供公网 HTTPS。

## 目标结构

```text
访客浏览器
    │ HTTPS 443
    ▼
Caddy（自动证书）
    │ HTTP 127.0.0.1:8080
    ▼
项目 nginx
    ├── Vue 前端
    ├── Express API
    └── 上传图片
            ▼
          MySQL
```

公网只开放 `22`（最好限制来源 IP）、`80` 和 `443`。MySQL、后端、前端和项目 nginx 的 `8080` 端口都不直接对公网开放。

## 一、准备资源

需要：

- 一台 Linux 云服务器，建议 Ubuntu 24.04 LTS、2 核 4 GB 内存、40 GB 以上磁盘。
- 一个域名，并把 `A` 记录指向服务器公网 IP。
- 云防火墙放行 `80/tcp`、`443/tcp` 和受限来源的 SSH。
- 学校对网站内容、隐私政策和运维责任人的批准。

如果服务器在中国大陆，使用自己的域名通常需要完成 ICP 备案。学校域名、防火墙、等保或统一 Web 应用防火墙要求，应先向学校网络与信息化部门确认。

## 二、安装运行环境

以 Ubuntu 为例：

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-v2 caddy git unzip
sudo systemctl enable --now docker caddy
sudo usermod -aG docker "$USER"
```

执行完 `usermod` 后退出 SSH 再重新登录，让 Docker 用户组生效。

## 三、上传代码

推荐把代码放进一个私有 Git 仓库，然后在服务器上执行：

```bash
sudo mkdir -p /srv/jp-wiki
sudo chown "$USER":"$USER" /srv/jp-wiki
git clone <私有仓库地址> /srv/jp-wiki
cd /srv/jp-wiki
```

第一次还没有配置 Git 仓库时，也可以在 Windows 当前项目目录生成一个不含依赖、环境变量和上传数据的发布包：

```powershell
$releaseDir = Join-Path $env:TEMP "jp-wiki-release"
if (Test-Path -LiteralPath $releaseDir) {
    Remove-Item -LiteralPath $releaseDir -Recurse -Force
}
New-Item -ItemType Directory -Path $releaseDir | Out-Null
robocopy . $releaseDir /E /XD .git node_modules backups backend\uploads backend\private-uploads frontend\dist /XF .env
Compress-Archive -Path "$releaseDir\*" -DestinationPath ".\jp-wiki.zip" -Force
scp .\jp-wiki.zip ubuntu@服务器公网IP:/tmp/
```

然后在服务器解压：

```bash
sudo mkdir -p /srv/jp-wiki
sudo chown "$USER":"$USER" /srv/jp-wiki
unzip /tmp/jp-wiki.zip -d /srv/jp-wiki
cd /srv/jp-wiki
```

不要上传本机真实的 `.env`、`backups/` 或上传目录。生产环境需要一套独立的密钥和数据。

## 四、配置生产环境变量

```bash
cd /srv/jp-wiki
cp .env.docker.example .env
chmod 600 .env
```

生成三组互不相同的随机值，然后编辑 `.env`：

```bash
openssl rand -base64 48
openssl rand -hex 24
openssl rand -hex 24
nano .env
```

需要设置的关键项：

```dotenv
JWT_SECRET="上一步生成的至少 32 位随机值"
ADMIN_COOKIE_SECURE="true"

MYSQL_DATABASE="campus_lostfound"
MYSQL_USER="campus"
MYSQL_ROOT_PASSWORD="独立生成的数据库 root 密码"
MYSQL_PASSWORD="独立生成的数据库应用密码"

HTTP_PORT="127.0.0.1:8080"
PUBLIC_SITE_URL="https://wiki.example.edu.cn"
TRUST_PROXY=2

ENABLE_API_DOCS="false"
CORS_ORIGINS=""
LOG_LEVEL="info"
```

数据库密码建议使用生成的十六进制值。项目会直接把它拼进 `DATABASE_URL`，包含 `@`、`:`、`/` 等字符时可能破坏连接字符串。

`TRUST_PROXY=2` 对应「Caddy + 项目 nginx」两层代理，可让限流按真实访客 IP 计数。若去掉外层 Caddy、直接由项目 nginx 接收流量，应改为 `1`。

初始化管理员时只临时传入凭据，不要把管理员密码长期留在 `.env`：

```bash
read -r -p "管理员账号: " ADMIN_STUDENT_NO
read -r -p "管理员姓名 [系统管理员]: " ADMIN_NAME
read -r -s -p "管理员初始密码（16–72 个 UTF-8 字节）: " ADMIN_PASSWORD
echo
export ADMIN_STUDENT_NO ADMIN_NAME ADMIN_PASSWORD

docker compose --profile ops run --rm seed

unset ADMIN_STUDENT_NO ADMIN_NAME ADMIN_PASSWORD
```

管理员密码不要通过命令行参数传入，以免留在服务器 Shell 历史或进程列表中。

## 五、启动整套服务

```bash
cd /srv/jp-wiki
docker compose up -d --build
docker compose ps
```

本机验证：

```bash
curl -fsS http://127.0.0.1:8080/api/health
curl -fsSI http://127.0.0.1:8080/
```

健康接口应返回数据库状态为 `up`。如果后端未启动，先看：

```bash
docker compose logs --tail=200 migrate
docker compose logs --tail=200 backend
```

## 六、启用公网 HTTPS

确认域名的 `A` 记录已经指向服务器，并且云防火墙已放行 `80`、`443`。

编辑：

```bash
sudo nano /etc/caddy/Caddyfile
```

内容替换为：

```caddyfile
wiki.example.edu.cn {
	encode zstd gzip
	reverse_proxy 127.0.0.1:8080
}
```

检查并加载：

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl restart caddy
sudo journalctl -u caddy -n 100 --no-pager
```

验证公网站点：

```bash
curl -fsS https://wiki.example.edu.cn/api/health
curl -fsSI https://wiki.example.edu.cn/
curl -fsS https://wiki.example.edu.cn/robots.txt
```

HTTPS 正常后，再用浏览器检查管理员登录、投稿、图片上传、失物详情和管理后台。管理员 Cookie 是 `Secure` 的，HTTP 下无法正常登录，这是预期行为。

如果使用 Ubuntu 防火墙：

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

## 七、更新与日常运维

更新代码后重建：

```bash
cd /srv/jp-wiki
git pull --ff-only
docker compose up -d --build
docker compose ps
curl -fsS https://wiki.example.edu.cn/api/health
```

每天备份数据库和两个上传卷：

```bash
cd /srv/jp-wiki
docker compose --profile ops run --rm backup
```

可在 `crontab -e` 中加入：

```cron
30 2 * * * cd /srv/jp-wiki && docker compose --profile ops run --rm backup >> backups/backup.log 2>&1
```

`./backups` 只是本机备份，不能代替异地灾备。备份应加密后保存到另一台机器或对象存储，并定期执行 `restore-check` 验证。

## 八、上线前必须确认

- 只使用一套正式 `.env`，不要把本机管理员密码或数据库密码复制到公网。
- 只开放 `80/443`，MySQL、`3000` 和本机 `8080` 不对公网开放。
- `PUBLIC_SITE_URL` 与正式域名完全一致，HTTPS 证书有效。
- 只有唯一的专用管理员账号，并已设置足够强的密码。
- 管理员会话 Cookie、CSRF 检查、退出登录和后台未登录跳转全部正常。
- 公开列表不显示草稿、待审核、已删除记录或游客隐私字段。
- 已配置每日备份、异地保存和恢复演练。
- 已按 `docs/GO-LIVE-CHECKLIST.md` 完成权限、隐私和浏览器验收。
