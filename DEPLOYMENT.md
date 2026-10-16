# 苍柏 CINEMA v0.6.1 部署与维护

验收日期：2026-10-16，Asia/Shanghai。原始 v0.6 压缩包保持原样，修复版源码在本目录。

## 2026-10-16 16:28 右上角头像替换

用户原话：“最右边的cb换成头像图二”。

- 将首页右上角 CB 文字替换为用户提供的照片，保存为 `public/assets/avatar.jpg`。照片字节保持原样；通过圆形容器和 CSS 缩放展示头像，保留原有点击进入影视源管理后台的链接及无障碍名称。
- 涉及 `public/index.html`、`public/cinema.css`、头像图片和本记录。
- 静态 diff 检查通过。线上图片返回 HTTP 200，SHA-256 与原图一致；原图为 1080×1080，头像容器为 33×33、圆角 50%。1920、1440、1024、390px 宽度均无横向溢出，页面脚本错误为 0；点击头像到达后台，Cloudflare 将 `/admin.html` 规范化为 `/admin`。
- 证据为 `reports/avatar-live.json` 和 `reports/avatar-live-header.png`。本轮为图片和展示样式调整，使用线上浏览器检查完成验收。
- 已发布至 `https://weiyi.indevs.in/`，Cloudflare 版本 `96f38468-f277-4f09-bbe7-b723f373e607`。源码同步至公开仓库 `zaz52/cangbai-cinema` 的 `main` 分支。

## 2026-10-16 15:53 PC 高清横幅接入与上线

用户原话：“pc端为啥不是横屏的海报”“你不能自己做吗”。

- PC 首屏采用全宽横版宣传图，优先轮播具有横图资料的当年作品；当前匹配《伟大的长征》2260×744 和《美人余2026》1800×750。两张图片均来自参考站公开宣传图资料，保留来源链接；搜索和播放继续使用既有后台源。
- 新增 `src/banner-art.js`，限定读取参考站首页中的宣传图和详情路径，按电影/剧集类型、当年及规范化片名匹配。允许当前年份后缀，续集与不同类型保持独立。片单同步时每小时更新横图资料，D1 快照保存最近结果，结构版本更新为 3。
- 通过 `scripts/refresh-banners.mjs` 原样保存 6 张通过尺寸检测的宣传图备份至 `public/assets/banners/`；`public/data/banners.json` 记录来源、原始分辨率、字节数及对应文件。相同图片优先从本站静态资源加载，上游异常时使用备份和已有记录；首屏显示“宣传图来源”链接。
- 轮播优先选择可用横图，单张图片网络失败后退出当前会话候选并切换到另一张，保留封面回退。首页分类、题材与地区筛选、每小时片单更新、移动端、搜索、后台及播放器继续沿用。
- 片单与横图同步 Cron 为 `15 * * * *`；源测活独立为 `30 */6 * * *`（UTC），每次最多 12 个源。任务拆分符合免费套餐的调用预算，相关上限参见 [Workers 文档](https://developers.cloudflare.com/workers/platform/limits/) 与 [D1 文档](https://developers.cloudflare.com/d1/platform/limits/)。
- 涉及首页脚本与样式、`src/discovery.js`、`src/index.js`、`wrangler.jsonc`、新增横图模块/备份/维护脚本、相关测试和 README。本次更新未改变后台凭据及影视源配置。
- 代码验证：67 项代码测试通过；13 项浏览器流程通过，覆盖全宽图片与标题匹配、单张失败回退、原有海报异常、年度刷新、分类、搜索、后台 CRUD 和播放换源。Cron 拆分后复跑 67 项代码测试通过，Worker dry-run 构建完成。证据为 `reports/wide-banners-unit.txt` 和 `reports/browser.json`。
- 线上真实验证：`bannerSync=live`，Cloudflare 成功获取实时横图资料；两张横图均加载本站备份，1920px 屏幕实测元素 1920×595，采用 `cover`、布局标记为 `landscape`，片名与图片匹配。7 种屏幕宽度（1920、1440、1200、1024、768、390、320px）均无横向溢出；四行分类正常，动作电影筛出 13 部，搜索《水饺皇后》返回 6 项，页面脚本错误为 0。
- 证据为 `reports/wide-banners-live.json`；两张电脑截图为 `reports/wide-banners-live-slide-0.png`、`reports/wide-banners-live-slide-1.png`，手机截图为 `reports/wide-banners-live-mobile.png`。首轮检测等待图片尺寸头信息后过早读取布局标记，调整验证脚本等待图片完整加载与 onload 处理结束后通过。
- 当前验证覆盖即时线上同步；自然小时周期未等待，定时入口与到期更新由受控测试覆盖。当前年度片单中有 2 部匹配备份横图；其他备份保留待对应作品进入片单后匹配，横幅数量随实际资料更新。
- 已发布到 `https://weiyi.indevs.in/`，Cloudflare 版本 `440a9f4f-31b3-4d5b-8a44-ac1cf7772a3e`。前一版本 `150aa668-8249-411a-ba42-edaaacd47f7d` 可用于回滚。代码同步至公开仓库 `zaz52/cangbai-cinema` 的 `main` 分支。

## 2026-10-16 15:33 首页海报清晰度与细分类

需求摘要：用户对比自身首页与饭搭子影视截图，反馈首屏海报模糊，要求参考其首页并补充下方分类。

- 通过浏览器查看参考站，确认其首屏使用独立的横版宣传图。当前影院检查到的首屏封面原图为 270×404，先前被裁切放大为整屏背景；当前采集片单的横幅字段为空。
- 首屏改为完整比例的海报与片名信息组合，海报显示尺寸受原始分辨率限制。支持 `vod_pic_slide` 横幅，宽度至少 1280px、宽高比至少 1.5 时使用横图布局；横幅加载失败尝试同一作品封面。哔哩哔哩首屏请求原图，保持卡片缩略图。保留右侧作品切换、轮播、暂停与减少动态效果偏好。
- 首屏下方新增四行分类：电影（动作、喜剧、爱情、科幻、恐怖）、电视剧（国产、欧美、日本、韩国、港台）、综艺（大陆、港台、日韩、欧美）、动漫（国漫、日漫、欧美、其他）。根据上游真实题材、地区与分类名筛选当前年度片单，提供分类内切换、数量和空状态。国产地区匹配区分大陆和港台。
- 后端年度采集增加综艺、动漫及题材、地区、横幅元数据；每类最多返回 48 部年度作品，首页每栏展示 12 部。每个源最多 12 个采集请求，最多 3 个不同主机；沿用每小时同步、D1 快照与故障回退，快照结构版本更新为 2。
- 涉及 `public/app.js`、`public/cinema.css`、`src/cms-discovery.js`、`src/discovery.js`、相关代码与浏览器测试、README 和本记录。后台账户、影视源配置及数据库表结构继续沿用。
- 代码验证：63 项通过，Worker dry-run 构建完成；12 项浏览器流程通过，覆盖图片尺寸、高清横幅、失效回退、四类筛选、响应式、自动刷新及原有搜索、播放换源与后台操作。补充港台地区边界后，7 项首页相关流程再次通过。证据为 `reports/homepage-unit-tests.txt`、`reports/homepage-build.txt` 与 `reports/browser.json`。
- 线上真实验证：四类片单分别为电影 48、电视剧 38、综艺 48、动漫 42 部；176 项均有题材、地区字段。动作电影、国产剧、大陆综艺、国漫入口有实际匹配，搜索《水饺皇后》返回 6 项。1880、1440、1200、1024、768、750、390、320px 宽度均无横向溢出，页面脚本错误为 0。海报采用 `contain`，测得元素 270×390、原图 270×404。证据为 `reports/homepage-posters-live.json`，截图为 `reports/homepage-posters-live-desktop.png` 和 `reports/homepage-posters-live-mobile.png`。
- 当前限制：已接入片单暂未返回高清横幅，线上采用完整海报布局；源图自身的压缩程度仍由上游决定。分类覆盖当前年度采集片单，用户可继续搜索其他片名。本轮线上验证范围为首页、图片、分类与搜索；第三方影片播放可用性按既有流程逐条检测。
- 发布地址：`https://weiyi.indevs.in/`。最终 Cloudflare 版本为 `150aa668-8249-411a-ba42-edaaacd47f7d`；此前版本 `32a40454-e9e4-40f8-9c21-95e83bfb1011` 可用于回滚。源码同步到公开仓库 `zaz52/cangbai-cinema` 的 `main` 分支。

## 2026-10-16 15:08 GitHub 公开仓库发布

用户原话：“给我推送到 GitHub 上吧，公开的”。

- 公开仓库：`https://github.com/zaz52/cangbai-cinema`，分支 `main`，仓库主页设置为苍柏影院域名。源码包含当前蓝色门户界面、前台导航调整、Worker、全部 D1 迁移、后台、测试和部署指南。
- 建立项目 Git 仓库和初始提交，Git 提交使用 GitHub noreply 邮箱。添加 `.gitattributes` 处理文本和二进制文件；扩展 `.gitignore`，将管理员凭据、私钥、压缩包、Wrangler 登录及本地数据库、依赖、测试报告等排除在公开源码之外。
- 发布检查逐项扫描暂存内容，核对真实管理员密码、Cloudflare OAuth、GitHub 凭据及常见密钥格式；敏感信息与大文件检查结果保存在本地 `reports/github-publication-audit.json`。
- README 增加公开仓库地址，首次部署说明采用 Git clone 与 `npm ci`，运行环境明确为 Node.js 24。已有 HLS 组件许可证随源码保留。
- GitHub Actions 配置为主分支推送和 PR 自动执行代码测试、浏览器流程及 Worker 构建检查。线上发布由手动工作流触发，需要站长在 GitHub 的 production 环境配置 Cloudflare Secrets 和部署 Variables；线上管理员密钥继续由 Cloudflare Workers Secrets 管理。
- 远端验收使用 GitHub 仓库可见性、默认分支和提交信息，并比对 `git ls-remote` 的 `main` SHA。代码验证沿用已通过的 62 项代码测试、10 项浏览器流程及导航调整后的 5 项相关回归；GitHub 执行结果从仓库 Actions 查看。
- 本次为源码公开托管；当前线上版本继续使用 `32a40454-e9e4-40f8-9c21-95e83bfb1011`，站点为 `https://weiyi.indevs.in/`。

## 2026-10-16 14:56 移除前台影视源入口

用户原话：“把影视源这个删掉吧，没有用”，截图指向顶部导航的“影视源”。

- 移除前台导航中的影视源目录入口；导航为首页、电影、电视剧、热播榜、搜片、收藏。访问旧的影视源目录书签时回到首页。
- 更新关于说明、首页描述和 README 中的当前入口说明。后台继续管理播放源，搜索与播放沿用已配置的影视源。
- 涉及 `public/app.js`、`public/index.html`、README 和本记录。
- 本轮验证：JavaScript 语法检查通过；5 项相关浏览器流程通过，覆盖首页、分类、收藏、海报异常和播放换源。证据 `reports/remove-source-nav-tests.txt`。
- 线上真实验证：电脑、手机导航均已移除入口，旧书签回首页且未请求目录 API；搜索《水饺皇后》返回 6 项，后台入口可访问，公开接口仍返回 12 个参与搜索的源，脚本错误为 0。证据 `reports/remove-source-nav-live.json`，截图为 `reports/removed-source-nav-desktop.png` 和 `reports/removed-source-nav-mobile.png`。
- 部署版本：`32a40454-e9e4-40f8-9c21-95e83bfb1011`，输出见 `reports/deploy-remove-source-nav.txt`。源码包已同步更新。

## 2026-10-16 14:51 影院门户 UI 更新

需求摘要：参考 `https://fdzys.com/` 的页面风格调整网站；用户确认目标为“苍柏影院（weiyi.indevs.in）”。通过正常浏览器查看了参考站的电脑和手机布局。

- 首页采用黑灰底色、蓝色选中导航、大横幅推荐和“正在热播 / 电影 / 电视剧”分栏片单。提供电影、剧集、热播、收藏快捷入口，手机保留搜索和底部导航，右侧提供返回顶部与关于入口。
- 横幅显示现有片单中的实际作品，提供最多 6 个手动选择项及每 7 秒轮播。悬停、焦点停留、弹窗、页面隐藏和系统减少动态效果偏好会暂停自动切换。片名、海报、集数、评分和年度信息继续来自现有年度片单接口。
- 桌面端每行 6 张海报、平板每行 4 张、手机每行 2 张。卡片海报失效时展示片名和“海报暂缺”，该封面在当前会话中退出轮播候选；搜索与详情仍可继续使用。
- 保留每小时更新、年度切换、聚合搜索、同名合并、收藏、源目录、播放、同集有限换源及管理后台。数据库和影视源继续沿用现有配置，本次线上操作为搜索、详情和后台查看；管理员会话正常登录并退出。
- 涉及 `public/index.html`、`public/app.js`、新增 `public/cinema.css`、`public/copyright.html`、`tests/e2e/cinema-ui.spec.mjs`、`tests/e2e/discovery.spec.mjs`、`scripts/run-local-test.mjs`、README 和本记录。新增样式表加载在原 `style.css` 之后。
- 修复本机测试启动问题：Wrangler 已完成的迁移命令存在进程继续驻留的情况。重复运行测试时先以只读方式检查本地 D1 的全部迁移记录；已完成的数据库可直接启动测试服务。首次初始化继续执行原 Wrangler 迁移流程。
- 代码测试：62 项通过。浏览器流程：10 项通过，包含真实本地 Worker/D1 后台操作、并行搜索合并、媒体解码、有限换源、年度刷新、六种宽度的 UI、轮播与减少动态效果偏好、海报全部失败时的显示和搜索。证据为 `reports/unit-tests.txt`、`reports/browser.json`。
- 线上真实验证：14:50 起复测，热播、电影、电视剧各展示 12 部；36 张卡片中 34 张上游海报加载成功，2 张使用片名占位；轮播、分类筛选和移动端底部分类通过。1440、1024、768、390、320px 宽度均无横向溢出，脚本错误为 0。
- 线上搜索《水饺皇后》返回 6 项结果，所选详情返回 54 个候选视频地址。通过测试入口把本项目公开 CC BY 3.0《Big Buck Bunny》预告片元数据送入现有播放器，直连 W3C MP4 播放超过 2 秒，`readyState=4`、无解码错误。该样片测试独立于聚合搜索入口；第三方影片的候选地址检测和实际可播状态分别记录。
- 后台登录后读回 15 个影视源，接口识别弹窗、退出和版权投诉邮箱通过；唯影导航子域名仍正常可访问。证据为 `reports/cinema-ui-live.json`；截图为 `reports/cinema-ui-live-desktop.png`、`reports/cinema-ui-live-mobile.png`、`reports/cinema-ui-live-movies.png`、`reports/cinema-ui-live-player.png`。
- 当前限制：两张上游海报暂不可用，已显示片名占位；其他影片的画质、播放权限和媒体源可用性由对应来源决定。UI 更新没有将全部片单条目标记为播放验证通过。
- 部署版本：`ee13e0cf-fc92-4152-ac76-bb964bdab5be`，部署输出见 `reports/deploy-cinema-ui.txt`，网站为 `https://weiyi.indevs.in/`。需要恢复此前界面时，可使用 Wrangler rollback 选择本轮之前的版本 `5f3e5de2-bc1a-43c9-887e-265c11e1452a`。
- 完整源码包：`苍柏-CINEMA-v0.6.1-部署修复版.zip`，管理员凭据独立交付；源码打包脚本检查密码和私钥并验证 ZIP 完整性。

## 2026-10-16 13:18 苍柏更名与采集接口识别

需求摘要：“名字改成苍柏”，检查 360、非凡采集接口，并提供后台添加功能。

- 首页、后台、版权页、邮件主题、服务健康信息及开放授权演示源已更名为“苍柏 CINEMA”；现有 Worker、D1、域名和管理员密码继续使用原配置。
- 后台顶部新增“识别采集接口”：支持粘贴采集地址，转换 HTTP 为 HTTPS、XML 格式标记为 JSON，保留 `from/ffm3u8` 等线路选择参数，并显示搜索、详情、标准播放地址数量和错误原因。提供 360 m3u8、非凡 m3u8 快捷填入按钮。
- 识别过程保持源列表不变；成功后可填入新增表单。同域名的等价 JSON 地址可提示已有源并进入编辑。新增源的授权确认保持未勾选，保存后默认停用，测活通过后可启用。
- 截图中“添加播放器”的教程适用于上游列出的 CMS 系统；本项目已集成 HLS 播放能力。网页云解析链接在结果中归入其他候选，使用标准 HTTPS HLS/MP4 等线路播放。
- 涉及 `src/cms-inspector.js`、`src/admin-api.js`、`public/admin.html`、`public/admin.js`、`public/admin.css`、品牌相关公开页面与服务代码、测试、README 和维护文档。
- 代码测试：62 项通过；受控浏览器测试：8 项通过，覆盖接口格式转换、权限与 CSRF、预览、新增默认停用、重复接口编辑及原有播放换源流程。证据见 `reports/unit-tests.txt`、`reports/browser.json`。
- 线上真实验证：2026-10-16 13:15，首页、后台、版权页和健康检查均显示苍柏；360 搜索返回 2 项，《水饺皇后》详情返回 1 个 HLS 地址；后台预填、授权未勾选、390px 布局通过，脚本错误为 0，预览前后源列表一致。证据见 `reports/brand-inspector-live.json` 及 `reports/inspector-live-*.png`。
- 未解决上游限制：非凡 `api.ffzyapi.com` 及其帮助中心公布的备用 `cj2.ffzyapi.com` 本机可返回 JSON；Cloudflare 线上搜索均返回 HTTP 403。证据见 `reports/ff-backup-live.json`。当前检测结果由后台如实显示，需上游允许 Cloudflare 访问或提供可用的授权接口。
- 验证范围：360 新接口完成真实搜索、详情和媒体地址结构检测；360 与非凡新增线路的浏览器视频解码均未验证。源的使用许可需由管理员逐项确认。
- 部署版本：`5f3e5de2-bc1a-43c9-887e-265c11e1452a`，站点 `https://weiyi.indevs.in/`。本次交付源码包名称为 `苍柏-CINEMA-v0.6.1-部署修复版.zip`，管理员凭据独立保存。

### 如何添加截图中的接口

1. 打开 `https://weiyi.indevs.in/admin.html`，登录后点击顶部“识别采集接口”。
2. 点击“填入 360 m3u8”，或粘贴任意已获许可的 Apple CMS 采集地址。可调整测试片名，点击“识别并检测”。
3. 检查搜索、详情和标准视频地址结果。搜索为空时可以换片名重测；返回 403、超时、XML 或网页时，按显示的原因联系上游或更换其正式提供的 JSON 接口。
4. 点击“填入添加表单”，确认名称与地址；已有接口可点击“编辑已有接口”。
5. 确认接口和内容使用许可后勾选授权、保存，再在源列表中点击“检测”，通过后启用。启用后的源参与前台并行搜索和同集自动换源。
6. 在前台搜索刚才的测试片名，选择具体线路播放，检查能否开始播放、持续播放及切换集数；实际播放结果单独记录。

| 接口 | 规范化 JSON 地址 | 当前线上结果 |
| --- | --- | --- |
| 360 m3u8 | `https://360zyzz.com/api.php/provide/vod/from/360m3u8/at/json` | 搜索、详情、HLS 地址结构通过 |
| 非凡 m3u8 | `https://api.ffzyapi.com/api.php/provide/vod/from/ffm3u8/at/json/` | Cloudflare 返回 403 |
| 非凡官方备用 m3u8 | `https://cj2.ffzyapi.com/api.php/provide/vod/from/ffm3u8/at/json/` | Cloudflare 返回 403 |

非凡备用地址依据：[非凡资源站帮助中心](https://api.ffzyapi.com/help/)。接口状态会随上游策略变化，使用后台重测结果。

## 2026-10-16 04:42 年度首页与自动更新

需求摘要：随年份展示最新界面，新片、新剧、热剧出现后自动更新。

- 首页年份按 Asia/Shanghai 日期自动计算；栏目分为“本年上新”“最新电影”“最新剧集”“热播推荐”。首屏与下方专题使用当前片单的海报、片名，页面显示最近同步时间。
- 优先读取哔哩哔哩的年度筛选片单，使用已核实的 `release_date` 完整日期范围；排除明确标注的待上映和未来日期作品。Cloudflare 线上访问该年度接口实际返回 412，因此自动切换到后台已启用并确认授权的 CMS 源。
- CMS 更新通道按域名去重，最多读取 3 个源，动态识别剧情片、动作片、国产剧等分类 ID，筛选片源年份字段等于当前年、按更新日期去重排序。热播推荐参考连载更新、片源访问计数和更新时间；此通道不冒充外部权威热度榜。
- 云端定时任务 `15 * * * *` 每小时第 15 分钟同步，片源健康检查继续每 6 小时执行。边缘缓存最长 1 小时，D1 持久化最近完整片单；主通道和 CMS 通道均不可用时使用同年历史快照，并每 5 分钟重试。跨年时不将上一年快照标记为新年内容。
- 打开的首页每分钟检查同步期限，到期或返回页面时重新获取片单；搜索、播放和收藏操作期间保留对应操作状态。浏览器自动刷新的时间推进测试已通过。
- 新增 `migrations/0004_discovery_snapshots.sql`，已在线上执行。D1 已读回 2026 年片单、24 个原始电影条目、19 个原始剧集条目，页面各取最多 12 项组成 24 部上新和 24 部推荐。
- 涉及 `src/discovery.js`、`src/cms-discovery.js`、`src/index.js`、`public/app.js`、`public/style.css`、`public/data/popular.json`、`wrangler.jsonc`、上述迁移与相关测试。
- 代码测试：57 项通过，覆盖跨年、未来日期过滤、缓存过期、D1 保存与故障回退、小时定时任务、CMS 分类和备用更新。浏览器流程：7 项通过，包含模拟 61 分钟后的新片替换。
- 线上真实验证：片单为 2026 年、`stale=false`、来源为已接入 CMS；24 张海报均正常加载，栏目切换、专题替换、点击搜索、390px 布局均通过，脚本错误为 0。
- 线上证据：`reports/annual-live.json`、`reports/annual-api-live.json`、`reports/annual-d1.json`、`reports/annual-cron.json`、`reports/discovery-migration.txt`。截图为 `reports/annual-home-desktop.png`、`reports/annual-home-mobile.png`、`reports/annual-hot-desktop.png`、`reports/annual-spotlights.png`。
- 验证范围：当前真实同步、数据库持久化和 Cloudflare 定时配置已验证；完整自然小时周期尚未等待，定时入口与浏览器到期刷新由受控测试验证。新增推荐条目仍按片名搜索实际线路，推荐展示不表示每个视频均已解码验证。
- 部署版本：`08044c1f-d768-4204-9565-dedc0c679a42`，站点 `https://weiyi.indevs.in/`。

## 2026-10-16 04:21 热门专题替换与旧馆藏退出

用户原话：“这里面的影片也要改了啊，那些老影片不需要留着了”。截图指向首页下方“回到自然”“城市的旧时光”两张专题卡片。

- 已替换为热门电影、热播剧集专题，使用当前热榜的真实海报与片名。本次线上显示《水饺皇后》《朝朝如念》，点击会按片名检索已接入的影视源。
- 清理自然影像、城市记忆、英文馆藏提示和旧搜索建议；搜索页增加热门电影、热播剧集分类入口。
- Internet Archive 退出公开来源列表与聚合搜索，旧馆藏详情 ID 返回已下线信息。原有已配置 CMS 源继续参与搜索与播放。
- 浏览器加载新版时会过滤旧馆藏收藏，保留 CMS 影视收藏和热门推荐收藏。此迁移在每位用户打开新版页面时执行。
- 涉及 `public/app.js`、`public/style.css`、`src/index.js`、`src/providers.js`、`scripts/check-live.mjs`、`README.md` 与相关测试。
- 代码测试：49 项通过；浏览器回归：6 项通过，覆盖专题卡片、片名搜索、热播分类、收藏迁移、源管理和播放换源。
- 线上真实验证：两张海报加载成功、旧文案消失、点击《水饺皇后》返回 6 个合并条目、热播分类与 390px 手机布局通过，页面脚本错误为 0。旧馆藏来源和详情均已退出，见 `reports/spotlights-live.json`。
- 截图：`reports/spotlights-desktop.png`、`reports/spotlights-mobile.png`。HTTP、数据库、搜索与详情检查见 `reports/online.json`；本轮未新增影片解码测试，上一轮真实自动换源播放结果保存在 `reports/liangzi-playback.json`。
- 部署版本：`b4c31bb7-ac07-4aa3-ac74-76e9786b6cb3`。部署地址为 `https://weiyi.indevs.in/`。

## 2026-10-16 04:16 量子源启用与真实自动换源验证

用户原话：“可以使用”。在前文接口与内容授权说明后，按此次确认接入量子 m3u8 JSON 源。

- 线上 D1 已保存并启用 `量子 m3u8`，ID 为 `s-m3u8-1melkf4`，地址为 `https://cj.lziapi.com/api.php/provide/vod/from/lzm3u8/`。测活通过，用户确认字段已记录；原有其他源保持配置。
- 真实搜索：“测试2022”返回 2 个含该源的合并条目，“水饺皇后”返回 4 个含该源的条目，详情提供 HLS 候选。见 `reports/liangzi-enabled.json`。
- 发现并修复：`HD中字`、`HD国语` 等电影清晰度标签此前与“正片”使用不同集标识，导致同片换源候选不完整。现按电影标签归一化；数字分集和上下部保持独立。
- 涉及 `src/providers.js`、`tests/providers.test.mjs`、`tests/fixture-worker.js`、`tests/e2e/movie-fallback.spec.mjs`。
- 代码测试：47 项通过；完整浏览器回归：5 项通过。批量导入用例首次运行出现一次未显示候选的超时，单项复测和随后完整回归均通过，未复现。
- 线上真实播放与换源：在《水饺皇后》中选择“量子 m3u8”，其媒体地址失败后自动切到既有“三六零 · 360zy”线路；视频 `readyState=4`，播放时间从 1.018827 秒推进至 12.036917 秒，尝试索引为 `[0,1]`。390px 手机布局通过，页面脚本错误为 0。
- 证据：`reports/liangzi-playback.json`、`reports/liangzi-playing.png`、`reports/liangzi-playing-mobile.png`；修复前观察另存为 `reports/liangzi-playback-before-fix.json`。
- 实际范围：量子搜索接口正常；《水饺皇后》《测试2022》及另外 3 个新近条目的量子媒体清单在当前测试网络返回 404。量子原线路的实际播放尚未通过。线上真实播放成功来自自动切换后的既有源，不将该结果归为量子视频播放成功。
- 部署版本：`6bb5a755-8fac-4eea-8ba0-fbaef3ee7864`。当前源配置保存在远程 D1，后续代码部署会继续使用该数据库。

## 2026-10-16 04:07 量子采集接口联调

需求摘要：根据用户截图检查 `cj.lziapi.com` 的综合、量子云、量子 m3u8 采集接口。

- 截图中的 `/at/xml/` 地址返回 XML。移除该输出格式后，对应三条路径均返回标准 Apple CMS JSON，现有适配器可以处理。
- Cloudflare 线上验证：三个 JSON 搜索接口均返回 14 条“测试”关键词结果；后台预览前后 D1 源列表一致，见 `reports/liangzi-live.json`。
- 本机真实详情验证：综合与 m3u8 接口的样本包含 1 个符合当前适配器规则的 HTTPS 媒体候选；量子云样本提供网页解析线路。媒体候选数量表示字段解析结果，实际视频播放仍待验证。
- 证据：`reports/liangzi-interface-check.json` 记录原 XML、JSON、搜索与详情字段结果；网站首页在本机网络下返回地区不可用 403，各采集 API 独立返回 200。
- 当前决定：现有代码支持这组 JSON 地址，无需修改适配器。待确认接口及内容使用授权后，由后台添加、测活和启用；站点“欢迎采集”文案与影视内容播放传播授权分别核实。
- 本次变更为联调报告及维护文档；代码和线上部署版本保持 `f3768976-0c5a-4d0f-9488-2a6facb3f4e9`。既有 46 项代码测试、4 项浏览器测试结果见上一轮记录；本轮执行了上述真实接口检查。

| 用途 | 已检测的 JSON 地址 |
| --- | --- |
| 综合 | `https://cj.lziapi.com/api.php/provide/vod/` |
| 量子云 | `https://cj.lziapi.com/api.php/provide/vod/from/liangzi/` |
| 量子 m3u8 | `https://cj.lziapi.com/api.php/provide/vod/from/lzm3u8/` |

## 2026-10-16 04:03 TVBox HTTP 接口识别修复

需求摘要：检测 `https://ys.cxkjg.cn/api/provide/tvbox`，解释接口识别失败并修复兼容问题。

- 原因：该 JSON 配置包含 12 个 type:1 站点，API 地址均使用 HTTP；原导入器按正式源 HTTPS 要求将它们跳过。
- 修复：导入预览会构造同域名、同路径、保留查询参数的 HTTPS 地址，逐项请求搜索 JSON。检测通过后加入候选列表，后台展示每条失败原因。远程地址和粘贴 JSON 共用此流程。
- 边界：每次最多检测 16 个 HTTP 候选、并发 3 个、每项 7 秒、响应上限 350KB；正式源保持 HTTPS，重定向与私网地址拒绝访问。搜索检测与内容授权、实际影片播放分别验证。
- 涉及 `src/tvbox.js`、`src/admin-api.js`、`public/admin.js`、`public/admin.css`、`tests/tvbox-https.test.mjs`、`tests/fixture-worker.js`、`tests/e2e/tvbox.spec.mjs`。
- 代码测试：46 项通过；受控浏览器流程：4 项通过，含原有后台、30 源分批导入、播放器换源和热门首页。
- 线上真实验证：Cloudflare 返回 12 条明细，后台显示 5 个候选，390px 手机布局通过，预览前后 D1 源列表一致。证据见 `reports/chuangxiang-live.json`，截图为 `reports/chuangxiang-desktop.png` 和 `reports/chuangxiang-mobile.png`。
- 部署版本：`f3768976-0c5a-4d0f-9488-2a6facb3f4e9`。

| 接口 | 本次线上实际结果 |
| --- | --- |
| 创享主库、速博、红牛、U酷、光速 | 5 个 HTTPS 搜索 JSON 检测通过 |
| 金鹰、非凡、量子 | 3 个返回 XML，当前 JSON 适配器不兼容 |
| 闪电、WS、HD(SN) | 3 个上游返回“暂不支持搜索” |
| 樱花 | 上游采集站返回 403 |

使用方式：后台点击“导入 TVBox”，粘贴上述地址并解析；获得相应接口和内容使用授权后，选择候选并确认导入，再测活和启用。当前这些第三方候选的授权与实际影片播放仍待确认。

## 2026-10-16 首页热门影视更新

需求摘要：将首页与空白搜索页的老馆藏列表替换为热门影视作品。

- 首页展示 12 部热门电影与 12 部剧集，使用哔哩哔哩公开影视热榜的片名、海报及评分。
- 支持全部、电影、剧集分类；热门作品可收藏，点击海报会使用片名检索当前接入的片源。
- 热榜在边缘缓存 1 小时，服务异常时使用随包提供的榜单快照。推荐条目作为影视资料展示，播放线路来自实际搜索结果。
- 海报使用公开 CDN 的竖版缩略图；页面保留原有深色影院与荧光绿配色。
- 涉及 `src/discovery.js`、`src/index.js`、`public/data/popular.json`、`public/app.js`、`public/style.css` 与相关测试。
- 代码测试 42 项通过，浏览器流程 3 项通过；线上海报、分类和手机布局复核见 `reports/popular-live.json`。
## 使用入口

| 用途 | 地址 |
| --- | --- |
| 网站 | https://weiyi.indevs.in/ |
| 管理后台 | https://weiyi.indevs.in/admin.html |
| 版权投诉 | https://weiyi.indevs.in/copyright.html |
| 健康检查 | https://weiyi.indevs.in/api/health |
| 备用域名 | https://songbai-cinema.504628394.workers.dev/ |

管理员密码单独保存在交付目录的 `管理员登录信息.txt`。版权投诉邮箱为 `1845779520@qq.com`。

在顶部搜索框输入“大雄兔”，打开《Big Buck Bunny》预告片并开始播放。示例影片使用 CC BY 3.0，页面保留 Blender Foundation 署名和许可信息，视频由浏览器直连 W3C 公共媒体示例站点。

## 已部署资源与数据

| 项目 | 当前配置 |
| --- | --- |
| Worker | `songbai-cinema` |
| D1 | `songbai-db`，APAC |
| D1 ID | `fc329951-718f-4539-8014-4f8b4f967474` |
| 数据绑定 | `DB` |
| 静态资源绑定 | `ASSETS` |
| 域名接入 | `weiyi.indevs.in/*` Workers 路由 |
| Cron | `15 * * * *` 每小时同步年度片单与横图；`30 */6 * * *` 每 6 小时探活，均为 UTC |
| 浏览器视频 | 直接访问媒体原站，支持 MP4/WebM/Ogg/HLS |

四次迁移均已在线上 D1 执行：`0001_sources.sql`、`0002_tvbox_feeds.sql`、`0003_security_events.sql`、`0004_discovery_snapshots.sql`。源、配置检测结果、会话、登录限流、测活日志和年度片单快照保存在 D1；收藏保存在用户浏览器。

域名原有外部托管 DNS 记录，因此采用 Workers 路由。原路由指向 `weiyi-video-nav-proxy`，现已切换至 `songbai-cinema`；旧 Worker 保留。原路由记录见 `reports/previous-route-binding.json`。

## 验证结果与实际范围

| 层级 | 验证内容 | 结果 |
| --- | --- | --- |
| 代码测试 | 会话安全、源管理、TVBox、年度片单与自动更新、旧馆藏退出、搜索合并、换源匹配、许可字段及 Workers 兼容 | 57 项通过 |
| 本机浏览器 + workerd + D1 | 登录、源增删改与开关、日志、10 个配置、搜索合并、视频解码、失败后同集换源、移动布局 | 通过（受控测试），见 `reports/browser.json` |
| 线上 HTTP | HTTPS 首页、后台、投诉页、数据库健康、公开配置、热门影视、已接入 CMS 搜索及详情 | 通过，见 `reports/online.json` |
| 线上浏览器 | 管理员登录/退出、十条配置列表、投诉邮箱、1440/390 宽度、开放许可演示片实际解码与时间推进 | 通过，见 `reports/browser-online.json` |
| 线上 D1 后台操作 | 创建、测活、编辑、启停、删除与读取确认 | 通过，见 `reports/production-crud.json` |
| 线上双 CMS 请求 | 使用同一个许可演示目录的两个受控接口地址，验证并行请求、同名合并及地址去重 | 通过；第三方独立片库跨源播放仍待验证 |

演示片真实播放验证使用 `https://media.w3.org/2010/05/bunny/trailer.mp4`，浏览器报告 `readyState=4`、`currentTime>0.5`，连续播放还验证至 18 秒以上。同影片还提供 Ogg 格式候选地址。实际播放会受用户地区、网络、浏览器与媒体原站状态影响。

Internet Archive 已成功返回真实搜索和详情。当前网络下部分 `*.archive.org` 下载节点连接超时，观察记录在 `reports/archive-playback-observation.json`。播放器会依次尝试同集候选地址，最多 16 个去重地址。正常播放、手动暂停和浏览器要求用户点击播放时均有对应的定时器处理。

## 十条 TVBox 配置

线上逐条检测结果已写入 D1，后台可查看并重新检测：

| 配置 | 本次 Cloudflare 边缘检测结果 |
| --- | --- |
| 太阳 sun.json | HTTP 403 |
| EasyDC | 多仓入口，需要具体子配置 |
| 饭太硬 | 返回真实图片内容，当前解析器无法读取配置 |
| TVBox 配置入口 | 非兼容 JSON |
| 哈基米 | 提取 16 个公网 HTTPS CMS 候选接口 |
| 肥猫 | 配置可识别，兼容 CMS 候选为 0 |
| XC GitHub 代理配置 | 非兼容 JSON |
| CatVodSpider demo | 非兼容 JSON |
| 嗷呜 | 返回网页 |
| EasyTV | 配置可识别，兼容 CMS 候选为 0 |

本机逐个检查了上述 16 个候选接口，其中 10 个返回兼容的 API 格式。原始记录见 `reports/candidate-api-live.json`。这些结果表示响应与协议情况；第三方内容授权及视频播放均待确认。第三方候选源尚待导入和启用。

目前启用的自管 CMS 源是开放许可演示源。取得具体接口及视频内容授权后，在后台导入、测活并启用第三方源。公开配置、非营利用途及投诉声明均需与实际内容许可分别核实。

## 常用维护

Windows PowerShell 在源码目录执行以下命令。`console.ps1` 设置 D/E 盘配置和缓存位置。

```powershell
. ./scripts/console.ps1
npm ci --registry=https://registry.npmjs.org
npm test
npm run db:remote
npm run deploy
```

本地数据库和浏览器测试：

```powershell
. ./scripts/console.ps1
npm run db:local
$env:PLAYWRIGHT_BROWSERS_PATH='E:\ms-playwright'
npx playwright install chromium --no-shell
npm run test:e2e
```

Node.js 24 用于执行当前测试。Wrangler 和 Playwright 的版本由 `package-lock.json` 锁定。测试入口为 `wrangler.test.jsonc`，测试使用独立 D1 状态目录 `.wrangler/test-state` 和测试口令。生产入口为 `src/index.js`。

查看服务和日志：

```powershell
. ./scripts/console.ps1
node scripts/check-live.mjs
npx wrangler tail songbai-cinema
```

后台“错误与测活日志”显示最近 100 条，D1 保留最近 200 条。接口测活通过后可启用；修改接口地址会停用该源并重置健康状态。

## 密码、备份与回滚

修改管理员密码或会话签名密钥会使已有会话失效：

```powershell
. ./scripts/console.ps1
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put ADMIN_SESSION_SECRET
npx wrangler secret put COPYRIGHT_CONTACT_EMAIL
```

密钥通过 Cloudflare Secrets 管理。源码、GitHub 工作流及源码压缩包均独立于本次交付的管理员凭据文件。`setup-secrets.ps1` 可交互设置新口令和邮箱，同时生成新的会话密钥。

D1 导出到项目已有交付目录，例如：

```powershell
. ./scripts/console.ps1
npx wrangler d1 export songbai-db --remote --output ../../songbai-db-backup.sql
```

代码回滚使用 `npx wrangler deployments list` 查找版本，再执行 `npx wrangler rollback <版本ID>`。代码回滚与数据库迁移分别管理。需要恢复旧导航网站时，可在 Cloudflare 控制台将 `weiyi.indevs.in/*` 路由改回 `weiyi-video-nav-proxy`。

Cloudflare 免费用量可在控制台查看。视频传输由媒体原站承担；源数量、访问量和探活频率仍会消耗 Workers/D1 配额。此次配置沿用当前账户套餐。

## GitHub 自动部署

已提供 `.github/workflows/ci.yml`。上传到用户选定的 GitHub 仓库后，推送及 PR 会运行代码测试、浏览器测试和部署包检查。工作流的手动 Deploy 入口通过 `production` 环境执行数据库迁移与发布。

GitHub 仓库仍待用户指定，GitHub Actions 远端执行尚待配置和验收。后续需要在仓库 Settings 中设置：

- Secrets：`CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`。
- Variables：`D1_DATABASE_ID`、`CUSTOM_DOMAIN`。
- Environment：`production`，可按需要配置审批人员。

API Token 按 Worker 脚本、D1 和目标 Zone Workers Routes 的操作需求配置。管理员密码继续通过 Workers Secrets 管理。

本次源码来自压缩包，当前目录尚无 Git 仓库。后续建立 Git 仓库时，建议先检查 `.gitignore` 与暂存 diff，再为本次修复建立 checkpoint。

## 本次主要修复

- 统一使用 Workers 支持的手动重定向模式；逐跳验证 TVBox 跳转目标，并对源响应实施实际字节上限。
- 增加 D1 会话撤销、口令轮换失效和登录尝试限制。
- 增加持久化测活日志、启用前健康门槛、地址修改后的健康重置。
- 后台一次选择 30 个接口时，按每批 15 个请求提交；单个 API 请求限 20 个，控制 D1 每次调用的查询数量。
- 保留季度信息参与影片合并，过滤详情中不匹配的片名和年份，去重播放地址。
- 为播放器增加失败事件隔离、16 地址上限、暂停/自动播放策略处理，释放旧 HLS 实例与超时器。
- HLS 库改为随静态资源部署，并附带许可证。
- 开放馆藏根据明确许可 URL 筛选播放候选；新增带署名的 CC BY 3.0 许可演示源。
- 修复自管演示源在 Workers 同 Zone 自请求时的兼容性，内部适配器直接解析目录数据。

更换站点域名时，同步修改 `wrangler.jsonc`、D1 中的演示源地址与 `src/open-demo.js` 的自管接口域名校验。

## 许可与平台依据

- Blender 原作许可：https://peach.blender.org/about/
- CC BY 3.0：https://creativecommons.org/licenses/by/3.0/
- 历史 Public Domain Certification：https://creativecommons.org/publicdomain/certification/1.0/us/
- Workers 域名和路由：https://developers.cloudflare.com/workers/configuration/routing/
- 静态资源计费与限制：https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/
- D1 平台限制：https://developers.cloudflare.com/d1/platform/limits/
