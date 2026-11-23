#!/bin/sh
# Restore a backup into a dedicated empty verification database; never touches DB_NAME.
set -eu
umask 077

DB_HOST="${DB_HOST:-mysql}"
DB_PORT="${DB_PORT:-3306}"
DB_NAME="${DB_NAME:-campus_lostfound}"
DB_USER="${DB_USER:-root}"
RESTORE_TEST_DB="${RESTORE_TEST_DB:-${DB_NAME}_restore_check}"
BACKUP_FILE="${BACKUP_FILE:-}"
UPLOADS_BACKUP_FILE="${UPLOADS_BACKUP_FILE:-}"
PRIVATE_UPLOADS_BACKUP_FILE="${PRIVATE_UPLOADS_BACKUP_FILE:-}"

if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
  echo "[restore-check] 错误：BACKUP_FILE 必须指向现有 .sql.gz 备份" >&2
  exit 1
fi
if [ -z "${MYSQL_PWD:-}" ]; then
  echo "[restore-check] 错误：必须通过 MYSQL_PWD 提供数据库密码" >&2
  exit 1
fi
for db in "$DB_NAME" "$RESTORE_TEST_DB"; do
  case "$db" in
    ''|*[!A-Za-z0-9_]*) echo "[restore-check] 错误：数据库名格式不合法" >&2; exit 1 ;;
  esac
done
if [ "$RESTORE_TEST_DB" = "$DB_NAME" ]; then
  echo "[restore-check] 错误：恢复目标必须与生产数据库不同" >&2
  exit 1
fi
case "$RESTORE_TEST_DB" in
  mysql|information_schema|performance_schema|sys)
    echo "[restore-check] 错误：不能使用 MySQL 系统数据库作为恢复目标" >&2
    exit 1 ;;
esac
case "$RESTORE_TEST_DB" in
  "${DB_NAME}_restore_"*) ;;
  *) echo "[restore-check] 错误：恢复目标名称必须以 ${DB_NAME}_restore_ 开头" >&2; exit 1 ;;
esac
if ! gzip -t "$BACKUP_FILE"; then
  echo "[restore-check] 错误：备份 gzip 校验失败" >&2
  exit 1
fi
if [ -n "$UPLOADS_BACKUP_FILE" ] || [ -n "$PRIVATE_UPLOADS_BACKUP_FILE" ]; then
  if [ -z "$UPLOADS_BACKUP_FILE" ] || [ -z "$PRIVATE_UPLOADS_BACKUP_FILE" ]; then
    echo "[restore-check] 错误：公开媒体与私有附件备份路径必须同时提供" >&2
    exit 1
  fi
  backup_name=${BACKUP_FILE##*/}
  uploads_name=${UPLOADS_BACKUP_FILE##*/}
  private_name=${PRIVATE_UPLOADS_BACKUP_FILE##*/}
  case "$backup_name" in
    *.sql.gz) backup_base=${backup_name%.sql.gz} ;;
    *) echo "[restore-check] 错误：数据库备份必须以 .sql.gz 结尾" >&2; exit 1 ;;
  esac
  if [ "$uploads_name" != "${backup_base}-uploads.tar.gz" ] || [ "$private_name" != "${backup_base}-private-uploads.tar.gz" ]; then
    echo "[restore-check] 错误：数据库、公开媒体和私有附件必须来自同一时间戳备份集" >&2
    exit 1
  fi
fi

table_count="$(mysql --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" --batch --skip-column-names \
  --execute="SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${RESTORE_TEST_DB}'")"
if [ "$table_count" != "0" ]; then
  echo "[restore-check] 错误：目标库不是空库；请人工检查后选择新的 RESTORE_TEST_DB" >&2
  exit 1
fi

mysql --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" \
  --execute="CREATE DATABASE IF NOT EXISTS \`${RESTORE_TEST_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
gzip -dc "$BACKUP_FILE" | mysql --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" "$RESTORE_TEST_DB"
restored_tables="$(mysql --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" --batch --skip-column-names \
  --execute="SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${RESTORE_TEST_DB}'")"
if [ "$restored_tables" -lt 1 ]; then
  echo "[restore-check] 错误：恢复完成但没有发现数据表" >&2
  exit 1
fi
echo "[restore-check] 恢复成功：${BACKUP_FILE} -> ${RESTORE_TEST_DB}（${restored_tables} 张表）；生产库未修改"

verify_archive() {
  archive="$1"
  label="$2"
  if [ ! -f "$archive" ]; then
    echo "[restore-check] 错误：${label} 备份不存在" >&2
    return 1
  fi
  archive_list="$(mktemp)"
  archive_modes="$(mktemp)"
  restore_dir="$(mktemp -d)"
  if ! tar -tzf "$archive" > "$archive_list"; then
    rm -f "$archive_list"
    rm -f "$archive_modes"
    rm -rf "$restore_dir"
    echo "[restore-check] 错误：${label} 归档无法读取" >&2
    return 1
  fi
  if ! tar -tvzf "$archive" > "$archive_modes" || ! awk 'substr($0, 1, 1) != "-" && substr($0, 1, 1) != "d" { bad = 1 } END { exit bad }' "$archive_modes"; then
    rm -f "$archive_list" "$archive_modes"
    rm -rf "$restore_dir"
    echo "[restore-check] 错误：${label} 归档包含不支持的链接或特殊文件" >&2
    return 1
  fi
  if grep -Eq '(^/|(^|/)\.\.(/|$))' "$archive_list"; then
    rm -f "$archive_list" "$archive_modes"
    rm -rf "$restore_dir"
    echo "[restore-check] 错误：${label} 备份包含不安全路径" >&2
    return 1
  fi
  tar -xzf "$archive" -C "$restore_dir" --no-same-owner --no-same-permissions
  file_count="$(find "$restore_dir" -type f | wc -l | tr -d ' ')"
  rm -f "$archive_list" "$archive_modes"
  rm -rf "$restore_dir"
  echo "[restore-check] ${label} 恢复校验通过（${file_count} 个文件，临时目录已清理）"
}

if [ -n "$UPLOADS_BACKUP_FILE" ]; then
  verify_archive "$UPLOADS_BACKUP_FILE" "公开媒体"
  verify_archive "$PRIVATE_UPLOADS_BACKUP_FILE" "游客私有附件"
fi
