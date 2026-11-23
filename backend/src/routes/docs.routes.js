// 接口文档：把 docs/openapi.yaml 渲染成可读页面，并提供原始文件下载
//
// 为什么不用 swagger-ui：它（含 swagger-ui-dist）依赖会「上报安装」的 @scarf/scarf，
// 在一个专门做安全加固的项目里不值得为此引入遥测依赖。
// 这里生成的页面不加载任何外部资源、不含 JS，浏览器打开即读，
// 需要「Try it out」时把 YAML 导入 Apifox / Postman / Swagger Editor 即可。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Router } from 'express';
// js-yaml v5 是纯 ESM，只有具名导出（没有 default）
import { load as loadYaml } from 'js-yaml';

const here = path.dirname(fileURLToPath(import.meta.url));
const SPEC_PATH = path.resolve(here, '..', '..', 'docs', 'openapi.yaml');

const escapeHtml = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  );

let cache = null;
function loadSpec() {
  if (!cache) cache = loadYaml(fs.readFileSync(SPEC_PATH, 'utf8'));
  return cache;
}

const METHOD_ORDER = ['get', 'post', 'put', 'patch', 'delete'];

function renderParameters(parameters = []) {
  if (!parameters.length) return '';
  const rows = parameters
    .map(
      (parameter) => `
        <tr>
          <td><code>${escapeHtml(parameter.name)}</code></td>
          <td>${escapeHtml(parameter.in)}</td>
          <td>${parameter.required ? '必填' : '可选'}</td>
          <td>${escapeHtml(parameter.description || '')}</td>
        </tr>`,
    )
    .join('');

  return `
    <h4>参数</h4>
    <table class="params">
      <thead><tr><th>名称</th><th>位置</th><th>必填</th><th>说明</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function renderRequestBody(requestBody) {
  if (!requestBody) return '';
  const content = requestBody.content?.['application/json'];
  if (!content) return '';

  const example = content.example ?? content.schema?.example;
  const exampleBlock = example
    ? `<pre>${escapeHtml(JSON.stringify(example, null, 2))}</pre>`
    : '<p class="muted">请求体为 JSON。</p>';

  return `<h4>请求体${requestBody.required ? '（必填）' : ''}</h4>${exampleBlock}`;
}

function renderResponses(responses = {}) {
  const rows = Object.entries(responses)
    .map(
      ([status, response]) => `
        <tr>
          <td><code>${escapeHtml(status)}</code></td>
          <td>${escapeHtml(response.description || '')}</td>
        </tr>`,
    )
    .join('');

  return `
    <h4>响应</h4>
    <table class="params">
      <thead><tr><th>状态码</th><th>说明</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function renderSpec(spec) {
  const groups = new Map();

  for (const [routePath, operations] of Object.entries(spec.paths ?? {})) {
    for (const method of METHOD_ORDER) {
      const operation = operations[method];
      if (!operation) continue;

      const tag = operation.tags?.[0] ?? 'default';
      if (!groups.has(tag)) groups.set(tag, []);
      groups.get(tag).push({ routePath, method, operation, pathParameters: operations.parameters });
    }
  }

  const sections = [...groups.entries()]
    .map(([tag, operations]) => {
      const items = operations
        .map(({ routePath, method, operation, pathParameters }) => {
          const auth = operation.security?.length ? '需要登录' : '公开';
          return `
            <details class="op">
              <summary>
                <span class="method ${method}">${method.toUpperCase()}</span>
                <code class="path">${escapeHtml(routePath)}</code>
                <span class="summary">${escapeHtml(operation.summary || '')}</span>
                <span class="auth">${escapeHtml(auth)}</span>
              </summary>
              <div class="op-body">
                ${operation.description ? `<p>${escapeHtml(operation.description)}</p>` : ''}
                ${renderParameters([...(pathParameters ?? []), ...(operation.parameters ?? [])])}
                ${renderRequestBody(operation.requestBody)}
                ${renderResponses(operation.responses)}
              </div>
            </details>`;
        })
        .join('');

      return `
        <section>
          <h2>${escapeHtml(tag)}</h2>
          ${items}
        </section>`;
    })
    .join('');

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(spec.info?.title ?? 'API 文档')}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 24px 16px 64px; background: #f4f7fb; color: #1f2430;
         font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
         font-size: 14px; line-height: 1.6; }
  main { max-width: 1000px; margin: 0 auto; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 17px; margin: 28px 0 10px; }
  h4 { font-size: 13px; margin: 14px 0 6px; color: #5b6675; }
  .meta { color: #5b6675; font-size: 13px; margin: 0 0 16px; }
  .card { background: #fff; border: 1px solid #e9eef6; border-radius: 12px; padding: 16px 18px; }
  .op { background: #fff; border: 1px solid #e9eef6; border-radius: 10px; margin-bottom: 8px; }
  .op summary { display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
                padding: 10px 14px; cursor: pointer; list-style: none; }
  .op summary::-webkit-details-marker { display: none; }
  .method { display: inline-block; min-width: 58px; padding: 1px 8px; border-radius: 6px;
            font-size: 12px; font-weight: 700; text-align: center; color: #fff; }
  .method.get { background: #2f9e6b; }
  .method.post { background: #2f6fed; }
  .method.put { background: #d9903a; }
  .method.patch { background: #7a5af0; }
  .method.delete { background: #e8554d; }
  .path { font-size: 13px; }
  .summary { color: #5b6675; font-size: 13px; }
  .auth { margin-left: auto; font-size: 12px; color: #93a0b0; }
  .op-body { padding: 0 14px 14px; border-top: 1px solid #eef2f8; }
  table.params { width: 100%; border-collapse: collapse; font-size: 13px; }
  table.params th, table.params td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #eef2f8; }
  table.params th { color: #93a0b0; font-weight: 600; }
  pre { margin: 0; padding: 10px 12px; background: #f7f9fe; border-radius: 8px;
        font-size: 12px; overflow-x: auto; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  .muted { color: #93a0b0; }
  a { color: #2f6fed; }
</style>
</head>
<body>
<main>
  <div class="card">
    <h1>${escapeHtml(spec.info?.title ?? 'API 文档')}</h1>
    <p class="meta">版本 ${escapeHtml(spec.info?.version ?? '-')} · ${escapeHtml(spec.info?.description ?? '')}</p>
    <p class="meta">
      原始文件：<a href="/api/docs/openapi.yaml">openapi.yaml</a> ·
      <a href="/api/docs/openapi.json">openapi.json</a>
      （可导入 Apifox / Postman / Swagger Editor 调试）
    </p>
  </div>
  ${sections}
</main>
</body>
</html>`;
}

const router = Router();

router.get('/', (_req, res) => {
  const spec = loadSpec();
  // 这个页面没有脚本、不加载外部资源，因此可以给一条很严的 CSP
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
  res.type('html').send(renderSpec(spec));
});

router.get('/openapi.yaml', (_req, res) => {
  res.type('text/yaml; charset=utf-8').send(fs.readFileSync(SPEC_PATH, 'utf8'));
});

router.get('/openapi.json', (_req, res) => {
  res.json(loadSpec());
});

export default router;
