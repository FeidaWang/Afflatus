# M10 · Portfolio 图表几何与最终读数

2026-09-05。本轮范围为当前 Portfolio 的年度记录、周期路径、资产权重，保留 M08/M09 全部未提交改动。起点仍是与 `codex/afflatus-astra-motion` 同一提交的 detached HEAD `b07ad969f740a6cee3c2cbd4efb52c072b700967`，没有移动其他 worktree 占用的分支。未提交、发布、推送。

## 数据清单（先核对，后改图）

| 字段 / 已公开值 | 单位 | 基准 / 口径 | 日期与来源 | 缺失 / 可信状态 |
| --- | --- | --- | --- | --- |
| 年化上界 41.4；夏普 0.85；回撤 −22；Beta 1.85 | %；无量纲；%；无量纲 | 资本时间重建；夏普无风险输入 4.50%；Beta 相对 SPX | FY2025–26；回撤窗口 2026-06-16—25；portfolio.html 的公开摘要与 content.js 文案 | 模型 / 风险估算，非审计结果；底层序列未公开 |
| 周期效率 261.2；资金加权占用 7.8；周期数 5；波动率上界 45 | %；天；条；% | 五个已结清周期，365 天机械外推 | FY2025–26；方法说明日期 2026-08-08；portfolio.html | 周期年化不等于实现的账户收益；波动率为估算 |
| 模型上界 / QQQ 2.94；模型上界 / SPX 4.40 | 倍数 × | 唯一首屏模型上界 ÷ 所提供基准输入 | FY2025–26；方法说明日期 2026-08-08；portfolio.html | 原始基准值与精确比较起止日未披露；保留公开比值，不反推原始值 |
| AVGO 260.4 / 17.5；DRAM 208.5 / 3.0；SNDK 257.9 / 11.2；NVO 32.6 / 246；XLE 85.6 / 5.6 | 年化效率 % / 持有天数 | 同列共用尺度，两列单位独立；已结清周期 | FY2025–26；方法日期 2026-08-08；portfolio.html 的五条公开记录 | 效率为模型值，天数为披露值；不公开逐笔结果、结算数值 |
| NVDA 18、AVGO 15、AMD 13、ORCL 10、AMZN 9、MSFT 9、TSM 8、GOOGL 7、MU 6、VRT 5 | %，合计 100 | 主观研究配置框架 | 2026-08-07 08:29 ET；src/data/content.js EN/ZH 与 HTML fallback | 非核验后的账户实际持仓；不以天体大小表达准确权重 |

当前公开记录无空值。未公开字段不等于零。年度数据只有财年范围与方法日期，**方法日期不冒充精确数据截止日**。没有查询私有账本、补造历史点或更新行情。测试注入的缺失值、负值与长标签不写入发布内容。

## 图形选择与实现

沿用 docs/astra-motion-design.md 的 M10 选型。当前这些平面图由 HTML/CSS 与 marketDeck.js 拥有，并非 SVG/Canvas 图表；继续使用现有 DOM owner。太阳系仍由 portfolioSolarSystem.js 控制，没有更换库或增加第二个 Canvas renderer。

- 周期路径：效率采用从零起点绘制的横条，当前共享 0–300%；天数采用圆点图，当前共享 0–250 天。逐行数字常驻，手机改为每条记录上下排列的两幅小图，名称可换行，坐标与单位至少 12px。
- 相对模型：QQQ 实线 + 圆点，SPX 虚线 + 方点；保留本站青色/暖色和系列名称。统一 0–5× 尺度，显示 2.94×、4.40×。这仍是模型/基准比值，不包装成真实收益折线。
- 资产配置：原卡片中的条形长度改为 `pct / 100`，18% 占全条 18%，不再把最大权重拉伸至 100%。原卡片数字立即完整呈现，附 0–100% 刻度。继续共用原太阳系/卡片选择逻辑。
- `portfolioChartGeometry.js` 只读取已公开 DOM 数字，计算包含零的共享尺度。负值向零左侧绘制并使用红色斜纹；零值宽度为零；缺失值没有 mark，显示 No data / 无数据。没有连线插值、补点或最小宽度伪造数据。每行独立 mark，因此单点也能绘制。
- 原首屏模型数字在 M07/M08 基础上已经保持最终值。本轮清除 marketDeck 资产卡仍残留的 2.6 秒逐帧数字计数和条宽过渡，以及无用的 counter 调用。图表选择**静态最终几何**，不添加数据进场动画；周期核心装饰环停止持续旋转。既有 400ms prose 入场与太阳系互动不用于生成统计值。
- 每个图块增加问题、单位、日期口径与简短来源。完整依据、表格探查与导出继续留给 M11。本金、成交金额、数量、账户余额、逐笔结果与结算明细的原隐私边界保持。

## 文件

| 文件 | 本轮改动 |
| --- | --- |
| portfolio.html | 静态最终数值、同列比例几何、轴端值、图下注释；保留 M08 锚点 |
| src/ui/portfolioChartGeometry.js、src/main.js | 读取公开 DOM，计算统一含零尺度与缺失状态 |
| src/lib/readingNavigation.ts | 在 popstate 阶段释放上一跳锚点校正，避免覆盖历史保存位置 |
| src/ui/marketDeck.js | 移除计数动画，直接按真实百分比渲染配置条 |
| src/performance-dossier.css、src/portfolio-convoy.css | 横条/点图、系列形状、可读标签、手机堆叠与静态几何 |
| tests/portfolioChartGeometry.test.js、e2e/astra-chart-geometry.spec.js | 数据及边界验证 |

## 验证与证据

- **10/10** M10 Chromium 浏览器验收：EN/ZH × 1440/390，最终数字、五条周期共享几何、两组比值、十项配置与 content.js 一致且合计 100%；滚动后无数字逐帧变动；无 JS 静态数字与十项 fallback；注入零/负/缺失值和极长 EN/ZH 名称，无整页横向溢出。
- **15/15** 单测：四项新几何测试（含单点、全空、全零、纯负、极端尺度），加原太阳系与页面展示契约。
- **29/29** M08 四页目录回归通过，覆盖锚点、历史返回、语言、真实滚轮、新标签链接与 320/768/1280/横屏布局。初次发现中文 Portfolio 桌面返回周期路径时位置偏离：上一跳锚点校正到 hashchange 才释放，可能覆盖较早发生的历史滚动恢复。现在在 popstate 阶段提前释放；原失败场景连续 **3/3** 复验通过，再通过四页完整目录回归。没有为此主动重设历史位置或写入 history。
- prebuild 全部检查、TypeScript、JS 语法、直接 Vite 构建、git diff --check 通过。原有 >500kB chunk 提示仍在。
- 初次坐标断言因 `4.4 / 5 * 100` 的浮点尾数 `88.00000000000001` 被精确相等断言拒绝；改用几何容差后通过，没有修改已公开数值。

本地构建 `/tmp/afflatus-astra-m10`，仅对 manifest active 页面调用已有本地化导出函数，未运行小说发布生成。预览：[周期路径](http://127.0.0.1:4185/en/portfolio.html#flightPathsTitle)。

| 视口 | 周期修改前 | 周期修改后 | 比值 | 权重 |
| --- | --- | --- | --- | --- |
| EN 1440×1000 | [before](astra-m10-evidence/before-en-1440-cycles.png) | [after](astra-m10-evidence/after-en-1440-cycles.png) | [图](astra-m10-evidence/after-en-1440-ratios.png) | [图](astra-m10-evidence/after-en-1440-weights.png) |
| EN 390×1000 | [before](astra-m10-evidence/before-en-390-cycles.png) | [after](astra-m10-evidence/after-en-390-cycles.png) | [图](astra-m10-evidence/after-en-390-ratios.png) | [图](astra-m10-evidence/after-en-390-weights.png) |
| ZH 1440×1000 | [before](astra-m10-evidence/before-zh-1440-cycles.png) | [after](astra-m10-evidence/after-zh-1440-cycles.png) | [图](astra-m10-evidence/after-zh-1440-ratios.png) | [图](astra-m10-evidence/after-zh-1440-weights.png) |
| ZH 390×1000 | [before](astra-m10-evidence/before-zh-390-cycles.png) | [after](astra-m10-evidence/after-zh-390-cycles.png) | [图](astra-m10-evidence/after-zh-390-ratios.png) | [图](astra-m10-evidence/after-zh-390-weights.png) |

[浏览器日志](astra-m10-evidence/browser.log)、[单测](astra-m10-evidence/unit.log)、[M08 回归](astra-m10-evidence/regression.log)、[预构建](astra-m10-evidence/prebuild.log)。截图使用页面公开数据，不是过渡帧或合成行情。

本轮不声称其他页面的 M10 已完成。没有实测真机 Safari、Firefox、完整 VoiceOver 或原生 200% 缩放，也没有重跑全站 Lighthouse/性能测量。金融依据只核对到仓库公开摘要，不能据此认证私人账本或模型准确性。
