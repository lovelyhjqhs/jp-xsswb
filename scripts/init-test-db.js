import { spawnSync } from 'node:child_process';

const result = spawnSync(
  'docker',
  [
    'compose',
    'exec',
    '-T',
    'mysql',
    'sh',
    '-c',
    'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot -e "CREATE DATABASE IF NOT EXISTS campus_lostfound_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"',
  ],
  { stdio: 'inherit' },
);

if (result.error) {
  process.stderr.write('无法执行 Docker Compose 测试库初始化，请确认 Docker 已启动。\n');
  process.exit(1);
}

process.exit(result.status ?? 1);
