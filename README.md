# CURL LAB · Cloudflare Workers + GitHub 自动部署

一个真正可以部署到自己 Cloudflare 域名下的 curl HTTP 教学实验站。保留原版前端设计和 **7 大模块、61 项实验**，后端改为 Cloudflare Worker：**不需要 Node.js 常驻服务器、VPS、数据库、Pages Functions 或服务器端口**。

## 项目目录

```text
curl-lab-cloudflare/
├── public/
│   ├── index.html           # 网站首页
│   ├── style.css            # 网站样式
│   └── app.js               # 61 个 curl 实验 / 浏览器请求检查器
├── src/
│   └── index.mjs            # Cloudflare Worker HTTP API
├── test/
│   └── worker.test.mjs      # Node 22 Web API 单元测试
├── wrangler.toml            # Worker + 静态资源配置
├── package.json            # Wrangler 开发工具
├── .gitignore
└── README.md
```

## 第一步：本地运行（可选）

安装 Node.js 20+（推荐 Node.js 22），在**仓库根目录**执行：

```bash
npm install
npm run dev
```

打开 `http://127.0.0.1:8787/`。执行 `npm test` 可进行无外网单元测试。

## 第二步：发布到你的 GitHub 仓库

将 ZIP **解压后，把其内部文件作为仓库根目录**（不能把 zip 本身上传后期待自动展开）。

```bash
git init
git add .
git commit -m "Initial CURL LAB Cloudflare Worker"
git branch -M main
git remote add origin https://github.com/<YOUR_USERNAME>/curl-lab.git
git push -u origin main
```

先在 GitHub 新建**空仓库** `curl-lab`；把 `<YOUR_USERNAME>` 改成你的 GitHub 账号。若仓库原本有文件，按 Git 现有提交历史处理，不要盲目强推。

## 第三步：在 Cloudflare 绑定 GitHub 自动部署

1. 打开 Cloudflare Dashboard → **Workers & Pages** → **Create application**。
2. 选择 **GitHub**，完成 GitHub 账户授权，并选择刚刚创建的 `curl-lab` 仓库。
3. 分支选 `main`；**Root directory** 留空或设为 `/`（前提是本项目文件在仓库根目录）。
4. **Build command** 留空（前端为原生 HTML/CSS/JS，完全没有构建步骤）。
5. **Deploy command**：`npx wrangler deploy`（通常为默认）。
6. Worker 名称必须与根目录 `wrangler.toml` 的 `name = "curl-lab"` 一致。如果你已有同名 Worker，请选择其他唯一名称，并同步修改 `wrangler.toml`。
7. 点击 **Save and Deploy**；部署成功后打开给出的 `*.workers.dev` URL 测试 `https://<YOUR_WORKER>.workers.dev/api/health`。

后续 `git push origin main`，Workers Builds 即会再次自动构建和部署。无需自行维护 GitHub Actions、API Token，也不要把 Cloudflare 密钥上传到仓库。

Cloudflare 官方文档：
- GitHub 集成：https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/
- Workers Builds 配置：https://developers.cloudflare.com/workers/ci-cd/builds/configuration/

## 第四步：绑定你现有的域名（推荐使用独立子域名）

推荐新建 `curl.example.com`，**不要覆盖当前 `example.com` 的正式网站**。

1. 在 Cloudflare 的 **Workers & Pages** 中选择已经部署的 `curl-lab` Worker。
2. 打开 **Settings → Domains & Routes → Add → Custom Domain**。
3. 输入 `curl.example.com`（替换成你自己的域名）。
4. Cloudflare 会为已托管的有效 Zone 自动配置相应 DNS 记录和 HTTPS 证书；等待状态生效。
5. 访问 `https://curl.example.com/` 和 `https://curl.example.com/api/health`。

**注意**：该主机名必须属于你 Cloudflare 中正常托管的域名，且不能与已有的 CNAME 或其他占用冲突。已有正式站点建议继续留在原域名，这个实验站使用新子域名。

官方文档：https://developers.cloudflare.com/workers/configuration/routing/custom-domains/

### 以后如何更新网站？

```bash
git add .
git commit -m "Update CURL LAB"
git push origin main
```

Cloudflare 会自动同步部署。你无需手动复制网页或再次在网页控制台粘贴 Worker 代码。

## 实验接口样例

```bash
curl -i https://curl.example.com/api/health
curl -G 'https://curl.example.com/api/get' --data-urlencode 'name=Alice Zhang'
curl -X POST https://curl.example.com/api/echo --json '{"message":"hello"}'
curl -i https://curl.example.com/api/status/404
curl -u alice:demo123 https://curl.example.com/api/basic-auth
curl -H 'Authorization: Bearer lab-token' https://curl.example.com/api/bearer
curl -i -L 'https://curl.example.com/api/redirect?count=2'
curl -r 0-99 -o first100.bin 'https://curl.example.com/api/download?size=65536'
```

完整的 61 个实验命令请在网站上切换模块查看。网站会根据访问的域名生成 curl 命令，支持切换 Bash 与 PowerShell 显示；`fetch()` 请求检查器可以在浏览器直接观察常见响应。

## 工作机制与边界

- `wrangler.toml` 的 `assets.directory` 指向 `./public`，`run_worker_first = true` 允许 Worker 先处理 API，再由 `env.ASSETS.fetch(request)` 返回静态页面。
- `src/index.mjs` 基于 Web 标准的 `Request`、`Response`、`CompressionStream` 等 API，不使用 Node.js 的 `http.createServer()`、`fs`、`Buffer`。
- API 支持 GET/HEAD/OPTIONS/POST/PUT/PATCH/DELETE、JSON、表单、multipart 上传、Demo Basic/Bearer、Cookie、HTTP 状态码、重定向、延迟、ETag、gzip、Range 206 和下载。
- 上传请求最大 2 MiB；不会把文件保存在持久存储中。下载内容由 Worker 生成，最多 1 MiB；不会使用数据库。
- **DNS、TLS、IPv4/IPv6、HTTP/2/HTTP/3** 由客户端与 Cloudflare 边缘网络协商，不是 Worker 代码能强制控制的。HTTP/3 要求浏览器/curl 支持且 Cloudflare 相关设置启用；本地 Wrangler 环境未必具备相同协议能力。
- Cloudflare 可能标准化请求头或自动处理内容压缩，所以 `Accept-Encoding`、头部顺序、真实 HTTP 版本等细节应以终端 curl 的 `-v`/`--trace` 观测为准，不能把 Worker 看到的头视为原始线缆报文。
- **不要把真实密码、正式 API Token、Cookie 或私密文件发给公开的实验接口。** `/api/cookies` 是专门用来展示 Cookie 的教学接口，会回显你主动发送的 Cookie。
- Basic/Bearer **演示凭据公开写在源码中，不提供真正的登录保护**；公网暴露后别人也能调用。建议使用 Cloudflare WAF / Rate Limiting；如使用 Cloudflare Access，可能会拦截原本用于教学的 401/302 等实验响应，应注意单独配置测试策略。
- Cloudflare 平台可能有使用量/速率限制。`/api/delay/*` 最多延迟 8 秒；HTTP 状态码、Range、请求体都有限制。公网不要用于压测或大流量测试。

## 测试

```bash
npm test
npm run smoke -- https://curl.example.com
node --check src/index.mjs
node --check public/app.js
```

部署后可通过 `npm run smoke -- https://curl.example.com` 验证真实域名（替换成你的域名）。本地自动化测试覆盖 HTTP 方法、认证、Cookie、重定向、条件缓存、gzip、文件上传和范围下载。**此类测试不等价于在 Cloudflare 真实边缘环境完成部署测试**，上线后仍需访问你的自定义域名验证。
