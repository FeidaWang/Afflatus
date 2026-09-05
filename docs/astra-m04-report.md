# M04 · 一次性 Portfolio 开屏

2026-09-05，Australia/Melbourne。继承 M03/M07，仅扩展 Portfolio 的现有星场。保留此前未提交改动；没有发布、推送、修改业务数据或小说路由。模块设计和后续 prompt 仍在 [设计手册](astra-motion-design.md)。

## 实现

- 在 `src/scene/backgroundScene.js` 的同一个 Points / ShaderMaterial 中加入 `uIntro`：星点从略松散的轨迹收拢至 M03 主体。保持原视角、三层粒子、配色、4k/DPR 1.5 上限和原有启停 owner，没有第二个 renderer 或动画循环。
- `src/scene/starfieldIntro.js` 只管理一次性视觉状态与截止时间。自动开屏从 HTML 入口时刻算起，最迟约 1.2s 完成；资源足够快时，实际成形最长 1s。若可用时间不足 150ms，直接进入终态。
- 标题、正文、CTA 始终是原有 HTML。关闭标题原本的循环金属扫光，本轮不添加标题位移、打字机、loading 遮罩或百分比。
- poster 与固定舞台尺寸先存在；Canvas 有第一帧后，利用其不透明底色与 180ms opacity 过渡覆盖 poster。取消、减少动态和失败时直接稳定显示，不继续剩余装饰序列。
- 在 HTML 中先记录早期滚动/导航/表单意图，因此 JS 尚未到达时用户滚动过再返回顶部，也不会突然补播。
- 滚动、触摸、导航/控件操作、表单聚焦、键盘、减少动态、离屏、Command、上下文丢失和 pagehide 都会结束开屏。M03 的暂停偏好优先。
- 页面级 session 标记阻止同一标签页再次自动播放；`back_forward` 导航类型与 BFCache 生命周期另行兜底。没有改 `history`、`scrollRestoration`、语言或业务存储来模拟恢复。
- 新增独立的双语“重播开屏”按钮。仅重置视觉时间线，保持视角、滚动、语言、数据和暂停偏好；暂停/静态/失败时按钮禁用。按钮并列，不嵌套。

## 布局稳定性

Portfolio 的 Orbitron/Rajdhani 请求改用 `display=optional`；本页 JetBrains Mono 也采用 optional。字体及时可用时沿用原字体，迟到则保持当前文档的首帧后备字体，不以一次晚到换字形挪动正文。未改变其他页面的字体策略。

舞台沿用 M03 的高度边界并声明比例；提示区预留两行高度；三个控制按钮各预留 140px，窄屏自然换行。按钮字体未到达、JS 尚未启用控件时，也已有相同占位。

实测延迟字体和星场资源超过开屏截止时间后再放行，标题、正文、CTA、舞台和重播按钮的 x/y/width/height 均与之前完全一致。本次结果见 [布局 JSON](astra-m04-evidence/late-resource-layout.json)。这不是全站或所有字体平台的 CLS 保证。

## 四种状态截图

均来自本地构建的英文 Portfolio，CSS 视口 1440×1000。

| 状态 | 证据 |
| --- | --- |
| 初始 HTML | [01-initial-html.png](astra-m04-evidence/01-initial-html.png)：阻断全部外部 JS，正文和原生 CTA 可读可点击，poster 已占位 |
| 成形终态 | [02-formed.png](astra-m04-evidence/02-formed.png)：三层星点归位，文字区域稳定 |
| 用户提前滚动 | [03-early-scroll.png](astra-m04-evidence/03-early-scroll.png)：取消开屏；按 M03 与星门交接时显示稳定 poster |
| 后退恢复 | [04-history-restored.png](astra-m04-evidence/04-history-restored.png)：等待原有浏览器跨页转场完成后截图，保留 180px 滚动位置，没有重新开屏 |

初始截图验证“增强脚本不到达也能访问内容”，而不是依靠动画模拟加载完成。CTA 测试实际点击原生锚点并确认到达财年记录。

## 时间与恢复实测

[时间线 JSON](astra-m04-evidence/sequence.json)记录本次自动开屏：相对 HTML 入口约 **507ms 开始成形、1,201ms 完成**；差异来自主线程定时器调度。重播最长 1,000ms，沿用同一帧循环。

[历史 JSON](astra-m04-evidence/history.json)记录真实浏览器 `pageshow.persisted=true`：同一个文档从 BFCache 恢复，之前的开屏记录保留，未增加第二次 entering，scrollY 仍为 180。另有真实前进/后退和模拟 persisted 生命周期回归。

排查期间发现，无头 Chromium 在快速连续原生跨页转场后的绘制/截图会停滞；未修改的 M03 预览也能复现。尝试过的页面转场改动已全部撤回，本站原有转场继续保留。最终验收使用可见 Chromium，允许 BFCache，并以导航提交及原生转场完成作为恢复判定；不等待 BFCache 恢复时未必重新发生的 load 事件。相关标准接口说明：[MDN 页面恢复事件](https://developer.mozilla.org/en-US/docs/Web/API/Window/pagereveal_event)。

## 文件与验证

本轮实现文件：

- `portfolio.html`：早期意图记录、初始静态标记、重播按钮、慢字体策略。
- `src/main.js`：在懒加载图形之前准备一次性状态，加载失败时结束序列。
- `src/scene/starfieldIntro.js`：一次性/重播/中断/历史恢复合同。
- `src/scene/backgroundScene.js`：原渲染循环中的成形 uniform、首帧交接和重播控件。
- `src/home-visual-upgrade.css`：180ms 交接、稳定的提示/按钮占位、本页字体策略和静止标题。
- `e2e/astra-opening.spec.js`：7 项 M04 浏览器验收；可见浏览器环境要求在文件头注明。
- 本报告及 `astra-m04-evidence/`：截图与原始观察记录。

检查：7 项 M04、8 项 M03、6 项阅读/导航浏览器测试全部通过，覆盖拖拽、键盘、暂停、离屏、触屏、WebGL 失败/恢复及既有内容边界。36 项相关单元测试、typecheck、prebuild 各项校验及独立 Vite 构建通过。完整构建继续保留既有 Three.js 大 chunk 提示。

本地化仅使用现有 transform 为 active 页面生成现有 EN/ZH 变体，没有运行小说章节生成器。

本地预览：[英文](http://127.0.0.1:4178/en/portfolio.html) · [中文](http://127.0.0.1:4178/zh/portfolio.html)。产物目录 `/tmp/afflatus-astra-m04`；首次查看可自动播放，同标签页再次访问请用“重播开屏”。

## 限制

真实历史恢复与 BFCache 已在本机可见 Chromium 验证；Safari、Firefox、实体手机、存储被禁用的真实浏览器设置和长时间热状态尚未逐项验证。手机和 reduced-motion 沿用 M03 静态路径。本轮记录的是本站开屏时序与边界，未重新做长时 GPU 性能评测，也不推断参考站内部算法。
