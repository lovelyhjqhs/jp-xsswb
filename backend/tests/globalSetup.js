// Vitest 全局初始化：把迁移应用到测试库，并在全部用例结束后清理测试上传目录。
// 使用独立的 campus_lostfound_test 库，避免污染开发数据；
// 该库需先创建，见 README「测试」一节（npm run test:db:init）。
import { execSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { TEST_DATABASE_URL, TEST_ENV } from './test-env.js';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export default function setup() {
  execSync('npx prisma migrate deploy', {
    cwd: backendRoot,
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    // Windows 下 npx 是 .cmd，需要 shell 才能执行
    shell: true,
  });

  // 返回 teardown：清理隔离测试图片目录，不触碰开发或生产上传卷。
  return async () => {
    for (const directory of [TEST_ENV.UPLOAD_DIR, TEST_ENV.PRIVATE_UPLOAD_DIR]) {
      if (!['uploads-test', 'private-uploads-test'].includes(directory)) continue;
      const uploadRoot = path.resolve(backendRoot, directory);
      await fs.rm(uploadRoot, { recursive: true, force: true });
    }
  };
}
