#!/usr/bin/env node
/* 电商作战室 · 本地服务 + LLM 代理（部署为 Node 应用时也用它）
 * 作用：① 静态托管 ② 把 /api/llm 转发到真实接口，解决浏览器 CORS 并由服务端保管 Key（Key 不落浏览器）
 * 启动： node server.js
 * 环境变量（不设置也能跑静态托管，只是 /api/llm 会提示未配置）：
 *   LLM_BASE_URL  （默认已填通义千问兼容端点；可改成 DeepSeek/OpenAI 等）
 *   LLM_API_KEY   （必填，你的模型密钥；部署后在平台环境变量里设置，切勿写进代码）
 *   PORT          （托管平台会自动注入，本地默认 3000）
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = process.env.PORT || 3000;
// 默认通义千问兼容模式；如需换厂商，设 LLM_BASE_URL 环境变量覆盖即可
const LLM_BASE_URL = (process.env.LLM_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1').replace(/\/+$/, '');
const LLM_API_KEY = process.env.LLM_API_KEY || '';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.md': 'text/markdown; charset=utf-8'
};

function safeEnd(res, status, body, headers) {
  try {
    if (res.headersSent) return;
    res.writeHead(status, headers || { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(body);
  } catch (e) { /* ignore double-end */ }
}

function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(ROOT, path.normalize(urlPath));
  req.on('error', () => safeEnd(res, 400, 'Bad Request'));
  res.on('error', () => {});
  if (!filePath.startsWith(ROOT)) { return safeEnd(res, 403, 'Forbidden'); }
  fs.readFile(filePath, (err, data) => {
    if (err) { return safeEnd(res, 404, 'Not Found'); }
    safeEnd(res, 200, data, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
  });
}

function proxyLLM(req, res) {
  req.on('error', () => safeEnd(res, 400, JSON.stringify({ error: { message: '请求读取失败' } }), { 'Content-Type': 'application/json' }));
  res.on('error', () => {});
  if (!LLM_BASE_URL || !LLM_API_KEY) {
    return safeEnd(res, 500, JSON.stringify({ error: { message: '服务端未配置 LLM_BASE_URL / LLM_API_KEY，请在环境变量中设置后重启 server.js' } }), { 'Content-Type': 'application/json' });
  }
  let body = '';
  req.on('data', c => body += c);
  req.on('end', async () => {
    try {
      const r = await fetch(LLM_BASE_URL + '/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + LLM_API_KEY },
        body
      });
      const text = await r.text();
      safeEnd(res, r.status, text, { 'Content-Type': 'application/json' });
    } catch (e) {
      safeEnd(res, 502, JSON.stringify({ error: { message: '代理转发失败：' + e.message } }), { 'Content-Type': 'application/json' });
    }
  });
}

const server = http.createServer((req, res) => {
  req.on('error', () => safeEnd(res, 400, 'Bad Request'));
  res.on('error', () => {});
  try {
    if (req.method === 'POST' && req.url.split('?')[0] === '/api/llm') return proxyLLM(req, res);
    if (req.method === 'GET' && req.url.split('?')[0] === '/api/health') {
      return safeEnd(res, 200, JSON.stringify({ ok: true, llmConfigured: !!(LLM_BASE_URL && LLM_API_KEY) }), { 'Content-Type': 'application/json' });
    }
    serveStatic(req, res);
  } catch (e) {
    console.error('Unhandled request error:', e.message);
    safeEnd(res, 500, 'Internal Server Error');
  }
});

process.on('uncaughtException', (e) => console.error('uncaughtException:', e.message));
process.on('unhandledRejection', (e) => console.error('unhandledRejection:', e && e.message));

server.listen(PORT, '0.0.0.0', () => {
  console.log('电商作战室 → http://0.0.0.0:' + PORT);
  console.log('Version: v1.9.1');
  console.log(LLM_BASE_URL && LLM_API_KEY ? '✓ LLM 代理已就绪（/api/llm）' : '· 未配置 LLM 环境变量，仅静态托管');
});
