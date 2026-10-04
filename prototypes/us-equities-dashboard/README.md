# AFFLATUS 美股看板原型

本原型对应用户选择的第 3 版及其后续调整：左侧个股详情，右侧自选列表，主页面仅一个添加入口，三大指数采用第 1 版的排版并保持紧凑高度。

预览：`http://127.0.0.1:5186/`。

界面支持个股与指数切换、周期切换、图表读数、股票搜索、自选添加与删除、涨跌排序和中英文切换。行情均为虚构示例，自选状态仅存在于当前页面会话，重新加载恢复初始内容。

独立项目入口为 `src/App.jsx`，示例数据在 `src/marketData.js`，数据图表在 `src/MarketChart.jsx`。设计来源和捕获证据位于 `design/`，检查结果见 `design-qa.md`。不会修改 Afflatus 的现有生产路由。

```sh
npm install
npm run dev -- --host 127.0.0.1 --port 5186 --strictPort
npm run build
npm run test:sites
```

## 图像与字体

使用内置 Image Gen 生成以下项目资产，并保存在项目内：

- `public/assets/paper-grid.png`：1487 × 1058。提示方向：#faf9f5 暖白纸面，几乎不可见的细灰网格，每四格稍强，纸纤维质感，无文字、物件或阴影。
- `public/assets/pigment-wash.png`：1024 × 512。提示方向：白纸上的浅灰铅笔与水彩颜料，向右上方的自然笔触，柔和纸面颗粒，无轴线、网格、文字和图表边界；由动态图表按数据裁切与着色。
- `design/selected-design.png`：修改后的第 3 版设计图，作为唯一视觉目标。原稿与修订均由内置 Image Gen 生成。

Newsreader 字体复用现有项目的本地字体；标准 UI 图标使用 Phosphor Icons。纹理作为纹理使用，图表与文字保持真实可交互。
