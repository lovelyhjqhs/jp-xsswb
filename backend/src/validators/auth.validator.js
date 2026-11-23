// 认证相关入参校验。学号格式由 .env 的 STUDENT_NO_REGEX 决定。
import { z } from 'zod';
import { env } from '../config/env.js';
import { PASSWORD_MESSAGE, PASSWORD_RULE } from '../utils/password.js';

// 编译一次复用；env.js 已保证它是合法正则
const studentNoPattern = new RegExp(env.STUDENT_NO_REGEX);

const studentNoField = z
  .string({ error: '请输入学号' })
  .trim()
  .min(1, '请输入学号')
  .regex(studentNoPattern, `学号格式不正确（当前规则：${env.STUDENT_NO_REGEX}）`);

const passwordField = z
  .string({ error: '请输入密码' })
  .regex(PASSWORD_RULE, PASSWORD_MESSAGE);

export const registerSchema = z
  .object({
    studentNo: studentNoField,
    name: z
      .string({ error: '请输入姓名' })
      .trim()
      .min(1, '请输入姓名')
      .max(30, '姓名最多 30 个字符'),
    password: passwordField,
    confirmPassword: z.string({ error: '请再次输入密码' }).min(1, '请再次输入密码'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: '两次输入的密码不一致',
    path: ['confirmPassword'],
  });

// 登录只做「非空」校验，不套学号正则：
// 规则若调整过，老账号仍应能登录，不至于被新规则卡在门外。
export const loginSchema = z.object({
  studentNo: z.string({ error: '请输入学号' }).trim().min(1, '请输入学号'),
  password: z.string({ error: '请输入密码' }).min(1, '请输入密码'),
});

export const adminLoginSchema = z.object({
  studentNo: z.string({ error: '请输入管理员账号' }).trim().min(1, '请输入管理员账号').max(80),
  password: z.string({ error: '请输入密码' }).min(1, '请输入密码').max(200)
    .refine((value) => Buffer.byteLength(value, 'utf8') <= 72, '密码长度超出支持范围'),
});

export const changePasswordSchema = z
  .object({
    oldPassword: z.string({ error: '请输入原密码' }).min(1, '请输入原密码'),
    newPassword: passwordField,
    // 可选：前端表单会传，curl 手动调用可以不传
    confirmPassword: z.string().optional(),
  })
  .refine(
    (data) => data.confirmPassword === undefined || data.confirmPassword === data.newPassword,
    { message: '两次输入的新密码不一致', path: ['confirmPassword'] },
  )
  .refine((data) => data.oldPassword !== data.newPassword, {
    message: '新密码不能与原密码相同',
    path: ['newPassword'],
  });
