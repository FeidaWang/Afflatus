# M07 · Portfolio 输入方式与减少动态

2026-09-05。范围为 M03–06 已涉及的 Portfolio EN/ZH：轨迹星场、开屏与重播、Alphard Forge 滚动舞台、太阳系及卡片、正文入场，以及同页 Command 的镜头和面板入口。未扩展到其他路由或 P2 效果。

开始时已读取根 design.md、tech.md、CLAUDE.md 和 docs/astra-motion-design.md，未发现适用的 AGENTS.md。保留了原有 M06 未提交改动（portfolio.html、performance-dossier.css、portfolio-convoy.css、homeScrollTelemetry.js、marketDeck.js、M06 测试和证据）。本轮未改路由、小说发布规则、金融数据、内容来源或授权素材，没有新增依赖、渲染预算 owner、游标、页面转场，也未发布或推送。

## 所有权与输入行为

| 部件 / 原 owner | fine pointer | coarse pointer | 键盘 / 减少动态 |
| --- | --- | --- | --- |
| backgroundScene.js / M03 星场 | 宽屏且预算允许时先“进入互动”；原 6px 拖动门槛、捕获释放、dt 阻尼和限幅不变 | 静态 poster；保留 pan-y、pinch-zoom。不是只凭 390px 判断触摸能力 | 场景进入互动才加入 Tab；获焦后方向键、Home；Esc 退出并返回入口。RM 直接 poster |
| starfieldIntro.js / M04 | 沿用一次性开屏和仅视觉重播 | 静态路径 | 原取消、历史恢复与首帧 CTA 保留；暂停时重播禁用 |
| alphardForge.js / M05 | 原有采样、舞台与预算；共享暂停后静态终态 | 原普通文流与静态终态 | RM / 暂停不再持续绘制；数据不依赖动画 |
| portfolioSolarSystem.js / marketDeck.js | 原太阳系 renderer；DOM 卡片点选 / 聚焦 | 即使 1280px 宽且 coarse，也停自动运行；由 DOM 卡片点选 | 原文字、权重和论点是可读替代。RM / 暂停停止轨道、旋转、镜头和光晕时间推进；主动点选仍可更新静态帧 |
| homeScrollTelemetry.js / M06 | 原有界 IO、一次性阅读记录 | 同一阅读 owner | 共享暂停结束当前揭示；恢复不重播已读内容。查找、锚点、打印、失败和 RM 终态保留 |
| homeExperience.js / Command | “Orbit camera” 显式进入后才捕获拖动 / wheel | 默认画布保留 pan-y、pinch-zoom；主动进入镜头后才使用二维操作 | 方向键只在画布获焦处理。Esc 先退镜头 / 面板 / 日志，返回各自实际触发器，再退出 Command |

太阳系投影标签由小按钮改为 aria-hidden 的装饰 span；唯一选择入口是原有完整卡片按钮，风险/催化剂与链接继续由 DOM 呈现。没有把真实数据标签移进 Canvas，也没有嵌套按钮。

## 共享暂停与生命周期

新增 `src/ui/homeMotionPreferences.js` 只管理一个偏好，复用 M03 的 localStorage 键 `afflatus:starfield-paused:v1`。星场、Forge 和太阳系各有同步的“暂停动态”按钮；跨刷新、同源标签 storage 变化和 EN/ZH 文案保持一致。它没有 rAF 或新的预算调度器。

原场景继续接入 renderBudgetCoordinator / webglLifecycle。太阳系只累积实际活动帧的 dt，暂停后恢复不会跳过一段时间；相同预算和重复选中项不再触发多余静态重绘。已用实际 WebGL draw 调用计数验证暂停和 RM 后停止；离屏及 pagehide 由现有生命周期停止。主动选择、恢复上下文或尺寸变化仍可合法绘制单帧。

暂停不连接金融数据加载/刷新、必要加载反馈或用户手动选择。CSS 仅停止本页明确的背景伪元素装饰；没有全站 `*` 动画冻结。系统减少动态变化由已有预算通知和输入媒体查询监听。

## 实际点击范围与布局修复

阅读区新增/既有场景按钮实测至少 44×44 CSS px。Command 的小按钮用实际 48px 盒子扩展，并同步扩大原有头部、武器网格和日志关闭按钮列，避免只扩大命中区域而互相覆盖。桌面 Command 高度为最多 330px；窄屏保留可滚动面板，预留顶部导航空间。左右和底部沿用/补充 env(safe-area-inset-*)。

日志打开时 visibility 立即生效，视觉 opacity/transform 仍可过渡，解决首个 rAF 聚焦被隐藏状态拒绝的问题。减少动态下 Command 与日志直接到终态。

## 变更文件

| 文件 | 本轮作用 |
| --- | --- |
| portfolio.html | 星场互动入口、三处共享暂停、Command 镜头入口及装饰标签语义 |
| src/main.js、src/ui/homeMotionPreferences.js | 初始化并同步唯一的装饰暂停偏好 |
| src/scene/backgroundScene.js | 显式进入、局部键盘、退出/失败释放、共享暂停 |
| src/scene/alphardForge.js | 暂停接入原静态模式 |
| src/ui/portfolioSolarSystem.js | coarse / RM / 暂停停绘、活动时间、静态更新去重 |
| src/ui/marketDeck.js | 原卡片点选，移除微小投影按钮；保留 M06 注册 |
| src/ui/homeScrollTelemetry.js | 暂停时完成揭示；保留 M06 IO |
| src/homeExperience.js、src/ui/voyageLogConsole.js | 镜头显式互动、被动视差门控、逐层 Esc 与焦点返回 |
| src/home-visual-upgrade.css、src/portfolio-convoy.css | 原 owner 内的触摸、暂停按钮和布局规则 |
| src/cic-hud.css | 实际按钮盒子、对应网格、安全区和可聚焦过渡 |
| public/styles/afflatus-brand.css | 仅 Portfolio 导航扣除左右安全区，避免菜单贴近边缘 |
| e2e/astra-input-access.spec.js | M07 输入、停绘、焦点、视口和安全区验收 |
| e2e/astra-starfield.spec.js、tests/homePortfolioSolarSystem.test.js | 更新显式互动及 DOM 选择的既有契约 |

`src/performance-dossier.css` 的工作区差异仅来自先前 M06，本轮未修改它。

## 本地预览与截图

[EN 预览](http://127.0.0.1:4181/en/portfolio.html) · [ZH 预览](http://127.0.0.1:4181/zh/portfolio.html)。仅绑定本机回环地址，依赖本机预览进程；iPhone 无法直接打开这个 localhost 地址。

同一 1440×1000 条件下，旧 M06 预览与本轮预览的对照：

- [修改前首屏](astra-m07-evidence/before-hero.png) / [修改后首屏](astra-m07-evidence/after-hero.png)
- [修改前 Command](astra-m07-evidence/before-command.png) / [修改后 Command](astra-m07-evidence/after-command.png)
- [320px](astra-m07-evidence/layout-320.png)、[390px](astra-m07-evidence/layout-390.png)、[768px](astra-m07-evidence/layout-768.png)、[1280px](astra-m07-evidence/layout-1280.png)
- [390 横向模拟](astra-m07-evidence/landscape-390.png)、[1280 宽触屏模拟](astra-m07-evidence/02-wide-touch.png)
- [暂停后仍可点选](astra-m07-evidence/01-paused-selection.png)、[Command 缩短视口 390×460](astra-m07-evidence/command-390-460.png)
- [非零安全区模拟](astra-m07-evidence/safe-area-simulation.png)

同目录 controls-*.json 与 command-*.json 保留实际按钮矩形。command JSON 也包含隐藏日志面板的布局矩形，不把这些隐藏项算作当前可点击目标。

## 已测环境与结果

- macOS 本机 Playwright Chromium **149.0.7827.55**。M07 **10/10 输入验收通过**（另复验安全区导航及四档布局）；M03–06 **27/27 回归通过**。覆盖实际鼠标拖动和滚轮、模拟触摸手势、局部键盘、6px 捕获/cancel、DOM 点选、存储暂停、动态 RM、WebGL 失败、上下文恢复、离屏、开屏取消、真实前进/后退和已读不重播。
- 320×720 fine、390×844 coarse、768×1024 coarse、1280×800 fine，以及各自交换宽高。阅读布局均无横向溢出，阅读区控制按钮至少 44px；另用 1280×800 coarse 验证输入方式不等于视口尺寸。
- Command 390×844、844×390、1280×800、390×460 额外截图检查。CDP 注入左右 44px、底部 34px 的**模拟安全区**，验证面板与菜单为安全区和顶部导航保留空间。缩短视口只是几何检查，不能代替软键盘。
- 本机可见 Google Chrome 用原生 Cmd+ 放大，AX 明确报告 **Zoom: 200%**；effective viewport 756×385，DPR 从 2 到 4，document scrollWidth 756，无横向溢出；菜单实际点击可展开。已恢复 100%（1512px / DPR 2）。这轮没有把 CSS zoom 或设备缩放当成浏览器 200%。该截图在会话中检查，未另存本地图片；200% 下完整长页及读屏仍待人工覆盖。
- **35/35** 相关单测：renderBudgetCoordinator、webglLifecycle、starfieldModel、homeStardriveLayout、homePresentationContract、homePortfolioSolarSystem。
- `typecheck`、`prebuild`、`css:check`、直接 Vite 构建、`git diff --check` 通过。原有 >500kB chunk 提示仍在。

直接构建到 `/tmp/afflatus-astra-m07`，再通过既有本地化导出函数只处理 manifest 的 active 页面。未运行会生成小说路由的完整本地化 CLI / build hook。回归截图放临时目录，没有覆盖 M04–06 原证据。浏览器启动需沙箱外本机进程；普通沙箱曾阻止 Mach port 创建，这不是页面测试失败。

## iPhone 16 Pro Max 真机补签（待完成）

用户已指定 **iPhone 16 Pro Max**；浏览器先按 **Safari** 准备，尚未收到 iOS/Safari 版本，也未操作该设备。所有窄屏/触摸/CDP 截图均为桌面模拟，不能据此宣称 iOS 全端通过。Safari、Firefox、VoiceOver 的完整流程尚未实测。

在能访问本轮测试构建的设备上逐项确认，并记录系统版本与通过/失败；不要用仍未更新的生产页替代：

1. 竖屏从标题、CTA、静态星场上单指纵向滚动；双指缩放。不能被装饰拖动层截住。
2. 横屏以及 Safari 地址栏展开/收起后，菜单、返回阅读、暂停和卡片链接都能点中；检查圆角、Home 指示条与边缘触点。
3. 暂停 → 财年记录 → 太阳系卡片点选 → 刷新：偏好保存，正文、真实标签与点选保持可用。
4. 设置“辅助功能 → 动态效果 → 减少动态效果”，回 Safari 检查立即静态；关闭后再检查主动操作。
5. 显式进入/退出 Command 镜头；默认滑动可滚，进入后才操作镜头；日志关闭返回入口。配外接键盘时补测 Tab、方向键、Home、Esc。
6. Safari 地址栏软键盘打开/关闭后确认页面恢复和固定面板位置。本轮涉及的阅读与只读日志没有公开文本输入表单，未新建表单来冒充业务软键盘验证。
7. VoiceOver 顺序读取标题、方法说明、权重与十张卡片，确认装饰 Canvas 不重复播报；前进/后退不重播开屏。

真机补签仍待用户/可连接设备执行；本报告不声称达到参考页内部算法或完成真实触摸硬件性能测量。
