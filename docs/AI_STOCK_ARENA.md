# AI Stock Arena · 操作文档（中文）

「AI 股票竞技场」是 Project Afflatus 站点的一个互动页面：你预测某只美国 AI 相关股票在
接下来 60 秒的涨跌方向，一个可解释的 AI 模型同时给出它的判断，谁更准谁赢这一局。页面
风格与全站 HUD（酸绿 + 青色）一致，并复用 `/page-turn.css` 的字体与翻页导航。

> 仅供娱乐，不构成投资建议。报价可能延迟或为模拟数据。

---

## 文件位置

| 文件 | 作用 |
| --- | --- |
| `public/arena.html` | 页面结构与样式（自包含，纯静态，随 Vite 一起复制到 dist） |
| `public/arena.js` | 全部逻辑：行情拉取、游戏、图表、计分、新闻渲染 |
| `public/arena-news.json` | 每日新闻摘要（定时任务写入，页面读取） |

这些都在 `public/` 下，属于 Vite 的静态资源，**不经过打包**，构建时原样复制到 `dist/`，
线上访问路径为 `https://feida.au/arena.html`。

导航已接好：首页与各子页的导航栏都加了 **Arena** 链接，翻页顺序为
`首页 → Sectors → Fleet Log → Signal → Arena → 首页`。

---

## 实时数据（Finnhub）

数据源在 `public/arena.js` 顶部的 `CONFIG` 里配置，你的 key 已经写好：

```js
const CONFIG = {
  finnhubKey: 'd8nvs5pr01qvtr6lft30d8nvs5pr01qvtr6lft3g',
  dataSource: 'finnhub',   // 改成 'sim' 可强制使用模拟引擎
  pollMs: 8000,            // 轮询间隔（注意免费档约 60 次/分钟）
  newsUrl: '/arena-news.json',
};
```

- 页面每 8 秒向 Finnhub 拉取一次报价；右上角徽标显示当前数据源（`LIVE · FINNHUB`）。
- **自动降级**：如果实时源连续返回空（限流 / 跨域 / 非交易时段无数据），页面会自动切换到内置
  的模拟行情引擎，徽标变为 `SIM (NO LIVE)`，保证看板永不空白。
- 美股交易时段（美东 09:30–16:00）会自动识别，非交易时段显示 盘前 / 盘后 / 休市。

> ⚠️ **安全提示**：这是纯前端静态页面，`finnhubKey` 会直接暴露在浏览器里，任何访客都能看到。
> 个人项目通常可接受，但免费档有调用上限。若担心被滥用，建议改用一个轻量后端 / Serverless
> 代理来转发请求，把 key 留在服务端，再让 `arena.js` 改为请求你的代理地址。这个 key 已在
> 对话中公开过，必要时可在 Finnhub 后台重新生成。
>
> 另外 Finnhub 默认允许浏览器跨域调用 `/quote`；如果某天遇到 CORS 报错，多半就是要上代理了。

---

## 每日新闻信号

页面右侧「Today's Signal」读取 `public/arena-news.json`，对每条新闻做情绪打分，并把整体
市场情绪融入 AI 模型的预测。

一个 **Cowork 定时任务**（每个工作日美股开盘前约 1 小时运行，美东 8:30，即墨尔本约 22:30；
注意美/澳夏令时切换时偏移会变 1 小时）会自动搜索当天与 AI 股票相关的
财经 / 科技 / 政治 / 产业新闻，生成摘要并写入该文件。任务连接到本仓库文件夹后会直接覆盖
`public/arena-news.json`，提交 / 部署后页面即更新。

JSON 结构：

```json
{
  "date": "2026-06-15",
  "generatedAt": "ISO-8601 时间戳",
  "items": [
    { "category": "financial|tech|political|industrial",
      "title": "...", "summary": "...", "source": "...", "url": "...",
      "tickers": ["NVDA"] }
  ]
}
```

`category` 只能是这四类之一；情绪分由页面自动计算，无需手填。

---

## 游戏规则

- 预测正确：**+10**，外加奖励分。你的奖励分随实际涨跌幅度提高（奖励抓大行情）；AI 的奖励分
  按它自报的置信度计算。
- 预测错误：**−4**。
- AI 的判断会在你**先选完之后**才揭晓，是真正的正面对决。
- 连胜、胜负、准确率分别记录，保存在浏览器 `localStorage`（key：`afflatus-arena:v1`），
  点「Reset」清零。

AI 模型综合三个信号：价格**动量**、短期**均值回归**、新闻**情绪**，并说明每次判断主要由哪个
信号驱动。它只是游戏对手，不是投资建议。

---

## 常见维护操作

- **改股票池**：编辑 `arena.js` 里的 `TICKERS` 数组（symbol / name / sector / seed）。
- **改轮询频率**：改 `CONFIG.pollMs`。
- **换数据源**：实现一个 `fetchQuotes(symbols)` 返回
  `{ [symbol]: {price, prevClose, open, high, low} }` 的 provider 即可替换 Finnhub。
- **本地预览**：在仓库根目录 `npm run dev`，访问 `/arena.html`。
- **构建**：`npm run build`，`public/` 下的三个文件会原样进入 `dist/`。
