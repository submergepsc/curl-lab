/** Cloudflare Workers + static assets implementation of CURL LAB (no Node.js APIs). */
const MAX_BODY = 2 * 1024 * 1024;
const MAX_DOWNLOAD = 1024 * 1024;
const TEXT = new TextEncoder();
const DEFAULT_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
};
const REDACT = new Set(['authorization', 'cookie', 'proxy-authorization', 'x-api-key', 'cf-access-jwt-assertion', 'x-auth-token']);
const STATUS_TEXT = {
  200:'OK',201:'Created',202:'Accepted',204:'No Content',301:'Moved Permanently',302:'Found',304:'Not Modified',
  400:'Bad Request',401:'Unauthorized',403:'Forbidden',404:'Not Found',405:'Method Not Allowed',408:'Request Timeout',
  418:"I'm a Teapot",422:'Unprocessable Content',429:'Too Many Requests',500:'Internal Server Error',502:'Bad Gateway',
  503:'Service Unavailable',504:'Gateway Timeout',
};
const ALLOWED_STATUS = new Set(Object.keys(STATUS_TEXT).map(Number));

function response(request, status, payload = {}, headers = {}) {
  const body = (status === 204 || status === 304 || request.method === 'HEAD')
    ? null : JSON.stringify(payload, null, 2) + '\n';
  return new Response(body, {
    status,
    headers: { ...DEFAULT_HEADERS, 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}

function rawResponse(request, status, body, headers = {}) {
  return new Response(request.method === 'HEAD' || status === 204 || status === 304 ? null : body, {
    status,
    headers: { ...DEFAULT_HEADERS, ...headers },
  });
}

function safeHeaders(headers) {
  return Object.fromEntries([...headers.entries()].map(([key, value]) => [key, REDACT.has(key.toLowerCase()) ? '[REDACTED]' : value]));
}

function baseInfo(request, url, extra = {}) {
  return {
    method: request.method,
    path: url.pathname,
    query: Object.fromEntries(url.searchParams),
    headers: safeHeaders(request.headers),
    protocol: url.protocol.replace(':', ''),
    clientIp: request.headers.get('CF-Connecting-IP') || null,
    note: '运行在 Cloudflare Workers；HTTP 协议版本由访客与 Cloudflare 边缘协商',
    ...extra,
  };
}

async function readBody(request) {
  if (Number(request.headers.get('content-length') || '0') > MAX_BODY) {
    throw Object.assign(new Error('请求体超过 2 MiB 限额'), { status: 413 });
  }
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY) {
        await reader.cancel().catch(() => {});
        throw Object.assign(new Error('请求体超过 2 MiB 限额'), { status: 413 });
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const data = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.byteLength; }
  return data;
}

function bytesToBase64(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function decodeBody(data, contentType) {
  const str = new TextDecoder().decode(data);
  if (contentType.includes('application/json')) {
    try { return { json: JSON.parse(str) }; }
    catch { return { text: str.slice(0, 4096), warning: '无效 JSON，按文本展示' }; }
  }
  if (contentType.includes('application/x-www-form-urlencoded')) {
    return { form: Object.fromEntries(new URLSearchParams(str)) };
  }
  if (contentType.includes('multipart/form-data')) {
    try {
      const fake = new Request('https://lab.invalid/', { method: 'POST', headers: { 'Content-Type': contentType }, body: data });
      const form = await fake.formData();
      const parts = [];
      for (const [name, value] of form.entries()) {
        if (parts.length >= 30) break;
        if (typeof value === 'string') parts.push({ name, sizeBytes: TEXT.encode(value).byteLength, value: value.slice(0, 512) });
        else parts.push({ name, filename: value.name.replaceAll('\\', '/').split('/').pop(), contentType: value.type || null, sizeBytes: value.size, note: '只读取元数据，不保存文件' });
      }
      return { parts };
    } catch { return { error: '无法解析 multipart/form-data，请检查 boundary' }; }
  }
  if (contentType.startsWith('text/') || !contentType) return { text: str.slice(0, 4096) };
  return { bytes: data.length, previewBase64: bytesToBase64(data.slice(0, 64)) };
}

function parseCookies(str = '') {
  return Object.fromEntries(str.split(';').map(x => x.trim()).filter(Boolean).map(x => {
    const i = x.indexOf('='); return [i < 0 ? x : x.slice(0, i), i < 0 ? '' : x.slice(i + 1)];
  }));
}

async function api(request, url) {
  const method = request.method;
  const p = url.pathname;
  const requestId = crypto.randomUUID().slice(0, 8);
  const send = (status, data = {}, headers = {}) => response(request, status, data, { 'X-Lab-Request-ID': requestId, ...headers });
  const raw = (status, body, headers = {}) => rawResponse(request, status, body, { 'X-Lab-Request-ID': requestId, ...headers });
  const body = async () => decodeBody(await readBody(request), request.headers.get('content-type') || '');
  try {
    if (p === '/api/health') return send(200, { ok: true, service: 'curl-lab-cloudflare', runtime: 'Cloudflare Workers', time: new Date().toISOString(), requestId });
    if (p === '/api/get' && ['GET', 'HEAD'].includes(method)) return send(200, baseInfo(request, url, { message: 'GET 请求成功', requestId }));
    if (p === '/api/ip' && method === 'GET') return send(200, { clientIp: request.headers.get('CF-Connecting-IP') || null, country: request.cf?.country || null, note: 'Cloudflare 边缘观测的客户端 IP；使用代理时可能显示代理的出口 IP' });
    if (p === '/api/headers' && method === 'GET') return send(200, { headers: safeHeaders(request.headers), notice: '认证、Cookie 和 Access Token 等敏感字段已隐藏' });
    if (p === '/api/user-agent' && method === 'GET') return send(200, { userAgent: request.headers.get('user-agent') });
    if (p === '/api/echo' && ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const bytes = await readBody(request);
      return send(200, baseInfo(request, url, { bodyLength: bytes.byteLength, body: await decodeBody(bytes, request.headers.get('content-type') || '') }));
    }
    if (p === '/api/method' && ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return send(200, { method, message: `服务器收到了 ${method} 请求`, parsed: await body() });
    if (p === '/api/options' && method === 'OPTIONS') return raw(204, null, { Allow: 'GET, HEAD, OPTIONS', 'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS' });
    if (p === '/api/options' && ['GET', 'HEAD'].includes(method)) return send(200, { tip: '使用 curl -i -X OPTIONS /api/options 查看 Allow' }, { Allow: 'GET, HEAD, OPTIONS' });
    if (p === '/api/basic-auth') {
      const input = request.headers.get('authorization') || '';
      let authorized = false;
      if (input.startsWith('Basic ')) {
        try { authorized = atob(input.slice(6)) === 'alice:demo123'; } catch { /* invalid base64 */ }
      }
      return authorized ? send(200, { authenticated: true, method: 'Basic', username: 'alice' })
        : send(401, { authenticated: false, message: '演示账号 alice / demo123，请勿输入真实密码' }, { 'WWW-Authenticate': 'Basic realm="curl-lab"' });
    }
    if (p === '/api/bearer') {
      const authorized = request.headers.get('authorization') === 'Bearer lab-token';
      return authorized ? send(200, { authenticated: true, method: 'Bearer', message: '演示 token 有效' })
        : send(401, { authenticated: false, message: '演示 token 为 lab-token' }, { 'WWW-Authenticate': 'Bearer realm="curl-lab"' });
    }
    if (p === '/api/cookies') return send(200, { cookies: parseCookies(request.headers.get('cookie') || ''), note: '仅用于演示，勿发送其他网站的 Cookie' });
    if (p === '/api/cookies/set') {
      const name = url.searchParams.get('name') || 'theme';
      const value = url.searchParams.get('value') || 'dark';
      if (!/^[A-Za-z0-9_-]{1,32}$/.test(name) || !/^[A-Za-z0-9_-]{1,64}$/.test(value)) return send(400, { error: 'name/value 只允许字母、数字、下划线和连字符，且长度受限' });
      return send(200, { set: { [name]: value }, tip: '配合 curl -c cookies.txt 保存 Cookie' }, { 'Set-Cookie': `${name}=${value}; Path=/api; SameSite=Lax; HttpOnly; Secure` });
    }
    if (p === '/api/cookies/delete') return send(200, { deleted: 'theme' }, { 'Set-Cookie': 'theme=; Path=/api; Max-Age=0; SameSite=Lax; HttpOnly; Secure' });
    if (p.startsWith('/api/status/')) {
      const code = Number(p.slice('/api/status/'.length));
      if (!ALLOWED_STATUS.has(code)) return send(400, { error: '不支持的演示状态码', supported: [...ALLOWED_STATUS] });
      if (code === 301 || code === 302) return send(code, { status: code, redirect: '/api/get' }, { Location: '/api/get' });
      if (code === 204 || code === 304) return raw(code, null);
      return send(code, { status: code, message: STATUS_TEXT[code] });
    }
    if (p === '/api/redirect') {
      const count = Number(url.searchParams.get('count') ?? '2');
      if (!Number.isInteger(count) || count < 0 || count > 8) return send(400, { error: 'count 必须是 0..8 的整数' });
      return count === 0 ? send(200, { redirectCompleted: true, message: '已到达跳转链终点' })
        : send(302, { left: count }, { Location: `/api/redirect?count=${count - 1}` });
    }
    if (p === '/api/redirect-loop') return send(302, { message: '故意循环跳转，请使用 --max-redirs 限制' }, { Location: '/api/redirect-loop' });
    if (p.startsWith('/api/delay/')) {
      const seconds = Number(p.slice('/api/delay/'.length));
      if (!Number.isFinite(seconds) || seconds < 0 || seconds > 8) return send(400, { error: '延迟只能在 0..8 秒内' });
      await new Promise(resolve => setTimeout(resolve, seconds * 1000));
      return send(200, { delayedSeconds: seconds, message: '延迟结束' });
    }
    if (p === '/api/compress') {
      const data = TEXT.encode(JSON.stringify({ message: 'Accept-Encoding 与 gzip 压缩实验', repeated: 'curl-lab '.repeat(500) }));
      const wantsGzip = /\bgzip\b/i.test(request.headers.get('accept-encoding') || '');
      if (wantsGzip) {
        const gz = new Blob([data]).stream().pipeThrough(new CompressionStream('gzip'));
        return raw(200, gz, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' });
      }
      return raw(200, data, { 'Content-Type': 'application/json; charset=utf-8', Vary: 'Accept-Encoding', 'Content-Length': String(data.length) });
    }
    if (p === '/api/download') {
      const size = Number(url.searchParams.get('size') || '65536');
      if (!Number.isInteger(size) || size < 1 || size > MAX_DOWNLOAD) return send(400, { error: 'size 必须是 1..1048576 字节' });
      const name = (url.searchParams.get('name') || 'curl-lab.bin').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 60) || 'curl-lab.bin';
      const buffer = new Uint8Array(size);
      for (let i = 0; i < buffer.length; i++) buffer[i] = (i * 31 + 7) % 256;
      let start = 0; let end = size - 1; let status = 200;
      const range = request.headers.get('range');
      if (range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(range);
        if (!match || (!match[1] && !match[2])) return send(416, { error: '只支持单个字节范围' }, { 'Content-Range': `bytes */${size}` });
        if (!match[1]) {
          const suffix = Number(match[2]);
          if (!Number.isSafeInteger(suffix) || suffix <= 0) return send(416, { error: '非法 Range' }, { 'Content-Range': `bytes */${size}` });
          start = Math.max(0, size - suffix);
        } else { start = Number(match[1]); end = match[2] ? Number(match[2]) : end; }
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || start > end || end < 0) {
          return send(416, { error: 'Range 超出文件范围' }, { 'Content-Range': `bytes */${size}` });
        }
        end = Math.min(end, size - 1);
        status = 206;
      }
      const chunk = buffer.subarray(start, end + 1);
      const headers = { 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename="${name}"`, 'Accept-Ranges': 'bytes', 'Content-Length': String(chunk.length) };
      if (status === 206) headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
      return raw(status, chunk, headers);
    }
    if (p === '/api/cache') {
      const etag = '"curl-lab-demo-v1"';
      return request.headers.get('if-none-match') === etag
        ? raw(304, null, { ETag: etag })
        : send(200, { message: '再次请求携带 If-None-Match 可以得到 304', version: 1 }, { ETag: etag });
    }
    if (p === '/api/upload' && method === 'POST') {
      const rawBytes = await readBody(request);
      return send(200, { receivedBytes: rawBytes.length, parsed: await decodeBody(rawBytes, request.headers.get('content-type') || ''), storedOnDisk: false });
    }
    if (p === '/api/form' && method === 'POST') return send(200, { parsed: await body() });
    if (p === '/api/response-headers' && method === 'GET') return send(200, { explanation: '检查 X-Lab-Demo 等响应头' }, { 'X-Lab-Demo': 'hello-from-curl-lab' });
    if (p === '/api/anything' && ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'].includes(method)) return send(200, baseInfo(request, url, { body: await body() }));
    return send(404, { error: '接口不存在', path: p, tip: '返回主页查看实验列表' });
  } catch (error) {
    const status = error?.status || 500;
    return send(status, { error: status === 500 ? '服务器内部错误' : error.message });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return api(request, url);
    if (!['GET','HEAD'].includes(request.method)) return response(request, 405, { error: '静态资源只支持 GET/HEAD' }, { Allow: 'GET, HEAD' });
    const asset = await env.ASSETS.fetch(request);
    const headers = new Headers(asset.headers);
    for (const [key, value] of Object.entries(DEFAULT_HEADERS)) headers.set(key, value);
    return new Response(request.method === 'HEAD' ? null : asset.body, { status: asset.status, headers });
  },
};
