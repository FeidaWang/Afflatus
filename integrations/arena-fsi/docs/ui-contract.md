# Arena FSI 界面集成契约

本文对应 `ui/ArenaFsi.jsx`、`ui/styles.css`、`ui/standalone.jsx` 和 `ui/arena.html`。界面以同源 API 为唯一动态事实来源；初始未连接、行情缺失、授权不足均使用空态和实际错误信息，不自动填入演示行情。

## 在现有 React 页面中接入

```jsx
import React, { lazy, Suspense } from 'react';
import ArenaFsi from './features/arena-fsi/ArenaFsi.jsx';

const Markets = lazy(() => import('./Markets.jsx'));

export default function App({ locale = 'zh' }) {
  return (
    <ArenaFsi
      locale={locale}
      apiBase="/api/arena-fsi"
      legacyResearch={() => (
        <Suspense fallback={<p>正在读取原有研究模块…</p>}>
          <Markets locale={locale} />
        </Suspense>
      )}
    />
  );
}
```

上例仅说明组件边界。原 Markets 的真实文件路径、导出名称和 props 由宿主入口适配。`legacyResearch` 可传 React 元素或无参数渲染函数；只有用户展开原研究区后才挂载。旧研究接口返回 `FEATURE_DISABLED` 时应保留其明确状态，不在挂载新主界面时自动启用旧功能。

| Prop | 约定 |
| --- | --- |
| `locale` | `zh` 或 `en`；未传时读取根元素语言。 |
| `apiBase` | 默认 `/api/arena-fsi`；必须是 `/` 开头的同源路径，拒绝 `//` 和跨站 URL。 |
| `legacyResearch` | 原日线与披露研究组件，可选；折叠挂载。 |
| `initialState` | 可选的已验证状态快照，供 SSR 或有意的预加载使用；不能用来悄悄替代连接错误。 |

CSS 自组件导入，以 `.fsi-app` 为主要作用域，保留 AFFLATUS 现有公用字体、头部几何与品牌。组件更新根语言、标题、现有 `[data-en]` / `[data-zh]` 文案及共享头部语言链接。中文和英文路径保持 `/zh/...`、`/en/...` 的宿主约定。独立入口仅供本地运行和构建验收，不替换宿主整站头部。

## 请求、权限与轮询

所有请求均以 `route` 查询参数选择资源。GET 使用 `cache: 'no-store'`，凭证同源。管理员令牌只存在 React 内存中，通过 `Authorization: Bearer …` 发送；不写入 localStorage、sessionStorage、Cookie、查询参数或导出文件。输入令牌经过 350 毫秒稳定化后用于 GET status/history，避免输入期间重复请求；回调依赖不包含更新得到的 `data`，所以成功读状态不会制造请求循环。

公共 `status` 每 15 秒读取一次；标签页隐藏时暂停并取消在途轮询，恢复可见时读取一次。这个间隔是状态轮询间隔，不是逐笔流或刷新速度保证。报价源、授权公开展示、缓存租约、行情新鲜度与持久化条件均由服务端判定。GET 不触发交易。

| 方法 / route | UI 发送内容 / 处理 |
| --- | --- |
| GET `status` | `mode=live`，显式载入演示后改为 `mode=demo`；如用户输入令牌则附 Bearer。响应 mode 必须与请求一致。 |
| GET `demo` | 仅“载入演示”按钮主动调用。必须响应 `mode: 'demo'`。演示账本与 live 分离。 |
| GET `history` | `symbol`、`mode`；可附 Bearer。按股票、模式、快照日期或令牌变化读取，不因每次报价轮询重复拉取全部历史。 |
| POST `refresh` | `{mode}` |
| POST `run` | `{mode, idempotencyKey, profiles?: ['S','P','T']}` |
| POST `order` | `{mode, ledgerId, order: {symbol, side, type, quantity, limitPrice?, snapshotId?, idempotencyKey}}` |
| POST `pause` | `{mode, ledgerId, paused}` |
| POST `cancel` | `{mode, ledgerId, orderId}` |
| POST `research` | `{mode, kind, input?}`；界面使用 `dcf`、`brief` 和 `evidence`。 |
| POST `thesis` | create 使用 `input`；update 使用 `id` 与 `update`。详见下文。 |
| POST `catalyst` | create 使用 `event`；resolve 使用 `id` 与 `outcome`。 |
| POST `feedback` | `{mode}`；服务端执行到期预测的可验证结算。 |

所有 POST，包括演示 POST，都要求管理员 Bearer。未输入令牌时，提交、研究计算、运行策略和修改记录按钮禁用。run/order 的同一请求在网络结果不确定时复用幂等键；订单键同时写入 `order.idempotencyKey`。HTTP 错误明确显示；HTTP 成功但 `ok:false` 的业务风控拒绝仍作为结构化结果展示，随后重新读取账本。

## 状态与金融展示

`status` 至少提供 mode、capabilities、snapshot、portfolios、runs、feedback、research 和 connectors。缺失数组归一为空数组；缺失数值显示 `—`，不能变为零。金额、日期、百分比按界面语言格式化，持仓收益率 `totalReturn` 视为小数比例，报价 `changePct` 视为百分点。

报价读取 `symbol, price, bid, ask, asOf, receivedAt, source, quality, currency, sector, previousClose, changePct`。质量单独区分 demo、stale、delayed、eod、closed、realtime、observed、invalid、unknown、unavailable。快照 `calendarStatus: 'unavailable'` 显示“交易时段未核验”；只有服务端已核验的日历状态才能支持休市文案。未来超过 5 秒的报价时间显示无效；超过 90 秒的即时观察显示过期。服务端仍负责执行可用性的最终严格判定。

IEX 行情明确标注来自单交易所，并非全市场合并报价。DEMO 顶部及模型卡标注演示模式及“确定性规则，不调用真实 LLM”；退出演示清空演示子面板状态后重新读取 live。没有实时行情的情况下不会保留一条合成的股票走势充当背景。

历史接口形状：

```json
{
  "symbol": "NVDA",
  "bars": [{"asOf": "2026-10-09T00:00:00Z", "open": 100, "high": 102, "low": 99, "close": 101, "volume": 12345}],
  "quality": "eod",
  "source": "provider-name",
  "asOf": "2026-10-09T00:00:00Z",
  "executionEligible": false
}
```

上方 JSON 只说明结构，数值不是市场观察。界面要求 symbol 匹配、quality 为 eod/demo 且与请求模式一致、executionEligible 为 false。SVG 只从有效时间戳与有效历史收盘价生成，排序去重，不插入随机数据；日线与演示历史分别标注来源，且明确不参与执行定价。

组合卡读取 `valuation.cash/equity/positions/totalReturn/realizedPnl/fees` 和 `paused`。持仓采用 `symbol/quantity/averageCost/marketValue/unrealizedPnl`。挂单来自 `portfolios[].pendingOrders`。所有成交都是 paper execution，前端未集成真实券商订单提交。

## 研究输入与输出

DCF 表单以百万美元输入基期企业自由现金流、非经营性现金和债务；百万股输入稀释后股数。请求将股数乘 1,000,000 转成实际股数。以 bear/base/bull 各自明确的增长假设生成年度 FCFF 数组，使用共同 WACC 和永续增长；WACC 必须大于永续增长。日期按 UTC 截止日发送，默认年末折现。现金只在净债务桥接中计入一次。

```js
{
  currency: 'USD', units: 'millions', asOf: '2026-10-12T00:00:00.000Z',
  cash, debt, shares: {diluted: actualShares},
  scenarios: {
    bear: {fcff: annualAmounts, wacc: decimal, terminalGrowth: decimal},
    base: {fcff: annualAmounts, wacc: decimal, terminalGrowth: decimal},
    bull: {fcff: annualAmounts, wacc: decimal, terminalGrowth: decimal}
  },
  sensitivity: {waccStep: 0.005, growthStep: 0.005}
}
```

界面读取 `result.scenarios.*.pricePerShare`、enterpriseValue、equityValue 和年度 schedule，以及 `result.sensitivity.waccValues/growthValues/grid`。单元格 `{valid, pricePerShare, reason?}` 保留无效假设空格与原因，中央情景加框。企业价值、股权价值和年度现金流按百万美元标注；每股价格按美元展示。演示假设只有用户点击专门按钮后才填入，并注明虚构。

证据导入使用 `{kind:'evidence', input:{visibility:'public', sources:[...]}}`。UI 要求用户确认来源元数据可公开显示。每项来源包含 `id,title,kind,url,publishedAt,availableAt`；URL 仅呈现无用户名密码的 HTTPS 链接。前端不把 JSON 字段或模型内容作为 HTML 执行。

论点创建发送 `input:{id,symbol,statement,pillars:[{id,expectation,invalidation}],risks,stopTrigger,side:'long',conviction:'medium'}`。新增论点的方向和确信度在表单明确写出。复核发送 `{operation:'update',id,update:{id,type:'review',description,nextStatus}}`，遵守 active/challenged/invalidated/closed 状态转换。复核论点不自动修改持仓。

催化剂创建发送 `{operation:'create',event:{symbol,title,expectedAt,timezone,sourceIds}}`；时间输入明确使用用户本地时区，再转换 ISO UTC。来源必须从已经导入的证据库选择。已到期事件可记录 outcome；未到期事件不显示结果确认按钮。

## 回合记录与反馈

运行记录按 `runs[].results[].profileId` 分组，显示真实 `steps` 中的 analyst、critic、risk、fill 与拒绝理由；可展开结构化原始记录。没有阶段记录时显示空态，不编造分析链。

反馈读取根 `count/minimumRequired/unresolved/expired/invalidated`、单队列 `metrics.brier/logLoss`，以及 `cohorts[].count/metrics/reliability`。不同模型版本、时域、数据类型分别展示。样本不足不排名；达到样本门槛也不声称统计显著性。reliability 逐概率区间显示数量、平均预测概率、观察频率。过期和公司行动失效记录不计入评分；预测事件是区间内股价正收益，不含股息。反馈仅供新版本验证，不在界面承诺已经自动提高收益。

## 已完成验证与边界

执行 `node --test tests/ui-source.test.mjs`，11 项通过。测试覆盖真实零值与缺失值、来源与报价时间、空状态、历史序列、DCF 单位和三情景、同源 Bearer/幂等请求、业务拒绝保留、导出凭证剔除与 token usage 保留、轮询与演示接线，以及整页 React SSR 的未连接/明确演示两种状态。SSR 发现并修复了初始无报价且无历史时的空对象访问。

另执行 `node --test tests/ui-interaction.test.mjs`，整条 DOM 交互场景通过。测试在 jsdom 中真实挂载 React StrictMode 组件，以同源 fetch 适配器直接连接内存 `ArenaService` 和 `createHandler`；Vite 只编译 JSX，关闭 HMR/WebSocket，不监听 HTTP，也不请求外部行情或模型。测试经原生输入事件完成“初始未连接 live → 主动载入 demo → Connections 输入令牌 → 提交 AAPL 两股模拟买单 → 页面现金和持仓与实际服务账本一致 → 返回 live，原账本保持独立”。同时验证单一 15 秒轮询、隐藏暂停和可见恢复、带 Bearer 的 GET、状态刷新没有 effect 请求循环、写操作 mode 和幂等键、令牌未进入 URL 或浏览器存储。该场景还发现并促成修复了初始数据被隐去时误称行情“已配置”的文案优先级问题。

上述 jsdom 验收验证组件事件、请求与账本行为，不执行浏览器布局和绘制。本轮未取得可用浏览器运行环境，因此没有声称完成视觉截图验收或真实浏览器交互端到端测试。宿主完整构建和服务接口验收由主集成流程完成。发布后的图表与数据授权状态需要使用真实部署配置检查。
