// ESLint 扁平配置（ESLint 10）
// 后端跑在 Node，前端跑在浏览器，因此按目录切换 globals。
import js from '@eslint/js';
import globals from 'globals';
import pluginVue from 'eslint-plugin-vue';

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      'backend/uploads*/**',
      'backend/prisma/migrations/**',
    ],
  },
  js.configs.recommended,
  // 只取 essential 规则集：保证正确性，不引入格式化风格规则
  ...pluginVue.configs['flat/essential'],
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      // 未使用变量只提示，避免开发期打断编码；以 _ 开头的参数放行
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // 后端启动/seed 脚本需要控制台输出
      'no-console': 'off',
      eqeqeq: ['warn', 'smart'],
      'prefer-const': 'warn',
    },
  },
  {
    // 前端同时包含 .js 与 .vue
    files: ['frontend/**/*.{js,vue}'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { ...globals.browser },
    },
    rules: {
      'vue/multi-word-component-names': 'error',
      // 组件 props 的解构/未使用变量同样只提示
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
];
