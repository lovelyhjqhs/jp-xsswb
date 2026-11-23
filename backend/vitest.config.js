import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    // 先把测试库迁移到最新结构
    globalSetup: ['./tests/globalSetup.js'],
    // 注入测试环境变量（必须在业务模块加载前）
    setupFiles: ['./tests/setup/environment.js'],
    // 多个测试文件共用同一个 MySQL 库，串行执行避免互相清库
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 60000,
  },
});
