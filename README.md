# 苍柏 CINEMA v0.6.1 部署修复版

源码仓库：[zaz52/cangbai-cinema](https://github.com/zaz52/cangbai-cinema)。

线上地址：https://weiyi.indevs.in/ 。部署状态、复测结果和维护步骤见 [DEPLOYMENT.md](DEPLOYMENT.md)。首页与专题卡片按当前年份展示新片、新剧及热播推荐，每小时自动同步；旧馆藏搜索和旧收藏入口已清理。以下保留 v0.6 功能与部署说明。

## 影院门户界面

首页采用黑灰底色与蓝色导航，提供热门作品轮播、“正在热播 / 电影 / 电视剧 / 综艺 / 动漫”分栏片单。首屏下方提供电影题材、电视剧地区、综艺地区与动漫地区入口，点击后筛选当前年度片单；无匹配时显示空状态，可切回全部或搜索片名。桌面端每行 6 张海报，平板每行 4 张，手机每行 2 张；手机另有底部导航。横幅支持手动切换和每 7 秒轮播，悬停、键盘焦点、弹窗、后台页面及系统减少动态效果偏好会暂停自动切换。

片单继续使用 `/api/discover` 的年度更新结果，分类依据源接口返回的题材、地区与分类名称。评分、集数和海报来自现有接口；海报失效时显示片名占位，并将该海报从当前会话的轮播候选中排除。前台导航为首页、电影、电视剧、动漫、综艺、热播榜、搜片和收藏；影视源统一从管理后台维护。

PC 首屏优先展示具备高清横图的作品，横图铺满首屏并随作品切换。横图来自源接口 `vod_pic_slide` 或公开宣传图资料，按当年、电影/剧集类型和片名匹配；图片宽度至少 1280px、宽高比至少 1.5 时采用横幅布局。其他封面采用完整比例的海报布局，显示尺寸限制在原图尺寸之内。哔哩哔哩首屏图片请求原图，卡片保留缩略图。单张横图失效时选择其他可用横图，候选全部失败后尝试影片封面。图片来源链接展示在横幅右下角。

每小时同步年度片单时同步检查 `https://fdzys.com/` 的公开首页宣传图，限定图片和详情页路径，匹配现有年度影片；宣传图资料用于页面展示，影片搜索与播放沿用已配置源。相同图片优先加载本项目的静态备份，文件位于 `public/assets/banners/`，来源、原始分辨率和 SHA-256 文件名前缀记录在 `public/data/banners.json`。上游临时不可用时使用静态备份及 D1 中的最近横图记录。

维护备份时，在项目目录执行 `node scripts/refresh-banners.mjs`，脚本原样保存通过横图尺寸检查的图片字节，并更新清单。核对 Git diff 后部署静态文件即可；原图的许可、来源变更和投诉继续按本站版权处理流程维护。

界面样式在 `public/cinema.css`，加载于 `public/style.css` 之后；首页结构和交互在 `public/app.js`，无需更改数据库。维护时保留两份样式表的加载顺序，使用 `tests/e2e/cinema-ui.spec.mjs` 验证响应式布局、轮播和海报异常。

## 后台识别与添加采集接口

登录 `/admin.html`，点击顶部“识别采集接口”，粘贴 Apple CMS 的 HTTP/HTTPS、XML/JSON 采集地址，点击“识别并检测”。系统会尝试 HTTPS JSON 形式，保留线路参数，分别显示搜索、详情及标准播放地址的检测结果。也可使用 360、非凡 m3u8 快捷按钮。

检测通过后点击“填入添加表单”，确认内容使用许可并保存，再测活、启用。新源默认停用，授权需人工勾选；已有等价接口可进入编辑。检测返回的 HLS 地址表示结构识别成功，实际播放需要在前台逐条验证。本项目已集成 HLS 播放器，可播放兼容的标准媒体线路。

2026-10-16 线上结果：360 搜索与详情通过；非凡主地址及官方备用地址对 Cloudflare 返回 403，后台显示具体错误。完整操作步骤、地址和验证证据见 [部署与维护记录](DEPLOYMENT.md)。

## 年度首页自动更新

年份按北京时间自动切换，支持“本年上新”“最新电影”“最新剧集”“综艺”“动漫”“热播推荐”。云端每小时第 15 分钟同步，页面显示最近同步时间；保持打开的首页也会在同步期限到达后更新片单。

年度公开片单受上游访问限制时，系统从后台已启用并确认授权的 CMS 源读取当年条目，按片源更新与连载状态生成推荐。最近完整片单保存到 D1 的 `discovery_snapshots` 表；异常时使用同年快照，跨年不会沿用上一年作品作为本年上新。部署前运行 `npm run db:remote` 执行全部迁移。

定时触发分别为 `15 * * * *`（片单与横图）及 `30 */6 * * *`（影视源测活，UTC）。两类任务使用独立调用，分别控制免费套餐的请求与数据库查询用量。

推荐数据表示影片资料，实际播放继续使用搜索与详情返回的可用线路。

# 苍柏 CINEMA v0.6 · Cloudflare Workers + D1 完整项目

一个拥有管理员源管理后台的影视检索与在线播放网站。在 v0.4 的影院 UI、版权投诉页、`awesome-zhuiju-free` 资源站点目录、Internet Archive 搜索、多源聚合和浏览器在线播放的基础上，新增 **可持久化的授权影视源管理后台**。没有独立 VPS 也可部署。代码面向 Cloudflare Workers 免费套餐，实际用量和配额限制取决于你的账号与访问量。

> 不内置商业影视盗版源；使用之前要确认对应 API 和视频内容的使用许可。非商业用途、网站底部「侵权联系删除」声明均不自动赋予播放权。

## v0.6 新增：10 条 TVBox 配置入口已预置到后台

**直接打开 `/admin.html`，向下滚动至「TVBox 配置库」。** 这里会自动出现站长提供的 10 个地址，状态初始为「待检测」。

- 10 个原地址保存在 D1 的 `tvbox_feeds` 表，随 `migrations/0002_tvbox_feeds.sql` 自动注册；**无需逐条手动粘贴**。
- 点击「检测并预览接口」，从对应入口下载内容并尝试解析 `sites` JSON。最多读取 1MB；HTTPS 和老式 HTTP 配置入口均可人工检测，但正式的 Apple CMS 播放搜索源**仅允许公网 HTTPS**。
- 支持纯 JSON、开头 BOM、常见的 `//` / `/* */` 注释及尾随逗号。路径以 `.jpg`、`.png`、`.webp` 结尾但**真实响应为 JSON 文本**时可以解析；如果是真图片、网页、多仓或加密内容，则会明确报错，不伪造结果。
- 检测并解析后，`type: 1` 的可搜索 CMS 源或无 `type` 且具有明确 `api.php/provide/vod` 路径的源进入预览；HTTP 接口会尝试对应 HTTPS 地址，通过搜索 JSON 检测后加入候选。`Spider/JAR/JS`、私网 IP、重复接口及检测失败项会跳过，并显示原因。
- 先逐项检查并确认使用授权，再点击「导入选中源」。导入点播源时默认**停用**，需要到上方影视源管理列表单独「检测」并启用，才能参与前台并行搜索与失败换源。
- 「逐个检测 10 个地址」通过浏览器以两个并发逐项调用独立 Worker 请求，防止单请求耗时过长；不会自动导入、启用或执行第三方脚本。

**当前已确认的限制：** `http://www.饭太硬.cc/tv` 在网页检索中表现为导航页，不直接输出统一 JSON。`yoursmile66/TVBox` 仓库中的 `XC.json` 当前为非标准 JSON 内容；`ggrrttyyiii/CatVodSpider` 仓库的 `json/demo.json` 当前为普通文字。它们的 GitHub 代理返回值可能变化，因此仍保留你给出的原始地址，实际状态由部署后的后台检查结果决定。其他链接尚未完成实地端到端网络访问测试。

### 从已有 v0.5 原地升级

如果你的 v0.5 已经部署，**不要重新创建 D1**：保留原 `database_id`、Workers Secrets 和域名，替换 v0.6 源码后执行：

```bash
npm install
npm run db:remote
npm run deploy
```

迁移只创建预置配置入口表，不会删除或覆盖 `video_sources` 中已保存的 Apple CMS 源。需要先执行数据库迁移，再进入后台。

### 首次部署

首次安装仍按下文「安装部署」执行，创建 D1 时将自动依次执行 `0001_sources.sql` 和 `0002_tvbox_feeds.sql`。部署后仍需配置管理员密钥。**无须设置任何真实影视 API 密钥才能看到这 10 个配置条目**，但必须单独验证和授权实际播放源。

## 功能清单

| 功能 | 状态 | 说明 |
|---|---|---|
| 暗色影院首页、搜索、收藏、移动端 | 已实现 | 继承 v0.4 |
| 后台管理界面 `/admin.html` | 已实现 | 独立后台页面，响应式设计 |
| 管理员登录、退出 | 已实现 | Workers Secret + HMAC HttpOnly Cookie，8 小时会话，校验请求 Origin |
| 数据源新增、编辑、删除、启用/停用 | 已实现 | D1 持久化，改动即时生效，新源默认停用 |
| 手动检测接口 | 已实现 | 检查 CMS 搜索协议、耗时、错误；只检测 API 格式和响应，不能证明视频可播 |
| 自动探活 | 已实现 | 新增源时自动检测，Cron 每 **6 小时**分批复测最多 12 个已确认授权的源 |
| TVBox 导入 | 已升级 | 已预置 10 个配置入口；支持原地址 HTTP/HTTPS 配置检查、JSON 注释/尾逗号容错、图片扩展名伪装 JSON 文本及候选接口预览 |
| Spider/JAR/JS 及其他插件 | 不执行 | 仅筛选 `type:1` 的 JSON Apple CMS 接口（或无 type 且 URL 符合 Apple CMS 模式） |
| 多源并行搜索 | 已实现 | 已启用且授权确认的 D1 源最多并行 12 个，单源失败隔离 |
| 去重与选集 | 已实现 | 同名/同年份影片合并；从多个来源整理同集候选播放地址 |
| 播放失败自动换源 | 已实现，待真实线路验证 | 解码失败、HLS 致命错误、17 秒播放启动超时切换同集候选线路 |
| awesome-zhuiju-free | 已连接目录 | 展示资源导航信息，不把目录网站错误当成 API；后台可单独导入有授权的 TVBox URL |
| 视频转发 | **不提供** | 浏览器直连视频原站，避免 Cloudflare 免费 Worker 大流量代理和平台条款问题 |
| 版权投诉 | 已保留 | `/copyright.html`，需要配置 `COPYRIGHT_CONTACT_EMAIL` |

## 安装部署（首次配置）

环境：Windows PowerShell、macOS 或 Linux；Node.js 24+；Git 可选；你的域名已接入 Cloudflare。

首次复现时，先在 `wrangler.jsonc` 中将 `routes` 设置为 `[]`、保留 `workers_dev: true`，首发使用自己的 `workers.dev` 地址。仓库内的域名和数据库 ID 属于作者的部署实例；下文创建 D1 后将实际返回的 ID 写入配置，随后绑定你自己在 Cloudflare 管理的域名。Worker `name` 也可先改为自己账号下的项目名。

### 1. 获取源码并安装依赖

```bash
git clone https://github.com/zaz52/cangbai-cinema.git
cd cangbai-cinema
npm ci
npx wrangler login
```

使用交付压缩包时，在解压后的源码目录运行 `npm ci` 及后续命令。测试和部署环境使用 Node.js 24。

### 2. 创建 D1 数据库

```bash
npx wrangler d1 create songbai-db
```

Cloudflare 输出中会有 `database_id`，例如 `11111111-2222-3333-4444-555555555555`。**此 UUID 仅作格式说明，不要照抄。**

将 Cloudflare 实际返回的 UUID 写进 `wrangler.jsonc`：

```bash
npm run db:set -- 这里替换为你的真实database_id
```

或手动将 `wrangler.jsonc` 的 `d1_databases[0].database_id` 改为实际 ID。

### 3. 初始化数据库结构

```bash
npm run db:remote
```

出现确认提示时，允许应用迁移。这一步会创建 `video_sources` 与 `tvbox_feeds` 两张表。切记：**先迁移，再部署后台**，否则管理页面会显示数据库查询失败。

本地开发数据独立于线上 D1，可另行执行 `npm run db:local`，该命令会在本地 Wrangler 存储中建立相同表结构。

### 4. 首次部署

```bash
npm run deploy
```

部署后获得 `https://songbai-cinema.<你的子域>.workers.dev`。注意：在完成下一步密钥配置之前，后台登录尚不可用。

### 5. 设置后台管理员密码与签名密钥

```bash
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put ADMIN_SESSION_SECRET
npx wrangler secret put COPYRIGHT_CONTACT_EMAIL
```

分别输入：至少 12 位的后台密码、至少 32 位且与密码不同的随机签名密钥、愿意公开的版权投诉邮箱。所有值都不应该提交到 Git。`ADMIN_SESSION_SECRET` 建议使用独立随机字符串，避免复用管理员密码。Cloudflare Secret 更新后由平台发布新版本，部署完成即可使用。

**安全建议：** 建议对 `/admin.html` 和 `/api/admin/*` 配置 Cloudflare Access 或 WAF 访问策略，避免公开的登录端点遭遇自动化密码尝试。本版实现会话与同源请求校验，但已加入 D1 持久化的每 IP 15 分钟 10 次登录尝试限制，并支持退出撤销会话。

### 6. 进入网站与管理后台

- 影视首页：`https://你的域名/`
- 管理后台：`https://你的域名/admin.html`
- 版权投诉：`https://你的域名/copyright.html`
- 健康检查：`https://你的域名/api/health`

在 Cloudflare 控制台 `Workers & Pages → songbai-cinema → Settings → Domains & Routes → Custom Domain` 绑定你自己的子域名（例如 `tv.example.org`）。自定义域名应当在同一 Cloudflare 账号下管理。

## 日常使用后台

1. 打开 `/admin.html`，输入 `ADMIN_PASSWORD` 登录。
2. 点击「＋ 添加 Apple CMS」，填写 **公网 HTTPS JSON 接口地址**（例如 `https://media.example.org/api.php/provide/vod`，这里只是示例结构，不是真实源）。
3. 勾选你已经取得该接口和相应影视内容使用许可的确认框，点击保存。**新源默认禁用**。保存时会尝试检索关键词「测试」，在后台显示检测情况。
4. 点击「检测」复核响应，看到「正常」后点击开关启用。
5. 访问首页，搜索真实接入的授权内容。会并行查询后台已启用并确认授权的 CMS 影视源。多个源匹配同一标题与年份时会合并展示。
6. 进入影片详情、选择集数和播放地址。如果当前视频出错，客户端在同一集的候选地址间自动尝试其他来源。部分浏览器的 CORS/鉴权/地理限制仍会导致无法播放。

## TVBox 导入的实际范围

后台点击「导入 TVBox」，提供远程 HTTP/HTTPS JSON 配置地址或粘贴 JSON 文本。服务端只**预览** `sites` 数组，跳过不可搜索的项、JS/JAR/Spider 类接口以及无效或私网 URL。仅当你逐个选中已获授权的源，并明确确认权限后，才会写入 D1。所有导入的源默认关闭，需单独检测与启用。

配置内的 HTTP API 会保留原路径及 `source` 等查询参数，尝试对应 HTTPS 接口。每次最多检测 16 项、并发 3 项，逐项验证搜索 JSON；XML、不支持搜索、上游错误和超时均在预览明细展示。接口格式与搜索检测通过后，内容授权及影片实际播放仍需分别确认。

支持格式示例（这些域名都是**示例，不可实际播放**）：

```json
{
  "sites": [
    {"name":"授权点播库 A","type":1,"searchable":1,"api":"https://media.example.org/api.php/provide/vod"},
    {"name":"授权点播库 B","type":1,"searchable":1,"api":"https://media2.example.org/api.php/provide/vod"},
    {"name":"不执行的 Spider","type":3,"api":"csp_example"}
  ]
}
```

支持标准 JSON、JSON 中的普通注释与尾随逗号；仍不解析加密、Base64、完整 JSON5 语法、脚本爬虫或特殊 TVBox 插件。不自动猜测网站中的真实播放接口。服务端下载远程配置仅支持公网 HTTP/HTTPS 入口，限制重定向跳数并逐跳校验目标域名，拒绝私有主机、IP、特殊端口和超限响应，单文件最多 1MB。正式可启用的 CMS 搜索源仍严格限定公网 HTTPS。一次最多导入 30 项。

`awesome-zhuiju-free` 的 `resources/resources.json` 记录的是 URL、描述和状态，**它并未为全部网站提供影片级搜索及播放 API**。资源来源与许可声明详见 https://github.com/laoma528/awesome-zhuiju-free 。

## 持久化与免费额度

- 源列表、开关、检测时间、健康状态存 D1，Worker 重启也不会丢。
- 收藏和观看记录保存在浏览器本地 IndexedDB/localStorage，跨设备同步尚未实现。
- 12 个授权 CMS 源并行搜索，每个请求最多等待约 8 秒。大量源会增加子请求数，应根据 Cloudflare Free 实际额度评估。
- Cron 每 6 小时轮询最多 12 个已确认授权源（不会未经允许自动启用或关闭源），记录 API 健康状况。
- Worker 不会读取或中转外部 MP4/HLS 的视频数据，原始 CDN 的播放可用性、跨域配置和版权由数据源控制。

## 已有 v0.4 项目升级

可先备份 v0.4 项目和配置，然后将 v0.6 文件完整替换。Cloudflare Worker 名仍为 `songbai-cinema`。本版 D1 源列表成为唯一生效的 CMS 源数据：**旧 `VOD_SOURCES` Secret 在 DB 已绑定时不会读取**，请用后台手动添加或经授权后导入旧源，以保证「停用」真正生效。旧公开馆藏已退出前台搜索与详情访问，首页使用热门影视推荐。

## 检查代码

```bash
npm test
# 本地开发需先配置数据库和 .dev.vars
npm run db:local
npm run dev
```

如果已设置 Cloudflare D1 database ID，`wrangler dev` 可以读取 `.dev.vars`。从 `.dev.vars.example` 复制为 `.dev.vars`，配置本地后台密码与签名密钥即可。**不要提交 `.dev.vars` 到 Git。**

`tests/admin.test.mjs` 使用 Node.js 测试用内存 SQLite 验证登录、D1 存取、启停及 TVBox 预览导入；`tests/providers.test.mjs` 验证并发搜索、同名聚合和换源线路解析。浏览器后台布局测试使用 Playwright 的模拟响应，不代表已经在真实 Cloudflare 环境运行成功。

## 已知限制与安全边界

- 检测 API 200 与 CMS 搜索格式，不证明实际影片视频必能播放；在线播放需要合法授权且浏览器可直连的 MP4/WebM/HLS。
- 现只支持 Apple CMS 标准 JSON 接口；不支持 Spider 规则或未知影视网站自动爬取。
- 服务端源管理只允许 HTTPS 域名，禁止私网 IP 和常见内部主机；拒绝重定向并限制响应大小。第三方域名 DNS 变更风险不能仅依靠应用层字符串校验完全消除，应审慎导入和限制后台访问。
- 管理后台的账号体系为单管理员口令，无多人角色和审计历史；公网运营应辅以 Cloudflare Access/WAF。
- 非营利、声明来源及「侵权联系删除」均不能代替影视内容的公开播放授权。

## 参考链接

- Cloudflare D1：https://developers.cloudflare.com/d1/worker-api/
- Cloudflare Workers Static Assets：https://developers.cloudflare.com/workers/static-assets/
- Cloudflare Cron：https://developers.cloudflare.com/workers/configuration/cron-triggers/
- TVBox 配置示例和影视目录：https://github.com/laoma528/awesome-zhuiju-free

## 测试记录（v0.6）

运行 `npm test`：**27 项 Node.js 自动化测试通过**（既有 20 项 + 新增 7 项，涵盖十个 URL 的迁移记录、管理员会话、配置解析和异常隔离）。
`python tests/feed_browser_smoke.py`：浏览器模拟数据验证 10 条预置卡片、候选接口预览、手机布局和脚本异常情况，**不代表这些第三方网站实际能访问或播放**。

截至 2026-10-16，本地环境无法稳定连接所提供的所有外部配置域名，未进行 Cloudflare 真实部署验证，请以上线后后台的检测结果为准。配置 URL 健康 ≠ 影片可以播放。站点非盈利及侵权投诉声明不自动赋予使用第三方影视内容的授权。
