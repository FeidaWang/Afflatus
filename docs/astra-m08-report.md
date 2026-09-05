# M08 · 章节导航与阅读定位

2026-09-05。基于 `codex/afflatus-astra-motion` 的 `b07ad96`，当前工作树仍为同一提交起步的 detached HEAD。开始时工作区干净。已读 M07 报告、Astra 设计手册、design.md、tech.md、CLAUDE.md；未发现适用的 AGENTS.md。

## 范围与结果

| 页面 | 复用／新增入口 | 定位合同 |
| --- | --- | --- |
| Portfolio EN/ZH | 新增唯一的「年度记录 / 周期路径 / 资产星图」阅读目录 | `#fy2026Performance`、`#flightPathsTitle`、`#portfolioConvoy`，不创建新 section ID |
| Sectors EN/ZH | 原 `rivalryIndex` 七项短标签 | 原 K3、实验室、市场、上市标的、联盟、论点、来源 heading ID |
| Signal EN/ZH | 原桌面 `chapterRail` 与手机 `mobileChapterIndex`，每个断点只显示一个 | 六个既有目标；收益率保留真实链接的 `#treasuryYieldBoard` |
| Course EN/ZH | 原 `course-index` 七项 | 原章节 ID、原课程和学习进度 |
| 小说共享阅读器 | 原章节抽屉 | 原章节 URL、原选择 owner；当前章节加 `aria-current="page"` |

四个阅读页使用同一个小型 `readingNavigation.ts` 增强，未添加第二套目录、渲染器、依赖或持续 rAF。Portfolio 使用具名 `role="navigation"` 容器，避开历史全局 `nav` 的舰桥样式。Sectors／Course／Portfolio 目录为跟随页眉的横向条；Signal 保留桌面侧栏。页面人格与原有短标签保留，不给小说正文增加动画。

当前项使用加粗、下划线和 `aria-current="location"`，不是仅换颜色。原锚点可程序化聚焦但不增加 Tab 停靠点。页眉与目录实际尺寸决定 `scroll-margin-top`；CSS 有无 JS 的静态偏移。横向条至少保留 44px 高度，当前项的横向定位避让正在操作的另一链接焦点，只滚目录本身。

原生链接负责 URL、复制、新标签与历史。高亮仅由 IntersectionObserver 更新，不写 history；没有监听 scroll 来逐帧计算目录。ResizeObserver 负责页眉／目录尺寸，窗口尺寸变化重算观察区域。首次深链接或明确目录点击后，允许补偿字体／异步内容改变的目标位置；下一次 wheel、pointerdown、touchstart 或 keydown 立即释放。历史跳转到其他 hash 会释放补偿，BFCache 恢复不覆盖浏览器保存位置。

## 本轮修复的具体问题

- Signal 原桌面目录 `preventDefault()` 后仅滚动、不写 hash；手机目录没有同一当前项。移除旧目录观察器和点击拦截，两个布局共用新 owner。
- Signal 无 JS 时完整导航的高度会遮目标；未增强时页眉回普通文流。锚点章节标题直接显示，不会停留在 reveal 的隐藏态。
- Course 原跳转立即滚一次，780ms 后再滚一次；去掉延迟重定位，让目标章节直接稳定显示。测试发现字体／布局晚到时仍可能改变定位，现通过可被用户立即取消的锚点补偿处理，不用任意延时重试。
- 快速点击 Course 目录后立即切语言，旧逻辑会采样尚未滚完的旧章节，丢掉 hash。仅在本轮有阅读目录的页面优先保留有效显式 hash，query 仍由原 locale helper 保存。Portfolio 在 hashchange 后同步原语言链接。
- 小说目录由 button 改为原章节 URL 的真实 anchor；普通点击仍调用原 `goToChapter()`，修饰键点击保留浏览器行为，Esc 回原目录触发器。未修改正文、书章状态或阅读偏好。

## 文件

- `portfolio.html`、`sectors.html`、`signal.html`、`course.html`：原入口标记、目标焦点与共用样式引用；Portfolio 三段目录。
- `src/lib/readingNavigation.ts`、`public/styles/reading-navigation.css`：导航增强与版式。
- `src/main.js`、`src/pages/sectors.js`、`src/pages/signalLibs.js`、`src/pages/courseEntry.js`：接入既有页面 import 链。
- `src/pages/course.js`、`src/lib/i18n.js`：消除重定位竞争与语言切换竞态。
- `serial.html`、`public/styles/serial.css`：原章节目录的链接与当前状态。
- `e2e/astra-reading-navigation.spec.js`：用户路径测试。
- 本报告与 `astra-m08-evidence/`：截图、验证日志与性能样本。

## 本地预览与截图

仅绑定回环地址；需要保留本机静态预览进程。没有部署。

[Portfolio EN](http://127.0.0.1:4183/en/portfolio.html#fy2026Performance) · [Portfolio ZH](http://127.0.0.1:4183/zh/portfolio.html#fy2026Performance) · [Sectors](http://127.0.0.1:4183/en/sectors.html#labsHeading) · [Signal](http://127.0.0.1:4183/en/signal.html#ch00) · [Course](http://127.0.0.1:4183/en/course.html#agent-core) · [小说](http://127.0.0.1:4183/zh/serial.html)

同一 Chromium、EN、reduced-motion、1440×1000 / 390×1000、相同锚点的前后截图：

| 页面 | 桌面 | 窄屏 |
| --- | --- | --- |
| Portfolio | [前](astra-m08-evidence/before-portfolio-1440.png) / [后](astra-m08-evidence/after-portfolio-1440.png) | [前](astra-m08-evidence/before-portfolio-390.png) / [后](astra-m08-evidence/after-portfolio-390.png) |
| Sectors | [前](astra-m08-evidence/before-sectors-1440.png) / [后](astra-m08-evidence/after-sectors-1440.png) | [前](astra-m08-evidence/before-sectors-390.png) / [后](astra-m08-evidence/after-sectors-390.png) |
| Signal | [前](astra-m08-evidence/before-signal-1440.png) / [后](astra-m08-evidence/after-signal-1440.png) | [前](astra-m08-evidence/before-signal-390.png) / [后](astra-m08-evidence/after-signal-390.png) |
| Course | [前](astra-m08-evidence/before-course-1440.png) / [后](astra-m08-evidence/after-course-1440.png) | [前](astra-m08-evidence/before-course-390.png) / [后](astra-m08-evidence/after-course-390.png) |

## 验证

本机 Playwright Chromium **149.0.7827.55**：

- **30/30 主路径通过**：四页 EN/ZH × 桌面／390px，真实 Enter、点击、hash／query、前进／后退、刷新、唯一当前项；无 JS 锚点；Portfolio 真实滚轮正反向阅读且 history 长度不变、动态 RM、修饰键新标签；四页语言切换；Course 快速连续跳转；小说目录 Esc／切章。
- 其中响应式测试覆盖四页 **320×720、768×1024、1280×800、844×390**，目录按钮实际高度至少 44px、标题可见、整页无横向溢出。触摸测试使用 Chromium 模拟 390×844，CDP 连续手势验证横向目录可滑、文档 Y／URL／history 不变；不是物理手机。
- **1/1 小说独立链接样本通过**：`wanjie-zhongchun/1/` → 修饰键打开 `/2/`，原抽屉不关闭；禁用 JS 的第二章有静态正文与前后章链接。该测试最初误断言章节页应含书籍目录，已改为验证章节页实际的正文和章节链接。
- Course 窄屏字体／焦点竞态修复后另做 **3/3 连续复验**；它随后也通过上述整套主路径。
- **2/2 M07 回归通过**：星场 fine pointer／6px 捕获／局部键盘／Esc 焦点；Command 镜头／面板／日志逐层退出。没有重写 M03–07 原有截图。
- **26/26 单测通过**：localeStore、localePrepaint、serialRoutes、serialLayoutStability、homePresentationContract。
- `typecheck`、`prebuild`（数据、路由、页眉、CSS、资源、双语、OG）、直接 Vite 构建、`git diff --check` 通过。原 >500kB chunk 提示仍在。

构建使用 `vite build --configLoader native --outDir /tmp/afflatus-astra-m08`，只为 manifest active 页面执行既有本地化函数。小说独立样本仅从当前 sitemap 核对后派生上述两个既有章节到临时目录；未运行全量小说生成 CLI，未改变 sitemap 或公开清单。普通沙箱不允许本机端口／Chromium Mach port，浏览器和回环服务器在获准的沙箱外进程运行。

最终主测试日志与补测、回归日志位于证据目录。复跑本轮预览可用本工作树的 `artifacts/m08.config.mjs`；正常完整构建环境可用仓库 Playwright 配置直接选取 `e2e/astra-reading-navigation.spec.js`。

## 性能与限制

新增共用 JS 构建后 **3.06kB / gzip 1.31kB**，新增 CSS 约 **1.0kB gzip**。没有新增持续动画循环。下方加载指标另记同机三轮样本，不把它当线上 p75、INP、FPS 或真机性能结论。

采样环境：相同本机 Chromium，1440×1000、RM、每页新上下文三轮，阻止外部请求，静态回环服务器；load 后再观察 1 秒。下表为中位数，单位为 ms，CLS 无单位；资源字节为该观察窗口的 encodedBodySize 总和。

| 页面 | DCL 前 → 后 | LCP 前 → 后 | CLS 前 → 后 | 资源增量 |
| --- | --- | --- | --- | --- |
| portfolio | 91.4 → 99.3 | 116 → 116 | 0.0044 → 0.0044 | +5560 B |
| sectors | 32.0 → 37.2 | 68 → 92 | 0.0000 → 0.0022 | +5569 B |
| signal | 56.8 → 62.5 | 68 → 64 | 0.0080 → 0.0065 | +5569 B |
| course | 62.1 → 71.5 | 88 → 92 | 0.0011 → 0.0011 | +5450 B |

[原始三轮样本](astra-m08-evidence/performance.json)。Sectors 的 LCP 中位数由 68ms 到 92ms，不能据这一微小本地样本宣称完全没有性能退化；这些数字不具备真实网络、CPU 限速或线上代表性，也未测 INP／长时 GPU／内存。

未测物理 iPhone、Safari／Firefox、VoiceOver 完整流程、浏览器原生 200% 缩放、软键盘与非零安全区，本轮不替代 M07 真机补签。小说仅验证共享目录及两个边界明确的样本，没有逐章重测。没有运行全站 Lighthouse、完整全站 E2E 或生产站验证。

本轮全部保留为未提交差异；没有提交、推送、发布或改生产数据。回滚仅撤销上述 M08 文件差异并移除本轮新增文件，不回退 `b07ad96` 或此前 M03–07 实现。
