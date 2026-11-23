// 在测试文件加载业务模块之前注入测试环境变量。
import { TEST_ENV } from '../test-env.js';

Object.assign(process.env, TEST_ENV);
