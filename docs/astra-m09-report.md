# M09 · Arena 同类视图标签

2026-09-05。保留 M08 全部未提交改动。当前工作区为 detached HEAD，起点与 `codex/afflatus-astra-motion` 一致：`b07ad969f740a6cee3c2cbd4efb52c072b700967`；该分支已被另一 worktree 占用，因此没有强行切换或移动分支。本轮未提交、发布或推送。

## 范围与选择

检查 Portfolio、Sectors、Signal、Course、小说及 Arena 的现有控件。实际已有同类数据视图为 Arena 技术分析的 PRE-MARKET / POST-MARKET；原实现虽然声明 tablist/tab，却缺少面板关联和键盘导航，点击还会重建整个技术分析区并丢失焦点。

本轮只完善这一组。目录、地图、筛选、独立章节及 Command station 导航继续承担原功能，不为了数量新增 tabs 或隐藏正文。

## 实现

- `src/pages/arenaTech.js`：原有按钮获得唯一 `id`、`aria-controls`、`aria-selected`、roving tabindex；两个面板分别关联自己的标签。左右键循环、Home/End 定位并激活，Enter/Space 沿用原生 button 点击。点击及键盘焦点留在标签，横向可见性修正只写标签条 scrollLeft。
- 两个视图使用同一次请求与分析的结果，各自一次生成价位标尺和说明卡。属于预加载的轻量 DOM 视图，采用自动激活；激活不请求、不重算、不重建 DOM。原有其他筛选、展开的方法说明与页面滚动保持。没有新增 Canvas、媒体或持续渲染循环，inactive 面板也没有后台昂贵任务需要继续运行。
- `public/styles/arena.css`：两个面板置于同一 grid 单元，共享最大布局高度，图表仍保留原有至少 560px 标尺高度。inactive 使用 `visibility:hidden` + `inert` + `aria-hidden`，退出视觉、键盘及可访问树，保留几何空间避免跳动。内容只做 200ms opacity 淡入，减少动态下关闭。活动项用下划线和原有填充表达，focus-visible 使用独立外框。
- 手机标签保留 14px 主标签 / 12px 副标签、至少 48px 高度；超宽横向滚动，左右渐隐与方向符号提示剩余内容，选中项及视口尺寸改变时自动进入条内可视范围。`pan-x pan-y pinch-zoom` 保留纵向滚动和缩放，没有全局方向键或触摸拦截。
- `arena.html`：JS 未初始化时两种参考方法按顺序可读，并提供普通链接访问既有 `/arena-picks.json`。不声称无 JS 能请求/计算任意代码的实时日线，也没有把测试行情写入页面或发布数据；原有页面方法论保持可读。

## 验证

本机 Playwright Chromium，EN/ZH × 1440/390，加 320px 长英文标签与触摸模拟：

- `e2e/astra-tabs.spec.js` **11/11**：标签/面板关联、单个可访问面板、inert、roving tabindex、左右循环、Home/End、Enter/Space、Tab/Shift+Tab；同页方法展开与 QF 再平衡筛选保留；12 次离线快速切换零新增请求、纵向位置与容器高度不变；左右边缘提示；CDP 真实触摸事件从标签条纵向拖动页面；减少动态；EN/ZH 无 JS 顺序说明；首次无网加载显示错误而非空 tabs。
- `arenaPageState`、`technicals`、`ladderLayout` **33/33** 单测通过。
- prebuild 全部检查、TypeScript、JS 语法、直接 Vite 构建、`git diff --check` 通过。既有 >500kB chunk 提示仍存在。
- 初次测试有一条仅因 Chromium 将 `pan-x pan-y pinch-zoom` 序列化为等价的 `manipulation` 而失败；修正断言并另加实际触摸手势验证，最终全部通过。

本地构建位于 `/tmp/afflatus-astra-m09`，只对 manifest active 页面调用既有本地化导出函数，没有运行完整小说路由生成。预览：<http://127.0.0.1:4184/en/arena.html?embed=1#taDash>。

## 截图与边界

同条件截图使用明确的**合成测试日线**和模拟报价，仅验证布局和交互；不是新的行情证据。截图中的 STALE 标志是原有真实状态规则对旧测试日期的正常处理。

| 环境 | 修改前 | 修改后 |
| --- | --- | --- |
| EN 1440×900 | [before](astra-m09-evidence/before-en-1440.png) | [after](astra-m09-evidence/after-en-1440.png) |
| EN 390×900 | [before](astra-m09-evidence/before-en-390.png) | [after](astra-m09-evidence/after-en-390.png) |
| ZH 1440×900 | [before](astra-m09-evidence/before-zh-1440.png) | [after](astra-m09-evidence/after-zh-1440.png) |
| ZH 390×900 | [before](astra-m09-evidence/before-zh-390.png) | [after](astra-m09-evidence/after-zh-390.png) |

[浏览器日志](astra-m09-evidence/browser.log)、[单测日志](astra-m09-evidence/unit.log)、[预构建日志](astra-m09-evidence/prebuild.log)。

本轮没有修改 M08 文件，也没有重复跑完整 M08/M07 验收；没有实测 iPhone/Safari、Firefox、完整 VoiceOver、原生 200% 缩放或线上性能。可访问树与焦点由 Chromium 自动化覆盖，不能替代这些人工/真机验证。
