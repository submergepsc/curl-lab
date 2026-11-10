import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.mjs';

const origin = 'https://curl.example.test';
const env = {
  ASSETS: {
    async fetch(request) {
      return new Response('<h1>CURL LAB</h1>', { status: 200, headers: { 'Content-Type': 'text/html' } });
    },
  },
};

const run = (path, init = {}) => worker.fetch(new Request(origin + path, init), env);
const json = async response => response.json();

// These tests call the actual Worker fetch handler with Web-standard Request/Response.
// The Cloudflare edge/TLS/static-asset runtime still needs a live deployment test.
test('health and asset routing', async () => {
  const h = await run('/api/health');
  assert.equal(h.status, 200);
  assert.equal((await json(h)).runtime, 'Cloudflare Workers');
  const site = await run('/');
  assert.equal(site.status, 200);
  assert.match(await site.text(), /CURL LAB/);
  assert.equal(site.headers.get('x-content-type-options'), 'nosniff');
});

test('GET URL query and redacted request headers', async () => {
  const r = await run('/api/get?name=Alice&age=20', { headers: { 'Authorization': 'Bearer private', 'Cookie': 'sid=secret' } });
  const data = await json(r);
  assert.equal(r.status, 200);
  assert.equal(data.query.name, 'Alice');
  assert.equal(data.headers.authorization, '[REDACTED]');
  assert.equal(data.headers.cookie, '[REDACTED]');
});

test('HEAD has no response body and OPTIONS returns Allow', async () => {
  const head = await run('/api/get', { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  const options = await run('/api/options', { method: 'OPTIONS' });
  assert.equal(options.status, 204);
  assert.match(options.headers.get('allow'), /OPTIONS/);
});

test('POST JSON, PUT, PATCH and DELETE', async () => {
  for (const method of ['POST','PUT','PATCH','DELETE']) {
    const r = await run('/api/method', { method, headers: { 'Content-Type': 'application/json' }, body: '{"name":"Alice"}' });
    assert.equal(r.status, 200);
    const body = await json(r);
    assert.equal(body.method, method);
    assert.equal(body.parsed.json.name, 'Alice');
  }
});

test('POST urlencoded form and text echo', async () => {
  const r = await run('/api/form', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'name=Alice+Zhang&age=20' });
  assert.equal((await json(r)).parsed.form.name, 'Alice Zhang');
  const e = await run('/api/echo', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'hello' });
  const data = await json(e);
  assert.equal(data.bodyLength, 5);
  assert.equal(data.body.text, 'hello');
});

test('reject bodies larger than 2 MiB', async () => {
  const r = await run('/api/echo', { method: 'POST', body: 'x'.repeat(2 * 1024 * 1024 + 1) });
  assert.equal(r.status, 413);
});

test('Basic and Bearer demo authorization', async () => {
  const basicFail = await run('/api/basic-auth');
  assert.equal(basicFail.status, 401);
  assert.match(basicFail.headers.get('www-authenticate'), /Basic/);
  const basic = await run('/api/basic-auth', { headers: { 'Authorization': 'Basic ' + btoa('alice:demo123') } });
  assert.equal((await json(basic)).authenticated, true);
  const bearerFail = await run('/api/bearer', { headers: { 'Authorization': 'Bearer wrong' } });
  assert.equal(bearerFail.status, 401);
  const bearer = await run('/api/bearer', { headers: { 'Authorization': 'Bearer lab-token' } });
  assert.equal((await json(bearer)).authenticated, true);
});

test('Cookie set, view, and delete', async () => {
  const r = await run('/api/cookies/set?name=theme&value=dark');
  assert.match(r.headers.get('set-cookie'), /theme=dark/);
  const viewed = await run('/api/cookies', { headers: { Cookie: 'theme=dark; pref=compact' } });
  assert.equal((await json(viewed)).cookies.pref, 'compact');
  const cleared = await run('/api/cookies/delete');
  assert.match(cleared.headers.get('set-cookie'), /Max-Age=0/);
});

test('status routes, 204 and 304 without bodies', async () => {
  for (const status of [201,400,401,403,404,429,500,502,503]) {
    assert.equal((await run('/api/status/' + status)).status, status);
  }
  for (const status of [204,304]) {
    const r = await run('/api/status/' + status);
    assert.equal(r.status, status);
    assert.equal(await r.text(), '');
  }
});

test('redirect chain, loop and invalid count', async () => {
  const r = await run('/api/redirect?count=3');
  assert.equal(r.status, 302);
  assert.equal(r.headers.get('location'), '/api/redirect?count=2');
  assert.equal((await run('/api/redirect?count=0')).status, 200);
  assert.equal((await run('/api/redirect?count=100')).status, 400);
  assert.equal((await run('/api/redirect-loop')).headers.get('location'), '/api/redirect-loop');
});

test('binary download, range 206 and unsatisfiable range 416', async () => {
  const full = await run('/api/download?size=1024');
  assert.equal(full.status, 200);
  const bytes = new Uint8Array(await full.arrayBuffer());
  assert.equal(bytes.length, 1024);
  assert.equal(bytes[0], 7);
  const part = await run('/api/download?size=1024', { headers: { Range: 'bytes=100-199' } });
  assert.equal(part.status, 206);
  assert.equal(part.headers.get('content-range'), 'bytes 100-199/1024');
  assert.equal((await part.arrayBuffer()).byteLength, 100);
  const wrong = await run('/api/download?size=1024', { headers: { Range: 'bytes=1024-' } });
  assert.equal(wrong.status, 416);
});

test('multipart upload is summarized but not stored', async () => {
  const form = new FormData();
  form.append('description','browser test');
  form.append('file', new Blob(['hello\n'], { type:'text/plain' }), 'file.txt');
  const r = await run('/api/upload', { method:'POST', body:form });
  const data = await json(r);
  assert.equal(r.status, 200);
  assert.equal(data.storedOnDisk, false);
  assert.equal(data.parsed.parts.find(x => x.name === 'file').filename, 'file.txt');
});

test('ETag conditional 304', async () => {
  const a = await run('/api/cache');
  assert.equal(a.status, 200);
  const etag = a.headers.get('etag');
  const b = await run('/api/cache', { headers: { 'If-None-Match': etag } });
  assert.equal(b.status, 304);
});

test('gzip response can be decompressed', async () => {
  const response = await run('/api/compress', { headers: { 'Accept-Encoding': 'gzip' } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-encoding'), 'gzip');
  const decompressed = response.body.pipeThrough(new DecompressionStream('gzip'));
  const text = await new Response(decompressed).text();
  assert.match(text, /curl-lab/);
});

test('invalid upload / unknown endpoint / non-GET static', async () => {
  assert.equal((await run('/api/unknown')).status, 404);
  assert.equal((await run('/', { method: 'POST' })).status, 405);
  assert.equal((await run('/api/download?size=2000000')).status, 400);
});
