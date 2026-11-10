'use strict';

const BASE = ['http:', 'https:'].includes(location.protocol) ? location.origin : 'http://127.0.0.1:8787';
const S = (path, options = {}) => ({ path, ...options });
const modules = [
  {
    id: 'basic', label: 'HTTP 基础', number: '01', sub: '先观察一个标准 HTTP 请求和响应',
    labs: [
      { id:'get', title:'最简单的 GET 请求', method:'GET', path:'/api/get?name=Alice&age=20', desc:'观察查询参数、请求方法和请求头。', cmd:'{{CURL}} "{{BASE}}/api/get?name=Alice&age=20"', run:S('/api/get?name=Alice&age=20') },
      { id:'head', title:'HEAD：只返回响应头', method:'HEAD', path:'/api/get', desc:'-I 实际上会发送 HEAD 请求。观察响应中没有响应体。', cmd:'{{CURL}} -I {{BASE}}/api/get', run:S('/api/get',{ method:'HEAD' }) },
      { id:'include', title:'同时显示响应头和响应体', method:'GET', path:'/api/get', desc:'通过 -i 对照 HTTP 状态行、响应头与响应体。', cmd:'{{CURL}} -i {{BASE}}/api/get', run:S('/api/get') },
      { id:'verbose', title:'详细请求日志', method:'CLI', path:'/api/get', desc:'-v 显示 DNS、连接与请求头细节。完整结果需在终端观察。', cmd:'{{CURL}} -v {{BASE}}/api/get' },
      { id:'query-encode', title:'查询参数 URL 编码', method:'GET', path:'/api/get', desc:'用 -G 和 --data-urlencode 正确处理空格、& 等特殊字符。', cmd:'{{CURL}} -G {{BASE}}/api/get --data-urlencode "name=Alice Zhang" --data-urlencode "message=hello & world"', run:S('/api/get?name=Alice%20Zhang&message=hello%20%26%20world') },
      { id:'multi-url', title:'一次请求多个 URL', method:'GET', path:'/api/get + /api/health', desc:'curl 可以依次处理多个 URL。', cmd:'{{CURL}} {{BASE}}/api/get {{BASE}}/api/health' },
      { id:'headers-to-file', title:'响应头另存为文件', method:'CLI', path:'/api/get', desc:'-D 将响应头保存到 headers.txt，同时 -o 保存响应体。', cmd:'{{CURL}} -D headers.txt -o body.json {{BASE}}/api/get' },
      { id:'options', title:'OPTIONS 与 Allow', method:'OPTIONS', path:'/api/options', desc:'查看接口允许使用的 HTTP 方法，理解 OPTIONS 请求。', cmd:'{{CURL}} -i -X OPTIONS {{BASE}}/api/options', run:S('/api/options',{method:'OPTIONS'}) },
    ],
  },
  {
    id:'methods', label:'方法与请求体', number:'02', sub:'发送 JSON、表单，理解 GET / POST / PUT / PATCH / DELETE',
    labs:[
      {id:'post-json',title:'POST JSON',method:'POST',path:'/api/echo',desc:'--json 会设置 JSON 请求头并提交请求体。',cmd:'{{CURL}} {{BASE}}/api/echo --json \'{"name":"Alice","age":20}\'',run:S('/api/echo',{method:'POST',json:{name:'Alice',age:20}})},
      {id:'post-data',title:'POST URL 编码表单',method:'POST',path:'/api/form',desc:'-d 默认发送 application/x-www-form-urlencoded 数据。',cmd:'{{CURL}} {{BASE}}/api/form -d "username=alice&role=student"',run:S('/api/form',{method:'POST',form:'username=alice&role=student'})},
      {id:'encoded-form',title:'安全编码表单值',method:'POST',path:'/api/form',desc:'--data-urlencode 能处理空格等特殊字符。',cmd:'{{CURL}} {{BASE}}/api/form --data-urlencode "name=Alice Zhang" --data-urlencode "note=a&b"',run:S('/api/form',{method:'POST',form:'name=Alice+Zhang&note=a%26b'})},
      {id:'put',title:'PUT 替换资源',method:'PUT',path:'/api/method',desc:'观察服务器接收到的 PUT 方法及 JSON 内容。',cmd:'{{CURL}} -X PUT {{BASE}}/api/method --json \'{"name":"Bob"}\'',run:S('/api/method',{method:'PUT',json:{name:'Bob'}})},
      {id:'patch',title:'PATCH 局部修改',method:'PATCH',path:'/api/method',desc:'比较 PATCH 与 PUT 的请求方法。',cmd:'{{CURL}} -X PATCH {{BASE}}/api/method --json \'{"age":21}\'',run:S('/api/method',{method:'PATCH',json:{age:21}})},
      {id:'delete',title:'DELETE 删除操作',method:'DELETE',path:'/api/method',desc:'这里仅回显 DELETE 请求，不会真正删除数据。',cmd:'{{CURL}} -X DELETE {{BASE}}/api/method',run:S('/api/method',{method:'DELETE'})},
      {id:'raw-json-file',title:'从 JSON 文件读取请求体',method:'POST',path:'/api/echo',desc:'在本地创建 data.json 后，用 @ 让 curl 读取文件字节。',cmd:'{{CURL}} {{BASE}}/api/echo -H "Content-Type: application/json" --data-binary @data.json'},
    ],
  },
  {
    id:'headers', label:'头部与状态码', number:'03', sub:'精确区分 HTTP 状态、请求头、响应头和程序退出码',
    labs:[
      {id:'custom-headers',title:'自定义请求头',method:'GET',path:'/api/headers',desc:'设置 User-Agent、Accept 和 X-Request-ID 并检查回显。',cmd:'{{CURL}} {{BASE}}/api/headers -H "User-Agent: curl-student/1.0" -H "Accept: application/json" -H "X-Request-ID: lesson-01"',run:S('/api/headers',{headers:{'X-Request-ID':'lesson-01','Accept':'application/json'}})},
      {id:'response-header',title:'自定义响应头',method:'GET',path:'/api/response-headers',desc:'重点检查 X-Lab-Demo、Content-Type、Cache-Control。',cmd:'{{CURL}} -i {{BASE}}/api/response-headers',run:S('/api/response-headers')},
      {id:'status-201',title:'201 Created',method:'GET',path:'/api/status/201',desc:'观察 201 状态码和响应体。',cmd:'{{CURL}} -i {{BASE}}/api/status/201',run:S('/api/status/201')},
      {id:'status-404',title:'404 Not Found',method:'GET',path:'/api/status/404',desc:'即使 HTTP 是 404，curl 默认也可能返回退出码 0。',cmd:'{{CURL}} -i {{BASE}}/api/status/404',run:S('/api/status/404')},
      {id:'status-500',title:'500 Server Error',method:'GET',path:'/api/status/500',desc:'模拟服务器故障，区分 HTTP 错误和连接失败。',cmd:'{{CURL}} -i {{BASE}}/api/status/500',run:S('/api/status/500')},
      {id:'fail-body',title:'HTTP 错误与退出码',method:'CLI',path:'/api/status/403',desc:'--fail-with-body 保留错误响应体，但让 curl 返回非零退出码。',cmd:'{{CURL}} --fail-with-body {{BASE}}/api/status/403'},
      {id:'status-write',title:'只打印 HTTP 状态码',method:'CLI',path:'/api/status/429',desc:'结合 -s、-o 和 -w，只观察状态码。',cmd:'{{CURL}} -s -o {{NULL}} -w "%{http_code}\\n" {{BASE}}/api/status/429'},
    ],
  },
  {
    id:'auth', label:'认证与 Cookie', number:'04', sub:'演示凭据完全公开，专门用于学习，请勿使用真实隐私数据',
    labs:[
      {id:'basic-unauth',title:'Basic Auth：未授权',method:'GET',path:'/api/basic-auth',desc:'不提供认证信息，服务端返回 401 和 WWW-Authenticate。',cmd:'{{CURL}} -i {{BASE}}/api/basic-auth',run:S('/api/basic-auth')},
      {id:'basic-ok',title:'Basic Auth：认证成功',method:'GET',path:'/api/basic-auth',desc:'演示账号为 alice，密码为 demo123。',cmd:'{{CURL}} -u alice:demo123 {{BASE}}/api/basic-auth',run:S('/api/basic-auth',{headers:{Authorization:'Basic '+btoa('alice:demo123')}})},
      {id:'bearer',title:'Bearer Token',method:'GET',path:'/api/bearer',desc:'使用公开演示 Token：lab-token。',cmd:'{{CURL}} -H "Authorization: Bearer lab-token" {{BASE}}/api/bearer',run:S('/api/bearer',{headers:{Authorization:'Bearer lab-token'}})},
      {id:'set-cookie',title:'服务器设置 Cookie',method:'GET',path:'/api/cookies/set?name=theme&value=dark',desc:'观察 Set-Cookie；配合 -c 把 Cookie 写到本地文件。',cmd:'{{CURL}} -i -c cookies.txt "{{BASE}}/api/cookies/set?name=theme&value=dark"',run:S('/api/cookies/set?name=theme&value=dark')},
      {id:'cookie-jar',title:'从 Cookie 文件读取',method:'GET',path:'/api/cookies',desc:'配合上一实验，使用 -b 重新发送 Cookie。',cmd:'{{CURL}} -b cookies.txt {{BASE}}/api/cookies',run:S('/api/cookies')},
      {id:'delete-cookie',title:'清除演示 Cookie',method:'GET',path:'/api/cookies/delete',desc:'通过 Set-Cookie 的 Max-Age=0 让浏览器删除演示 Cookie。',cmd:'{{CURL}} -i {{BASE}}/api/cookies/delete',run:S('/api/cookies/delete')},
      {id:'send-cookie',title:'手动指定 Cookie',method:'GET',path:'/api/cookies',desc:'使用 -b 直接构造演示 Cookie。',cmd:'{{CURL}} -b "theme=dark; lesson=curl" {{BASE}}/api/cookies'},
    ],
  },
  {
    id:'files', label:'上传与下载', number:'05', sub:'熟悉 -o、-O、-F、Range 和断点续传',
    labs:[
      {id:'download-o',title:'指定名称下载文件',method:'GET',path:'/api/download?size=65536',desc:'保存一份 64 KiB 的确定性测试文件。',cmd:'{{CURL}} -o sample.bin "{{BASE}}/api/download?size=65536"'},
      {id:'download-O',title:'使用远程文件名下载',method:'GET',path:'/api/download?name=demo.bin&size=32768',desc:'服务端提供 Content-Disposition；用 -OJ 保存文件名。',cmd:'{{CURL}} -OJ "{{BASE}}/api/download?name=demo.bin&size=32768"'},
      {id:'range',title:'Range 范围请求',method:'GET',path:'/api/download?size=65536',desc:'服务器返回 206 Partial Content 和 Content-Range。',cmd:'{{CURL}} -r 0-99 -D range-headers.txt -o range.bin "{{BASE}}/api/download?size=65536"'},
      {id:'resume',title:'断点续传',method:'GET',path:'/api/download?size=65536',desc:'先运行 Range 实验生成部分文件，再续传。可使用 curl -C - 。',cmd:'{{CURL}} -C - -o range.bin "{{BASE}}/api/download?size=65536"'},
      {id:'upload',title:'上传 multipart 文件',method:'POST',path:'/api/upload',desc:'先在本地创建 test.txt，再使用 -F 上传；服务器只返回元数据。',cmd:'{{CURL}} -F "file=@test.txt" -F "description=curl lab" {{BASE}}/api/upload',run:S('/api/upload',{method:'POST',fileDemo:true})},
      {id:'parallel-download',title:'并行下载多个文件',method:'CLI',path:'/api/download',desc:'--parallel 可以同时发起多个独立下载。',cmd:'{{CURL}} --parallel -o a.bin "{{BASE}}/api/download?name=a.bin&size=65536" -o b.bin "{{BASE}}/api/download?name=b.bin&size=65536"'},
      {id:'speed-limit',title:'限制文件下载速率',method:'CLI',path:'/api/download?size=524288',desc:'以平均 32 KiB/s 下载，观察进度条。',cmd:'{{CURL}} --limit-rate 32K -o slow.bin "{{BASE}}/api/download?size=524288"'},
    ],
  },
  {
    id:'control', label:'重定向与控制', number:'06', sub:'重定向、超时、重试、缓存与压缩',
    labs:[
      {id:'redirect',title:'302 跳转链',method:'GET',path:'/api/redirect?count=3',desc:'默认不自动跟随，-L 可以跟随三次跳转。',cmd:'{{CURL}} -i -L "{{BASE}}/api/redirect?count=3"',run:S('/api/redirect?count=3')},
      {id:'redirect-loop',title:'限制重定向次数',method:'CLI',path:'/api/redirect-loop',desc:'故意创建无限重定向，用 --max-redirs 2 触发错误。',cmd:'{{CURL}} -L --max-redirs 2 {{BASE}}/api/redirect-loop'},
      {id:'delay',title:'延迟响应',method:'GET',path:'/api/delay/3',desc:'服务器在 3 秒后返回响应。',cmd:'{{CURL}} {{BASE}}/api/delay/3',run:S('/api/delay/3')},
      {id:'timeout',title:'请求超时',method:'CLI',path:'/api/delay/5',desc:'服务器延迟 5 秒，客户端最多等待 2 秒，触发退出码 28。',cmd:'{{CURL}} --max-time 2 {{BASE}}/api/delay/5'},
      {id:'retry',title:'失败重试',method:'CLI',path:'/api/status/503',desc:'503 属于典型的临时性服务端错误；观察 --retry。',cmd:'{{CURL}} -v --retry 2 --retry-delay 1 {{BASE}}/api/status/503'},
      {id:'compress',title:'gzip 压缩',method:'GET',path:'/api/compress',desc:'--compressed 告知服务器可接受压缩响应，并自动解压。',cmd:'{{CURL}} -i --compressed {{BASE}}/api/compress',run:S('/api/compress')},
      {id:'etag',title:'条件请求与 304',method:'GET',path:'/api/cache',desc:'先读取 ETag，再发送 If-None-Match，观察 304 Not Modified。',cmd:`{{CURL}} -i -H 'If-None-Match: "curl-lab-demo-v1"' {{BASE}}/api/cache`,run:S('/api/cache',{headers:{'If-None-Match':'"curl-lab-demo-v1"'}})},
    ],
  },
  {
    id:'network', label:'网络排障', number:'07', sub:'DNS、IPv4/IPv6、代理、TLS、协议版本和耗时分析',
    labs:[
      {id:'trace-ascii',title:'保存请求追踪',method:'CLI',path:'/api/get',desc:'--trace-ascii 在本地生成文本追踪文件，可能包含敏感头，勿随意公开。',cmd:'{{CURL}} --trace-ascii trace.txt {{BASE}}/api/get'},
      {id:'connect-timeout',title:'指定连接超时',method:'CLI',path:'/api/get',desc:'设置连接阶段 5 秒，整个操作最多 15 秒。',cmd:'{{CURL}} --connect-timeout 5 --max-time 15 {{BASE}}/api/get'},
      {id:'timing',title:'测量请求耗时',method:'CLI',path:'/api/get',desc:'-w 输出 DNS、TCP、TTFB、总耗时。',cmd:'{{CURL}} -s -o {{NULL}} -w "DNS=%{time_namelookup}s TCP=%{time_connect}s TTFB=%{time_starttransfer}s TOTAL=%{time_total}s\\n" {{BASE}}/api/get'},
      {id:'stats',title:'输出完整统计 JSON',method:'CLI',path:'/api/get',desc:'利用 %{json} 获取大量网络性能字段。',cmd:'{{CURL}} -s -o {{NULL}} -w "%{json}\\n" {{BASE}}/api/get'},
      {id:'ipv4',title:'强制 IPv4',method:'CLI',path:'/api/get',desc:'需要域名配置 IPv4 或使用具备 IPv4 的连接地址。',cmd:'{{CURL}} -4 -v {{BASE}}/api/get'},
      {id:'ipv6',title:'强制 IPv6',method:'CLI',path:'/api/get',desc:'需要客户端有 IPv6 连接，且该 Cloudflare 域名可通过 IPv6 访问。',cmd:'{{CURL}} -6 -v {{BASE}}/api/get'},
      {id:'proxy-http',title:'指定 HTTP 代理',method:'CLI',path:'/api/get',desc:'需要你自己配置本地 HTTP 代理，例如监听 7890 端口。',cmd:'{{CURL}} -v --noproxy "" -x http://127.0.0.1:7890 {{BASE}}/api/get'},
      {id:'proxy-socks',title:'指定 SOCKS5 代理',method:'CLI',path:'/api/get',desc:'socks5h 让代理服务器解析域名。需要 SOCKS5 代理监听 7891 端口。',cmd:'{{CURL}} -v --noproxy "" -x socks5h://127.0.0.1:7891 {{BASE}}/api/get'},
      {id:'bypass-proxy',title:'绕过系统代理环境变量',method:'CLI',path:'/api/get',desc:'--noproxy 可以为特定 URL 跳过代理。',cmd:'{{CURL}} --noproxy "*" -v {{BASE}}/api/get'},
      {id:'tls',title:'检查 HTTPS / TLS',method:'CLI',path:'/api/get',desc:'需将实验网站部署在 HTTPS 域名上，再观察证书与连接。',cmd:'{{CURL}} -v {{BASE}}/api/get'},
      {id:'http1',title:'强制 HTTP/1.1',method:'CLI',path:'/api/get',desc:'与 HTTP/2、HTTP/3 对比；Cloudflare 边缘可协商 HTTP/1.1、HTTP/2 或 HTTP/3。',cmd:'{{CURL}} --http1.1 -v {{BASE}}/api/get'},
      {id:'http2',title:'尝试 HTTP/2',method:'CLI',path:'/api/get',desc:'需支持 HTTP/2 的 TLS 反向代理和带 HTTP/2 功能的 curl。',cmd:'{{CURL}} --http2 -v {{BASE}}/api/get'},
      {id:'http3',title:'尝试 HTTP/3',method:'CLI',path:'/api/get',desc:'需要 HTTPS/QUIC 服务器以及带 HTTP/3 功能的 curl 构建。',cmd:'{{CURL}} --http3 -v {{BASE}}/api/get'},
      {id:'ca-cert',title:'使用自定义 CA 证书',method:'CLI',path:'/api/get',desc:'有自签名 CA 时，用 --cacert 验证；需要你准备 CA 文件与 HTTPS 环境。',cmd:'{{CURL}} --cacert my-ca.pem https://example.com/api/get'},
      {id:'insecure',title:'跳过 TLS 校验（仅排障）',method:'CLI',path:'/api/get',desc:'-k 会降低连接安全性，仅适用于自签名实验环境，不应日常使用。',cmd:'{{CURL}} -k -v {{BASE}}/api/get'},
      {id:'connect-to',title:'重定向实际连接目标',method:'CLI',path:'/api/get',desc:'保留 URL 的域名但改连指定的主机/端口。示例需自行配置本地 HTTPS 服务。',cmd:'{{CURL}} --connect-to example.com:443:127.0.0.1:8443 https://example.com/api/get'},
      {id:'resolve',title:'自定义 DNS 解析',method:'CLI',path:'/api/get',desc:'把域名绑定到指定 IP；以下是模板，实际要替换 IP/域名。',cmd:'{{CURL}} --resolve example.com:443:203.0.113.10 https://example.com/api/get'},
      {id:'remote-ip',title:'查看直连来源 IP',method:'GET',path:'/api/ip',desc:'Cloudflare 边缘返回所观测到的客户端 IP；使用代理时为代理出口 IP。',cmd:'{{CURL}} {{BASE}}/api/ip',run:S('/api/ip')},
    ],
  },
];

const all = modules.flatMap(m => m.labs);
const $ = id => document.getElementById(id);
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const loaded = (()=> { try {return JSON.parse(localStorage.getItem('curl-lab-progress')||'{}')}catch{return {}}})();
const completed = new Set(Object.entries(loaded).filter(([,v])=>v).map(([k])=>k));
let selectedModule = modules[0].id;
let lastPanel = 'body';
let toastTimer;

function shell() { return $('shell-select').value; }
function command(lab) {
  return lab.cmd.replaceAll('{{BASE}}',BASE)
    .replaceAll('{{CURL}}',shell() === 'pwsh' ? 'curl.exe' : 'curl')
    .replaceAll('{{NULL}}',shell() === 'pwsh' ? 'NUL' : '/dev/null');
}
function toast(message) {
  $('toast').textContent = message;
  $('toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>$('toast').classList.remove('show'), 2300);
}
async function copy(value) {
  try { await navigator.clipboard.writeText(value); toast('已复制到剪贴板'); }
  catch { window.prompt('复制下面的内容：',value); }
}
function saveProgress() {
  try { localStorage.setItem('curl-lab-progress', JSON.stringify(Object.fromEntries(all.map(x=>[x.id,completed.has(x.id)])))); }
  catch { /* Private browsing may disable localStorage */ }
  const n = completed.size;
  $('progress-text').textContent = `${n} / ${all.length}`;
  $('progress-fill').style.width = `${100*n/all.length}%`;
}
function renderTabs() {
  $('module-tabs').innerHTML = modules.map(m=>`<button type="button" role="tab" aria-selected="${selectedModule===m.id}" class="module-tab ${selectedModule===m.id?'active':''}" data-module="${escapeHtml(m.id)}">${escapeHtml(m.number)} &nbsp;${escapeHtml(m.label)}</button>`).join('');
}
function renderLabs() {
  const m = modules.find(x=>x.id===selectedModule);
  $('module-content').innerHTML = `<div class="module-heading"><h3>${escapeHtml(m.number)} / ${escapeHtml(m.label)}</h3><p>${escapeHtml(m.sub)}</p></div><div class="experiment-list">${m.labs.map(x=>`<article class="experiment"><div class="experiment-header"><h4 class="experiment-title">${escapeHtml(x.title)}</h4><span class="method-tag ${escapeHtml(x.method)}">${escapeHtml(x.method)}</span></div><p class="experiment-desc">${escapeHtml(x.desc)}</p><div class="experiment-endpoint">${escapeHtml(x.path)}</div><div class="code-box"><code class="command-text">${escapeHtml(command(x))}</code></div><div class="experiment-actions"><button type="button" class="action" data-copy="${escapeHtml(x.id)}">复制 curl</button><button type="button" class="action run" data-run="${escapeHtml(x.id)}" ${x.run?'':'disabled title="该实验需要在实际终端运行"'}>浏览器试运行</button><label class="done-control"><input type="checkbox" data-done="${escapeHtml(x.id)}" ${completed.has(x.id)?'checked':''}> 已完成</label></div></article>`).join('')}</div>`;
}
function setInspector(method,path,status,body,headers,time,length) {
  $('inspector-method').textContent = method;
  $('inspector-path').textContent = path;
  $('inspector-code').textContent = status ?? 'ERR';
  $('inspector-code').style.color = status>=200 && status<400 ? '#8de0b0' : '#ffabb9';
  $('inspector-badge').textContent = status ? 'FINISHED' : 'ERROR';
  $('inspector-body').textContent = body;
  $('inspector-headers').textContent = headers;
  $('inspector-time').textContent = `时间 ${time}ms`;
  $('inspector-size').textContent = `大小 ${length} B`;
}
async function browserRun(lab) {
  if (!lab.run) return;
  const x = lab.run;
  const opts = { method:x.method||'GET', headers: {...(x.headers||{})}, credentials:'same-origin' };
  if (x.json) {opts.headers['Content-Type']='application/json';opts.body=JSON.stringify(x.json);}
  if (x.form) {opts.headers['Content-Type']='application/x-www-form-urlencoded';opts.body=x.form;}
  if (x.fileDemo) {
    const form = new FormData();
    form.append('file',new Blob(['hello from curl-lab browser demo\n'],{type:'text/plain'}),'browser-test.txt');
    form.append('description','browser test');
    opts.body=form;
  }
  $('inspector-badge').textContent = 'RUNNING';
  $('inspector-body').textContent = '正在发送请求…';
  $('terminal').scrollIntoView({behavior:'smooth',block:'center'});
  const begin = performance.now();
  try {
    const response = await fetch(x.path, opts);
    const body = await response.text();
    const headers = [...response.headers.entries()].map(([k,v])=>`${k}: ${v}`).join('\n');
    let display = body;
    try { display=JSON.stringify(JSON.parse(body),null,2); } catch {}
    if (response.redirected) display = `重定向已跟随至：${response.url}\n\n`+display;
    setInspector(opts.method,x.path,response.status,display,headers,Math.round(performance.now()-begin),new TextEncoder().encode(body).length);
  } catch(e) {
    setInspector(opts.method,x.path,null,`请求失败：${e.message}\n\n提示：请通过 Cloudflare Worker 域名或 wrangler dev 打开，不能使用 file://。`,'（无响应头）',Math.round(performance.now()-begin),0);
  }
}

$('metric-labs').textContent = all.length;
$('base-url').value = BASE;
$('preview-url').textContent = BASE+'/api/get';
renderTabs();renderLabs();saveProgress();
$('module-tabs').addEventListener('click',e=>{
  const t=e.target.closest('button[data-module]');
  if(!t)return;
  selectedModule=t.dataset.module;
  renderTabs();renderLabs();
});
$('module-content').addEventListener('click',e=>{
  const c=e.target.closest('button[data-copy]');
  if(c){const lab=all.find(x=>x.id===c.dataset.copy);if(lab)copy(command(lab));return;}
  const r=e.target.closest('button[data-run]');
  if(r){const lab=all.find(x=>x.id===r.dataset.run);if(lab)browserRun(lab);}
});
$('module-content').addEventListener('change',e=>{
  if(!e.target.matches('input[data-done]'))return;
  if(e.target.checked)completed.add(e.target.dataset.done);
  else completed.delete(e.target.dataset.done);
  saveProgress();
});
$('shell-select').addEventListener('change',renderLabs);
$('reset-progress').addEventListener('click',()=>{completed.clear();saveProgress();renderLabs();toast('已清空完成标记');});
$('copy-base').addEventListener('click',()=>copy(BASE));
$('run-health').addEventListener('click',()=>browserRun({run:S('/api/health')}));
document.querySelectorAll('.inspector-tabs button').forEach(b=>b.addEventListener('click',()=>{
  lastPanel=b.dataset.panel;
  document.querySelectorAll('.inspector-tabs button').forEach(x=>x.classList.toggle('active',x===b));
  $('inspector-body').classList.toggle('hidden',lastPanel!=='body');
  $('inspector-headers').classList.toggle('hidden',lastPanel!=='headers');
}));
