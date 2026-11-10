#!/usr/bin/env node
/** Exercise a deployed Cloudflare Worker through the real HTTP endpoint. */
const base = process.argv[2]?.replace(/\/$/, '');
if (!base || !/^https?:\/\//.test(base)) {
  console.error('用法: node scripts/smoke.mjs https://curl.your-domain.com');
  process.exit(2);
}
const checks = [
  { path: '/', status: 200, content: 'CURL' },
  { path: '/api/health', status: 200, content: 'curl-lab-cloudflare' },
  { path: '/api/get?name=Alice', status: 200, content: 'Alice' },
  { path: '/api/status/404', status: 404 },
  { path: '/api/status/500', status: 500 },
  { path: '/api/basic-auth', status: 401 },
  { path: '/api/download?size=4096', status: 206, headers: { Range: 'bytes=0-99' }, expectedRange: 'bytes 0-99/4096' },
];
let failures = 0;
for (const { path, status, headers, content, expectedRange } of checks) {
  try {
    const r = await fetch(base + path, { headers, redirect: 'manual', signal: AbortSignal.timeout(12000) });
    const text = content ? await r.text() : '';
    const okay = r.status === status && (!content || text.includes(content)) && (!expectedRange || r.headers.get('content-range') === expectedRange);
    if (!okay) failures++;
    console.log(`${okay ? 'PASS' : 'FAIL'} ${String(r.status).padStart(3)} ${path}`);
  } catch (e) {
    failures++;
    console.log(`FAIL ERR ${path}: ${e.message}`);
  }
}
console.log(`\n${checks.length - failures}/${checks.length} 检查通过`);
if (failures) process.exit(1);
