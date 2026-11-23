#!/bin/sh
# MySQL 与上传卷每日备份脚本
#
# 特性：
#   - 用 mysqldump --single-transaction 做一致性快照（不锁表）
#   - 先写临时文件，成功且体积合理才改名，避免留下半个备份
#   - 同步归档公开媒体与游客私有附件卷
#   - 自动轮转时保留同一时间戳的数据库与文件备份
#   - 自动轮转，只保留最近 N 份（默认 7）
#   - 密码通过 MYSQL_PWD 传入，不出现在命令行参数 / 进程列表里
#
# 用法（容器内）：
#   docker compose --profile ops run --rm backup
#
# 用法（宿主机 crontab，每天 02:30）：
#   30 2 * * * cd /srv/campus-lostfound && docker compose --profile ops run --rm backup >> backups/backup.log 2>&1
#
# 可用环境变量：DB_HOST DB_PORT DB_NAME DB_USER MYSQL_PWD BACKUP_DIR BACKUP_KEEP
set -eu
umask 077

DB_HOST="${DB_HOST:-mysql}"
DB_PORT="${DB_PORT:-3306}"
DB_NAME="${DB_NAME:-campus_lostfound}"
DB_USER="${DB_USER:-campus}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
BACKUP_KEEP="${BACKUP_KEEP:-7}"

case "$DB_NAME" in
  ''|*[!A-Za-z0-9_]*) echo "[backup] 错误：DB_NAME 格式不合法" >&2; exit 1 ;;
esac
case "$BACKUP_KEEP" in
  ''|*[!0-9]*) echo "[backup] 错误：BACKUP_KEEP 必须是正整数" >&2; exit 1 ;;
esac
[ "$BACKUP_KEEP" -ge 1 ] || { echo "[backup] 错误：BACKUP_KEEP 必须大于 0" >&2; exit 1; }

if [ -z "${MYSQL_PWD:-}" ]; then
  echo "[backup] 错误：必须通过 MYSQL_PWD 提供密码（避免密码出现在命令行里）" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

stamp="$(date -u +%Y%m%d-%H%M%S)"
final_file="$BACKUP_DIR/${DB_NAME}-${stamp}.sql.gz"
tmp_file="${final_file}.part"
sql_plain_tmp="$BACKUP_DIR/${DB_NAME}-${stamp}.sql.part"
uploads_final="$BACKUP_DIR/${DB_NAME}-${stamp}-uploads.tar.gz"
private_final="$BACKUP_DIR/${DB_NAME}-${stamp}-private-uploads.tar.gz"
backup_complete=0

cleanup_backup() {
  rm -f "$tmp_file" "$sql_plain_tmp" "${uploads_final}.part" "${private_final}.part"
  if [ "$backup_complete" -ne 1 ]; then
    rm -f "$final_file" "$uploads_final" "$private_final"
  fi
}
trap cleanup_backup EXIT

echo "[backup] $(date -Is) 开始备份 ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

if ! mysqldump \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --user="$DB_USER" \
  --single-transaction \
  --quick \
  --routines \
  --events \
  --no-tablespaces \
  --default-character-set=utf8mb4 \
  "$DB_NAME" > "$sql_plain_tmp"; then
  echo "[backup] 备份失败，已清理临时文件" >&2
  exit 1
fi
gzip -9 < "$sql_plain_tmp" > "$tmp_file"
rm -f "$sql_plain_tmp"

size=$(wc -c < "$tmp_file" | tr -d ' ')
if [ "$size" -lt 200 ]; then
  echo "[backup] 备份文件异常（${size} 字节），丢弃" >&2
  rm -f "$tmp_file"
  exit 1
fi

mv "$tmp_file" "$final_file"
echo "[backup] 完成：${final_file}（$((size / 1024)) KB）"

for entry in "uploads:/source/uploads" "private-uploads:/source/private-uploads"; do
  name="${entry%%:*}"
  source_dir="${entry#*:}"
  archive="$BACKUP_DIR/${DB_NAME}-${stamp}-${name}.tar.gz"
  archive_tmp="${archive}.part"
  if [ ! -d "$source_dir" ]; then
    echo "[backup] 错误：上传卷目录不存在：$source_dir" >&2
    exit 1
  fi
  tar -czf "$archive_tmp" -C "$source_dir" .
  archive_size=$(wc -c < "$archive_tmp" | tr -d ' ')
  if [ "$archive_size" -lt 20 ]; then
    echo "[backup] 错误：上传卷备份异常（${archive_size} 字节）" >&2
    rm -f "$archive_tmp"
    exit 1
  fi
  mv "$archive_tmp" "$archive"
  echo "[backup] 完成：${archive}（$((archive_size / 1024)) KB）"
done
backup_complete=1
echo "[backup] 数据库、公开媒体和私有附件的备份集已完成（时间戳 ${stamp}）"

# ---------- 轮转：只保留最近 BACKUP_KEEP 份 ----------
set -- "$BACKUP_DIR"/*.sql.gz
if [ -f "$1" ]; then
  remove_count=$(($# - BACKUP_KEEP))
  while [ "$remove_count" -gt 0 ]; do
    file="$1"
    shift
    echo "[backup] 删除过期备份 $file"
    rm -f "$file"
    base="${file%.sql.gz}"
    rm -f "${base}-uploads.tar.gz" "${base}-private-uploads.tar.gz"
    remove_count=$((remove_count - 1))
  done
fi

set -- "$BACKUP_DIR"/*.sql.gz
if [ -f "$1" ]; then kept_count=$#; else kept_count=0; fi
echo "[backup] 当前保留 ${BACKUP_KEEP} 份上限内的备份，实际 ${kept_count} 份"
