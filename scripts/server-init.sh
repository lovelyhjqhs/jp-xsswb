#!/usr/bin/env bash
# 新服务器一键初始化（Ubuntu 22.04 / 24.04，Debian 12 亦可）
#
# 用法（在服务器上）：
#   scp scripts/server-init.sh user@server:/tmp/
#   sudo bash /tmp/server-init.sh
#
# 做完这一步：Docker 装好并开机自启、低内存机器自动加 swap、防火墙只放 22/80/443。
# 之后进入项目目录执行 `docker compose up -d --build` 即可。
set -euo pipefail

log() { printf '\n\033[1;34m==> %s\033[0m\n' "$1"; }

if [ "$(id -u)" -ne 0 ]; then
  echo "请用 sudo 运行：sudo bash $0" >&2
  exit 1
fi

# ---------- 1. 基础工具 ----------
log "安装基础工具"
apt-get update -y
apt-get install -y --no-install-recommends ca-certificates curl git gnupg ufw

# ---------- 2. Docker ----------
log "安装 Docker"
if command -v docker >/dev/null 2>&1; then
  echo "已安装：$(docker --version)"
else
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker

# 校验 compose 插件（compose v2 随 docker 安装）
if ! docker compose version >/dev/null 2>&1; then
  log "补装 docker compose 插件"
  apt-get install -y docker-compose-plugin || {
    echo "docker compose 插件安装失败，请手动安装后重试" >&2
    exit 1
  }
fi

# ---------- 3. swap（2G/4G 机器跑 MySQL + Node 容易 OOM） ----------
log "检查内存与 swap"
mem_mb=$(awk '/MemTotal/ {printf "%d", $2/1024}' /proc/meminfo)
echo "内存：${mem_mb} MB"

if [ "$mem_mb" -lt 3584 ] && [ ! -f /swapfile ]; then
  echo "内存不足 3.5G，创建 2G swap"
  if ! fallocate -l 2G /swapfile 2>/dev/null; then
    dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none
  fi
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >>/etc/fstab
  # 50 的 swappiness：优先用内存，内存紧张时才换出
  sysctl -q -w vm.swappiness=50
  echo "已启用 2G swap"
else
  echo "swap 已存在或内存充足，跳过"
fi

# ---------- 4. 防火墙 ----------
log "配置防火墙（只放行 SSH / HTTP / HTTPS）"
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
ufw status verbose

# ---------- 5. 结果 ----------
log "初始化完成"
echo "Docker：$(docker --version)"
echo "Compose：$(docker compose version --short 2>/dev/null || echo '?')"
echo
echo "下一步："
echo "  git clone <仓库地址> /srv/campus-lostfound && cd /srv/campus-lostfound"
echo "  cp .env.docker.example .env && vi .env     # 填 JWT_SECRET / 数据库密码 / 管理员密码"
echo "  docker compose up -d --build"
echo "  curl http://127.0.0.1:8080/api/health"
