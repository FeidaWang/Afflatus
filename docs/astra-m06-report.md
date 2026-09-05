# M06 · Portfolio 轻量入场

本轮沿用 M05 的指定页面范围：Portfolio EN/ZH。工作区开始时无未提交差异；未改路由、生产数据、小说、内容来源或 M03–M05 场景，未新增依赖、发布或推送。

## 现有 owner 与实施范围

已核对 `docs/astra-motion-design.md`、根 `design.md`、`tech.md`、`CLAUDE.md`，未发现适用的 `AGENTS.md`。现有 CSS view timeline 属于 M05 hero 装饰；`main.js` 与 `homeExperience.js` 的 IntersectionObserver 负责资源懒加载；旧 `.log-boot-line` 属于 Command 面板。它们不用于普通阅读内容。

扩展现有 **`src/ui/homeScrollTelemetry.js`**，统一管理一个有界的阅读 IntersectionObserver。没有新增 scroll listener、rAF 或全站元素扫描；静态 HTML 只查询 `#mainContent` 中明确标记的 8 个目标，动态卡片由其现有 `marketDeck` 创建 owner 直接注册论点段落。

- 2 个章节标题、2 个摘要、3 个模块标题、1 个方法说明块。
- 10 张持仓卡只处理 `.pick-thesis`；按原顺序以最多 4 项组成错开批次，延迟 0/50/100/150ms。
- 标题保持整个标题及既有 `<br>`、`<em>`，不拆字、不重排 DOM、复制和读屏顺序。
- 数值、权重、配置条、图表坐标、数据标签、表格与太阳系 Canvas 不在入场目标内，也没有被包在入场父元素中。

当前页面没有普通文章图片/视频区；媒体主要是已有交互太阳系与背景场景，因此不把它们作为段落位移。太阳系保留既有 1:1 aspect-ratio 和尺寸，资源加载逻辑不变；浏览器检查确认容器宽高差小于 2px。没有添加媒体、占位内容或引语。

## 入场与稳定终态

统一为 **400ms、translateY(16px) → 0、opacity .65 → 1**。所有目标默认可见；只有观察器确认新的下沿入场时才添加动画类。已在屏幕内、已经读过、快跳进入阅读区、处理延迟过大的内容直接保持终态。

动画没有 backwards/forwards fill：错开等待期间仍可读；CSS 自行结束，即使 JS 清理失效，也不会停留在半透明/位移状态。`will-change` 只存在于有限关键帧，终态恢复 `auto`；正常结束、离屏或取消时也会清理动画类和临时延迟。

已读键在本页生命周期内保留，包括动态卡片的股票代码键。滚回不会重播。锚点、浏览器查找快捷键/文本选择、打印、页面离开、脚本错误或 reduced-motion 会完成当前动画，并停用本页后续揭示；无 JS、无 IntersectionObserver 或 CSS 未到达时默认可见。

卡片实测发现既有 legacy `.pick-thesis { opacity: .72 }` 会在动画结束后压低透明度，已在卡片样式 owner 明确改为 `1`。其余配色、字号和数据保持不变。

## 变更文件

| 文件 | 作用 |
| --- | --- |
| `portfolio.html` | 8 个明确的阅读目标标记，无正文变化 |
| `src/ui/homeScrollTelemetry.js` | 单观察器、一次性记录、动态注册、阅读意图与失败收尾 |
| `src/ui/marketDeck.js` | 创建卡片时仅注册论点，设置最多 150ms 的分组延迟 |
| `src/performance-dossier.css` | 有限关键帧、打印/RM 稳定路径；无默认隐藏状态 |
| `src/portfolio-convoy.css` | 卡片论点终态 opacity 1 |
| `e2e/astra-reading-entry.spec.js` | 6 项浏览器验收 |
| 本报告、`astra-m06-evidence/` | 截图证据 |

## 预览与证据

[EN 预览](http://127.0.0.1:4180/en/portfolio.html) · [ZH 预览](http://127.0.0.1:4180/zh/portfolio.html)。预览依赖本机进程，正常从页首滚动可观察入场；锚点直达有意保持静态。

[入场中](astra-m06-evidence/01-entering.png) · [已读返回](astra-m06-evidence/02-read-return.png) · [查找文本](astra-m06-evidence/03-find.png) · [打印](astra-m06-evidence/04-print.png) · [卡片](astra-m06-evidence/05-cards.png) · [无 JS 中文手机](astra-m06-evidence/06-nojs-mobile.png)

## 已运行检查

- **6/6 Playwright 用例通过**：真实滚轮入场及标题/卡片返回不重播；快跳；Chromium 原生 `window.find()` 文本选择与查找快捷键取消；锚点直达；打印媒体与 beforeprint；动态/首次 reduced-motion；脚本错误；故意遗留动画类模拟清理失效；图表隔离；无 JS 中文窄屏。
- 8 个静态目标初始 computed opacity 均为 1；标题 DOM 在入场前后相同；标题/卡片完成后为 opacity 1、transform none、will-change auto。
- **22/22 相关单测通过**：homeStardriveLayout、homePresentationContract、renderBudgetCoordinator。
- `typecheck`、`css:check`、`prebuild` 全套检查、直接 Vite 构建、`git diff --check` 通过。构建仍有原有大 chunk 警告。
- 环境缺少依赖时仅按现有 lockfile 执行 `npm ci --ignore-scripts` 恢复，未修改包版本。构建使用临时目录 `/tmp/afflatus-astra-m06`，仅通过既有导出函数本地化 active 页面，没有运行生成小说文档的完整 build hook。

## 待验证限制

实测为本机 Chromium，桌面 1440×1000 与无 JS 窄屏 390×844。Safari/Firefox、物理触屏、实际打印机和完整读屏流程未实测。查找验证使用 Chromium 原生查找 API 与页面快捷键取消，不冒充逐一操作各浏览器菜单。媒体不在本轮动画范围，没有新增媒体懒加载行为或声称完成新资源加载性能测量。
