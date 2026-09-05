# M03 · Afflatus 可控轨迹星场

实施日期：2026-09-05（Australia/Melbourne）。本轮仅实现 Portfolio 的 M03，以及该场景所需的 M07 适配。此前 M00–M02 的未提交改动保留。设计依据和后续模块 prompt 仍在 [astra-motion-design.md](astra-motion-design.md)。没有发布、推送、修改金融数据或小说发布路由。

## 实际替换位置与所有权

**`src/scene/backgroundScene.js` 替换原 Canvas2D / Worker 星空实现**，继续拥有唯一的 `#starfield`，改为已有 Three.js 的一个 `Points`、一个 `BufferGeometry`、一个 `ShaderMaterial`、一个 renderer。删除不再引用的 `backgroundScene.worker.js`。没有新增依赖。

- `src/main.js` 在 Hero 可见且设备适合交互时懒加载该模块；独立于可选的 Command bundle。
- `src/homeExperience.js` 不再创建或逐帧绘制背景；进入/退出 Command 通过现有模式切换通知场景。原黑洞 iframe 保持无 `src`，不启动其 renderer。
- `src/scene/alphardForge.js` 通过现有启停回调通知星场交接：星门开始可见时暂停 Hero 星场。初始化也读取现有协调器，处理先加载星门的情况。
- 继续注册到 `renderBudgetCoordinator`，surface ID 为 `home:orbital-starfield`；沿用 `webglLifecycle` 的上下文配额、首次恢复、重复丢失回退及资源释放。
- 修复协调器的零面积相交边界：`isIntersecting=true`、`intersectionRatio=0` 不算可见。实测在 1440×1000 首屏，星门顶端恰好位于 y=1000；此前会错误启动星门并暂停 Hero。

这是对本站已有黑洞环状主体的原创轨迹表达，不使用 OpenAI 数字 6、花结或未经授权的品牌路径。静态视图沿用 `public/vendor/black-hole/source-poster.jpg`；原有第三方署名和许可文件保持不变。

## 视觉和交互合同

| 项目 | 已实现 |
| --- | --- |
| 三层星点 | 15% 稀疏远尘、84% 主体轨迹、1% 高亮近星；交错排列，降低 drawRange 后仍保留三层 |
| 配色 | 青白为主，约 7.5% 琥珀色；三条有深度的环状轨迹延续原主体 |
| 文字留白 | 桌面文字与场景分列，≤1000px 回到正常文流；不在正文背后绘制全屏星场 |
| 鼠标 | 仅场景区域捕获；约 6px 才开始拖动，up/cancel/lostcapture 释放；fine pointer 可小幅被动视差 |
| 视角 | yaw ±0.65rad、pitch ±0.38rad；指数阻尼 τ=0.16s，dt 上限 50ms；无 React 逐帧 state |
| 键盘 | 场景可聚焦；方向键旋转、Home 归零、Esc 结束交互并把焦点交给重置按钮 |
| DOM 控件 | 双语提示、重置视角、暂停/继续动态；原生并列按钮，无嵌套按钮；canvas aria-hidden |
| 暂停 | 保存到 localStorage；停止连续绘制，仍允许用户主动旋转/重置并绘制一次 |
| 手机 / reduced-motion | 稳定的原授权 poster；禁用不适用的视角控件，不阻止纵向滚动；支持运行中切换系统偏好 |
| 失败 | 模块加载失败、WebGL 不可用或反复丢失时保留 poster、正文和导航；首次上下文恢复后重绘 |
| 生命周期 | 离屏、Command、星门交接、pagehide 均停止循环；persisted pageshow 恢复；真正卸载释放资源 |

## 实测结果

[原始采样 JSON](astra-m03-evidence/performance.json)。本机 Playwright Chromium **SwiftShader 软件渲染器**，Vite 开发页面，1440×1000，设备 DPR=2；不是实体手机或独显性能，也不是源站内部算法测量。

| 指标 | 本次结果 |
| --- | --- |
| 粒子 / 实际 DPR | 4,000 / 1.50 |
| 绘图缓冲区 | 907×691 |
| 测量窗口 | 10,002.5ms |
| 实际 drawArrays 调用 | 600，约 59.99 次/秒 |
| 协调器最近窗口 P95 帧间隔 | 16.8ms；不是单帧 GPU 耗时 |
| 每帧 draw call | 1 |
| 活动 surface | 1：星场；星门 inactive |
| 质量档 | 保持现有 high 档，但本模块按中档上限封顶 4k / 1.5，不扩大到 8k |
| 页面 JS 错误 | 0 |

初次采样发现 120Hz 环境会按显示器频率绘制，现已遵守协调器的 60Hz target。最终采样未触发连续超预算降档；遥测仍记录 `thermalState: warm`，这是协调器对帧窗口的历史分类，**不是硬件温度测量**。低档测试通过模拟已有设备能力检测输入，确认采用 1,200 粒子 / DPR≤1；不把模拟输入称为真实低端机性能测试。共享协调器的逐级降档已有单元测试覆盖。

暂停、离屏、Command、上下文丢失等测试直接统计星场 WebGL `drawArrays`：稳定观察窗口内调用数不增加。主动重置/方向键允许一次绘制。没有通过每帧 DOM/React 更新来实现旋转。

## 截图与布局证据

前后图的桌面 CSS 视口均为 1280×844；前图来自 M00–M02 基线，后图为本轮暂停后的稳定星场。不是相同 GPU 动画帧的像素对照。

- [之前：M00–M02 首屏](astra-phase1-evidence/after-1280-hero.png)
- [之后：M03 首屏](astra-m03-evidence/after-1280-hero.png)
- [英文桌面](astra-m03-evidence/desktop-en.png) · [中文桌面与暂停态](astra-m03-evidence/desktop-zh.png)
- [手机首屏](astra-m03-evidence/mobile-en.png) · [手机静态主体与提示](astra-m03-evidence/mobile-scene.png)
- [无 JS 首屏](astra-m03-evidence/no-js.png)
- [1024 / 1280 / 1440 / 1920px 布局边界](astra-m03-evidence/layouts.json)

原 `.hero-title` 字号/宽度和 `.hero` 最小高度上的 legacy `!important` 会盖过现有样式 owner，导致两列重叠；本轮仅移除相关属性的优先级，尺寸放在 `home-visual-upgrade.css` 的 components 层。没有增加 `!important`。

## 变更文件

| 文件 | 本轮用途 |
| --- | --- |
| `portfolio.html` | 场景容器、装饰 canvas、双语提示和两个控件 |
| `src/main.js` | 条件懒加载和模块失败回退 |
| `src/scene/backgroundScene.js` | 单 renderer、交互、预算、生命周期 |
| `src/scene/backgroundScene.worker.js` | 删除被替换后不再引用的 Worker |
| `src/scene/starfieldModel.js` | 原创确定性几何、阻尼、限幅和粒子档位 |
| `src/homeExperience.js` | 移除旧背景驱动，通知 Command 状态 |
| `src/scene/alphardForge.js` | 在原有启停回调中通知场景交接 |
| `src/lib/renderBudgetCoordinator.js` | 零可见面积边界修复；保留 M00 的多 surface 修复 |
| `src/home-visual-upgrade.css`、`src/styles.css` | 文本安全区、场景布局、焦点和触屏样式；解除必要的 legacy 优先级 |
| `tests/starfieldModel.test.js`、`tests/renderBudgetCoordinator.test.js` | 几何、档位、时间阻尼、限幅、可见性边界 |
| `tests/homeBlackHoleContract.test.js`、`tests/combatPresentationContract.test.js` | 将旧 renderer 字符串断言更新为当前单一所有权合同，保留许可断言 |
| `e2e/astra-starfield.spec.js` | 8 项场景浏览器验收 |
| `e2e/astra-reading.spec.js` | BFCache 断言允许无关懒加载完成，同时检查原 owner 保留且没有重复 |
| 本报告与 `astra-m03-evidence/` | 本轮截图、布局和性能证据 |

工作区中其他 M00–M02 文件仍是上一轮改动，本表不把它们计为本轮新增工作。

## 已运行检查

- **36 项单元测试通过**：starfieldModel、renderBudgetCoordinator、renderBudget、webglLifecycle、homeBlackHoleContract、homePresentationContract、combatPresentationContract。
- **8 项 M03 浏览器测试通过**：拖拽阈值与捕获释放、键盘/重置、暂停保存、离屏和 Command、动态 reduced-motion、WebGL 创建失败、触屏纵向滑动、真实上下文恢复/重复失败、模块失败/无 JS、低档预算与 persisted 页面生命周期（部分合同合并在同一测试中）。
- **6 项 M00–M02 浏览器回归通过**：320px/放大重排、完整数据标签、双语原生导航、无 JS、失败回退、Command 焦点和滚动位置恢复。
- `npm run typecheck` 通过。
- `npm run prebuild` 通过：数据、站点 manifest、header、CSS、combat 资产、i18n、OG 校验。
- `npx vite build --outDir /tmp/afflatus-astra-m03` 通过；仍有既有 Three.js vendor chunk 大于 500kB 的提示。
- 仅调用已有本地化 transform 导出，为 active 页面生成现有 EN/ZH 变体；没有运行小说章节生成器。
- `git diff --check` 通过。

本地预览：[EN](http://127.0.0.1:4177/en/portfolio.html) · [ZH](http://127.0.0.1:4177/zh/portfolio.html)。产物在 `/tmp/afflatus-astra-m03`；预览服务需保持运行。

## 待验证限制

本轮 M03 浏览器自动化和图形采样以 Chromium 为主。仍需真实 iOS/Android 触摸、Safari/Firefox 图形行为、实体低端 GPU 长时间热状态和读屏器逐项体验验证。触屏测试使用 Chromium 移动模拟与实际 touch 事件分发；persisted 页面测试使用生命周期事件模拟，不等于各浏览器真实 BFCache 的完整覆盖。没有实施 M04 开屏编排、M05 滚动叙事或其他后续模块。
