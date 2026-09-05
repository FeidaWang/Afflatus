# M11 · Portfolio 图表探查、完整数据表与公开引用

2026-09-05。仅承接 M10 的 Portfolio 范围：资本核心、周期效率/持有天数、模型/基准倍数、研究配置权重。不宣称 Arena、Signal 或首页的图表已完成 M11。

## 基线与交付位置

本任务初始工作区在 `350ecb6`，不含 Astra/M10。通过现有任务定位到 `/Users/feida/.codex/worktrees/9d3c/afflatus`：其提交为 `b07ad96`，M08–M10 仍未提交。将该分支相对共同祖先的改动，以及原工作区的完整未提交差异/新增文件，复制到当前隔离工作区 `/Users/feida/.codex/worktrees/1c06/afflatus`，保留当前提交已有小说改动。原任务、原分支和原工作区未写入。

当前工作区因此同时显示继承的 Astra 基线与 M11 改动。`astra-m11-changes.patch` 单独列出 M11 源码和测试，可用于审阅相对 M10 的新增工作。没有提交、发布、推送，没有修改金融源数据或生成新的小说发布路由。

## 实现

- **共同数据源**：沿用 M10 的原生 DOM 图表 owner。探查与 table 读取同一组公开 DOM 字段；研究权重由现有 `marketDeck` / `content.js` 生成卡片，懒加载之前读取其现有 HTML fallback。没有另存一套数值，没有请求私人账本、补造交易日期或历史序列。
- **四个图表入口**：`#chart-core`、`#chart-benchmarks`、`#chart-cycles`、`#chart-allocation`。每组一个焦点，方向键逐记录选择，Home/End 首尾；既有十个研究档案按钮继续承担选中档案功能，没有把每个数值点加入 Tab 顺序。
- **等价探查**：hover、焦点/键盘与 tap 都使用同一个记录选择器。tooltip 包含记录、系列、值、单位、状态、财年/截止日期与方法日期；基于 visual viewport 限制位置及尺寸，可悬停阅读，Esc/外部点击关闭。键盘选中记录通过短 live status 播报，不做逐帧数字变化。
- **系列图例**：多系列使用原生 button 与 `aria-pressed`；名称、单位及横条/圆点/方点同时表达身份。切换保持原坐标口径和布局空间，隐藏系列在图例与完整 table 明示；table 始终保留全部记录。全部隐藏时显示说明。QQQ 与 SPX 的导出也共用原始完整域。
- **完整 table**：四组分别为 4、2、10、10 条公开记录；带 caption、列标题、行标题、单位、日期和缺失说明。手机优先显示记录/值/单位，其余列在表格区域横滚，首列固定，数字不拆行。有横滚提示，不通过整页横滚容纳宽表。M10 的无 JS 原始数字和研究列表保留。
- **脚注**：每组有来源/方法链接及返回图表的原生锚点。沿用 M08 目录/历史导航，不添加新的历史状态序列。
- **复制**：只有点击按钮后才调用 Clipboard API；成功/失败显示短 status。复制地址清除所有 query，仅包含公开页面路径和四个白名单图表 ID；不编码选择记录、筛选结果、持仓或其他私密输入。
- **导出**：原生 details 菜单提供 SVG/PNG。从允许公开的字段生成独立静态图，不截图 DOM 或 WebGL；PNG 使用浏览器 SVG 解码与 Canvas，不新增下载依赖。标题、单位、来源、财年/截止日期、方法日期、模型/估算或主观研究标记、系列身份和缺失说明全部写入图内。隐藏系列仍具名，并保留原尺度。没有 tooltip、动画、外部字体/图片引用或私人字段。未提供太阳系 WebGL 截图按钮；加载中、无记录或超过当前静态图可靠大小范围（100 条）时不显示导出菜单，完整 table 仍可阅读。
- **日期边界**：年度记录只披露 FY2025–26 与 2026-08-08 方法日期，精确数据截止日未披露，UI 和导出都明确这一点。配置权重沿用 2026-08-07 08:29 ET 快照。模型/研究数据没有改称审计后的实际收益或真实账户持仓。
- **数据替换**：源字段、卡片替换及 `aria-busy` 变化会清空旧探查选择并重建 table；加载期间禁止探查，明确表格仍是上一份公开快照。几何 owner 在值变化时重新计算，避免缺失值残留旧图形；相同轴标签不重复写 DOM，防止 MutationObserver 循环。

## M11 改动文件

| 文件 | 作用 |
| --- | --- |
| `src/ui/portfolioChartInspector.js` | 四组 DOM 数据适配、探查、图例、table、脚注、菜单与深链接 |
| `src/ui/portfolioChartInspector.css` | tooltip 边界、完整表格、焦点/图例、手机横滚 |
| `src/ui/chartExport.js` | 白名单链接、公开字段 SVG、浏览器 PNG 下载 |
| `src/main.js` | 原图表几何初始化后启动探查；保留 CSS layer 声明顺序 |
| `src/ui/portfolioChartGeometry.js` | 同值轴标签/缺失标签不重复写入，允许安全响应源更新 |
| `tests/chartExport.test.js` | 隐私字段排除、URL、缺失/负/零、导出标注/尺度 |
| `e2e/astra-chart-inspection.spec.js` | 完整交互、数据、下载与慢加载浏览器验收 |
| `e2e/astra-chart-geometry.spec.js` | 无 JS 回归使用实际 baseURL，移除旧预览端口硬编码 |

## 验证

- M11 **11/11 Chromium 浏览器验收**：EN/ZH × 1440/390，hover/focus/tap 内容等价，单图表焦点、方向键/Home/End、Esc/外部点击、320×300 边缘 tooltip 与浮层可悬停、table 标题/数据/单位/横滚、系列身份与尺度、脚注前往/返回及历史、复制成功/拒绝和新标签重开、实际 PNG/SVG 下载、所有四组 EN/ZH SVG 元数据、2,010 点与缺失数据、延迟加载替换/忙状态不出现旧记录。
- **18/18 单测**：导出/链接、M10 数字尺度和既有 Portfolio 展示契约。
- 回归 **40/41**：M10 **10/10**；M08 阅读导航 **30/31**。唯一未通过项 `Serial: chapter link opens independently and static chapter remains readable without JS` 使用本轮未生成的 `/zh/novels/wanjie-zhongchun/1/`，静态预览返回 404，后续找不到目录链接。未为解决无关测试而生成新的小说发布路由；不将这项写成通过。
- prebuild 所有检查、TypeScript、JS 语法、Vite 构建和 `git diff --check` 通过。Vite 保留原有大于 500kB 的 Three.js chunk 提示。完整小说本地化/SEO 发布生成未运行；仅对 manifest active 页面调用已有转换函数。
- 实际 PNG 已人工查看：标题、两组单位/坐标、十条数值、来源、日期与模型说明完整，无 tooltip/过渡帧遮挡。桌面/手机截图已复核。

首次浏览器启动被系统沙箱阻止，改用获准的本地 Chromium 后执行验收。实现中发现并修复 CSS layer 首次声明顺序造成的间距回退、数据更新重复写轴标签造成的观察器循环；最终验收使用修复后的构建。未实测真机 Safari、Firefox、完整 VoiceOver、原生浏览器缩放、操作系统真实剪贴板权限 UI 或线上性能。触屏为 Chromium touch 模拟；Clipboard API 成功/拒绝由浏览器测试桩覆盖；下载则为真实文件。

## 预览与证据

本地构建在 `/tmp/afflatus-astra-m11`，静态预览仅监听本机 4186。

- [中文周期探查](http://127.0.0.1:4186/zh/portfolio.html#chart-cycles)
- [英文研究权重](http://127.0.0.1:4186/en/portfolio.html#chart-allocation)
- [实际 PNG 导出](astra-m11-evidence/cycles.png)、[实际 SVG 导出](astra-m11-evidence/en-cycles.svg)
- [英文桌面](astra-m11-evidence/en-1440-table.png)、[英文手机](astra-m11-evidence/en-390-table.png)、[中文桌面](astra-m11-evidence/zh-1440-table.png)、[中文手机](astra-m11-evidence/zh-390-table.png)
- [M11 浏览器日志](astra-m11-evidence/m11-e2e.log)、[单测](astra-m11-evidence/m11-unit.log)、[回归及已知预览缺项](astra-m11-evidence/m11-regression.log)、[预构建](astra-m11-evidence/m11-prebuild.log)、[构建](astra-m11-evidence/m11-build.log)
