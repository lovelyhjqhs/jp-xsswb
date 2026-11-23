import * as site from '../../services/admin/site.admin.service.js';
import { success } from '../../utils/response.js';

export async function profile(req, res) { return success(res, await site.getProfile()); }
export async function saveProfile(req, res) { return success(res, await site.saveProfile({ payload: req.body, adminId: req.user.id }), '已保存为草稿'); }
export async function profileAction(req, res) { return success(res, await site.changeProfile(req.params.action, req.user.id), '操作成功'); }

export async function newsList(req, res) { return success(res, await site.listNews(req.validatedQuery)); }
export async function newsDetail(req, res) { return success(res, await site.getNews(req.validatedParams.id)); }
export async function newsSave(req, res) { return success(res, await site.saveNews({ id: req.validatedParams?.id, payload: req.body, adminId: req.user.id }), '已保存为草稿', req.validatedParams?.id ? 200 : 201); }
export async function newsAction(req, res) { return success(res, await site.changeNews(req.params.action, req.validatedParams.id, req.user.id), '操作成功'); }

export async function reportList(req, res) { return success(res, await site.listReports(req.validatedQuery)); }
export async function reportSave(req, res) { return success(res, await site.saveReport({ id: req.validatedParams?.id, payload: req.body, adminId: req.user.id }), '已保存为草稿', req.validatedParams?.id ? 200 : 201); }
export async function reportAction(req, res) { return success(res, await site.changeReport(req.params.action, req.validatedParams.id, req.user.id), '操作成功'); }
export async function reportPhotos(req, res) { return success(res, await site.setReportPhotos({ reportId: req.validatedParams.id, mediaIds: req.body.mediaIds, adminId: req.user.id }), '照片已更新'); }

export async function recycleList(req, res) { return success(res, await site.recycleBin(req.validatedQuery)); }
export async function recycleRestore(req, res) { return success(res, await site.restoreDeleted(req.validatedParams.type, req.validatedParams.id, req.user.id), '已恢复'); }
