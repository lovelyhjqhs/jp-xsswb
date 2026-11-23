import request from 'supertest';
import { createApp } from '../../src/app.js';

/** 每次调用创建一个 app 实例，避免测试之间共享中间件内部状态 */
export const api = () => request(createApp());
