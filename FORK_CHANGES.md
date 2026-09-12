# 本 fork 的本地修改说明

> 仓库：`https://github.com/DelicateDuck582/api-enhanced`（个人维护分支，**不向上游提交**）
> 基线：上游 `NeteaseCloudMusicApiEnhanced/api-enhanced`（`main`，v4.37.0 快照）
> 用途：记录本 fork 相对上游的增量改动，便于后续升级上游时合并/回滚

## 2026-09-12 取链风控自愈（核心）

**问题**：部署在 Vercel 等云环境时，出口 IP 易被网易云风控，`/song/url/v1`、`/song/url`、
`/song/download/url/v1` 会返回 `code: 404 / -110` 且 `url` 为空 → 客户端（SPlayer）无法播放/下载。

**实测**（2026-09-12）：
- 云部署直连：`{"data":[{"code":404,"url":null, ...}]}`
- 同一请求追加 `randomCNIP=true`：`{"data":[{"code":200,"url":"http://m7.music.126.net/..."}]}`
- 本机（非云 IP）直连网易云取链接口：`code:200` 正常

**改动**：
- 新增 `util/song-url-retry.js`：取链响应无可用 `url` 时，自动以 `randomCNIP=true` 重试一次；
  调用方可通过 `randomCNIP=false` 或 `disableUrlRetry=true` 显式关闭
- `module/song_url_v1.js`、`module/song_url.js`、`module/song_download_url_v1.js` 接入该兜底

**效果**：客户端无需任何改动即可恢复播放/下载；正常路径不产生额外请求（仅在首次结果无地址时重试）。

## 2026-09-12 登录 Cookie 可经请求头传递（可选能力）

**问题**：客户端（SPlayer）以查询参数传递 `MUSIC_U`，凭据会进入 URL 与访问日志。

**改动**：
- `server.js`：路由层支持 `X-Netease-Cookie` / `X-SPlayer-Cookie` 请求头，转换为请求 Cookie
  （优先级：查询参数/请求体 > 请求头 > 浏览器 Cookie；保持既有行为兼容）
- `server.js`：`Access-Control-Allow-Headers` 增加上述两个头，浏览器预检可通过

**用法**：
```bash
curl -H "X-Netease-Cookie: MUSIC_U=xxxxxxxx;os=pc;" https://<api>/user/account
# 等价于 ?cookie=MUSIC_U%3Dxxxxxxxx%3Bos%3Dpc%3B
```

**配套改动（2026-09-12 追加）**：
- 服务端允许的头最小化：`X-Requested-With,Content-Type,X-Netease-Cookie,X-SPlayer-Cookie`
- 新增 `Access-Control-Max-Age: 600`：自定义请求头会触发 CORS 预检，未设置 Max-Age 时浏览器几乎每次请求都要先发一次 OPTIONS（实测某次页面加载 67 个 API 请求 → 28 次预检）；设置后可缓存 10 分钟

## 部署提示

- 云环境（Vercel / Cloudflare 等）建议同时设置环境变量 `ENABLE_RANDOM_CN_IP=true`：
  让所有请求默认使用随机国内 IP，从源头规避出口 IP 风控（本 fork 的兜底重试可与其叠加使用）
- `CORS_ALLOW_ORIGIN` 保持 `*`（或加入网页部署域名）；客户端按 `withCredentials: false` 使用
- 如自建部署并希望出口走代理，可设置 `ENABLE_PROXY=true` + `PROXY_URL=...`
  （或由客户端按请求传入 `proxy=` 参数，注意代理需对服务端可达）

## 未合入上游的内容（仅本 fork）

- 上述两项均为本 fork 的本地增强，**不提交上游 PR**；升级上游时如遇冲突，可直接保留本 fork 版本

## 验证记录（本机实测，2026-09-12）

本机以 `PORT=3100 node app.js` 启动服务，并用海外 `realIP` 构造「出口被风控」场景（返回同款空 `url` + `code 404`）：

| 场景 | 结果 |
| --- | --- |
| `realIP=8.8.8.8&disableUrlRetry=true` | ❌ `url: null`（复现失败，兜底已按要求关闭） |
| `realIP=8.8.8.8`（默认启用兜底） | ✅ `url` 正常 —— **兜底生效（清除 realIP + randomCNIP 重试）** |
| `/song/download/url/v1?...&realIP=8.8.8.8` | ✅ `url` 正常 |
| 正常路径（无 realIP） | ✅ `url` 正常（不产生额外请求，无回归） |
| 无效歌曲 id（两次取链均失败） | ✅ 返回原始响应、未抛 500，日志含重试告警 |
| `eslint` / `node --check`（改动文件） | ✅ 全部通过 |

> 关键细节：`randomCNIP` 会被 `realIP` 覆盖（`util/request.js` 中 `realIP` 优先级更高），
> 因此兜底重试**必须同时清除 `realIP`**，否则重试仍走被风控的出口，兜底形同虚设。

## 部署后自检

```bash
# 部署完成后（Vercel 自动重新部署），不应再出现 url 为 null
curl -s "https://<你的 API 域名>/song/url/v1?id=33894312&level=standard" | head -c 200
# 期望：data[0].url 为可播放地址（服务端已在内部用随机国内 IP 兜底重试）
```

