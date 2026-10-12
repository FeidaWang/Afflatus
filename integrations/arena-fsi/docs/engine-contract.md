# Paper engine 与绩效计算契约

本文对应 `src/core/paper-engine.mjs`、`src/core/metrics.mjs`。两者均为零第三方依赖的 ESM JavaScript，可在提供 WebCrypto 的 Node.js 22+ 或 Cloudflare Workers 环境中导入。模块不联网，也没有券商下单能力。

## 1. 集成边界

调用方负责验证用户权限、服务器时间、交易日历、数据供应商资格、行情订阅权限以及持久化事务。引擎只消费这些已经确定的事实。`context.allowDemo`、`context.marketOpen`、行情的 `quality/source/asOf` 不能直接信任浏览器请求中的同名字段。

所有写方法原地替换传入 ledger 的状态，并返回操作结果。方法在私有副本上计算，成功完成哈希后才提交到内存对象；校验异常或哈希失败不会留下半笔交易。**同一个账户的读取、修改、保存全过程必须由服务端串行化，或使用带版本比较的数据库事务。**同一 JavaScript 对象的并发写会返回 `CONCURRENT_MUTATION`，但这个检查不能锁住另一个进程、Worker、实例或从数据库复制出的 ledger。

禁止让客户端提交完整 ledger。恢复持久化状态后可以调用 `verifyAuditChain` 与 `ledgerInvariantReport` 验证状态，再接受新的写操作。API 返回成功前必须已提交持久化事务；网络重试使用原来的幂等键。

## 2. API 一览

| 导出 | 输入与返回 | 是否修改 ledger |
|---|---|---|
| `createLedger({id, initialCash, now, risk})` | 同步返回可 JSON 序列化的账户状态；初始现金默认 10,000 USD | 创建新对象 |
| `evaluateOrder(ledger, order, quote, context)` | 同步返回 `{ok, status, errors, execution?, reservation?, provenance?}`；`status` 为 `fillable / pending / rejected` | 否 |
| `submitOrder(ledger, order, quote, context)` | 异步返回 `{ok, status, orderId?, order?, fill?, errors, replayed?}` | 是 |
| `processPendingOrders(ledger, quotes, context)` | 异步返回 `{ok, status:'processed', results, fills}`；逐个重新校验 resting orders | 有实际成交才修改 |
| `cancelOrder(ledger, orderId, context)` | 异步撤销 pending 限价单并释放预留额度 | 是 |
| `setTradingPaused(ledger, boolean, context)` | 异步暂停/恢复新买入，追加审计事件；`context.reason` 可记录操作原因 | 是 |
| `markToMarket(ledger, quotes, context)` | 同步返回估值、质量、错误；无完整可用报价时 `nav:null` | 否 |
| `applyCorporateAction(ledger, action, context)` | 异步执行顺序化 split/dividend 账本动作 | 是 |
| `ledgerInvariantReport(ledger)` | 同步返回 `{valid, errors}` | 否 |
| `verifyAuditChain(ledger)` | 异步返回 `{valid, eventCount, headHash, errors}` | 否 |

预检用于解释结果；真正提交必定重新校验。UI 中的预检成功不代表稍后的提交一定成交。

### 2.1 Context

```js
const context = {
  now: '2026-10-12T14:00:00.000Z', // 服务器提供，必须带时区
  marketOpen: true,              // 交易日历/供应商会话状态提供
  allowDemo: false,              // 服务器配置提供
  quotes: { AAPL: quote },       // 买入时所有已有持仓的最新行情
};
```

引擎不接受时间倒流。带财务状态的历史回放必须从较早账户状态开始按时间顺序处理事件，不能拿今天的持仓去计算昨天的 NAV。日期使用带 `Z` 或显式 UTC offset 的完整 ISO 时间；无时区的本地时间不作为交易时间接受。

### 2.2 Quote

```js
const quote = {
  symbol: 'AAPL',
  price: 100,
  bid: 99.98,                  // 可省略，省略时以 price 作为执行基价
  ask: 100.02,                 // 可省略
  currency: 'USD',
  asOf: '2026-10-12T14:00:00.000Z',
  source: 'provider-name',
  quality: 'realtime',
  sector: 'Technology',
  snapshotId: 'provider:immutable-snapshot-id',
};
```

`asOf` 是该报价所代表的市场时间，不应替换为代理服务器当前抓取时间。持仓行情容器可以是以 symbol 为键的普通对象、Map 或 quote 数组。符号会规范化为大写；行业按大写归组，缺失行业统一归 `UNKNOWN`。已有明确行业与新报价行业冲突时拒绝下单，避免改变标签绕过行业额度。

| 行情质量 | 执行 | 只读估值 |
|---|---|---|
| `realtime` | 满足年龄、时点、会话等校验后可执行 | 可用 |
| `demo` | 只有服务端 `allowDemo:true` 才可执行；永久保留 demo 污染标签 | 同样需要显式允许 |
| `delayed / eod / stale` | 拒绝 | 允许明确标为 indicative 的估值；`fresh:false` |
| `unavailable`、未知值、缺失报价 | 拒绝 | `nav:null` |

未来报价、无来源、非 USD、非正有限价格、bid 高于 ask、公司行动前的旧报价均被拒绝。`realtime` 标签仍需符合默认 90 秒的年龄要求。任何已有持仓没有可执行质量的最新 mark 时，新买入会失败；卖出只要求被卖标的自身的有效报价，以便减少风险。

### 2.3 Order

```js
const result = await submitOrder(ledger, {
  idempotencyKey: 'decision-20261012-001',
  symbol: 'AAPL',
  side: 'buy',
  type: 'limit',
  quantity: 10,
  limitPrice: 100,
  strategyId: 'quality-value',
  decisionId: 'research-001',
  snapshotId: quote.snapshotId,
  decisionAsOf: context.now,
  evidence: [{
    id: 'issuer-report-001',
    source: 'SEC',
    asOf: '2026-10-12T13:00:00.000Z',
    url: 'https://www.sec.gov/',
  }],
}, quote, context);
```

必需字段是 `idempotencyKey / symbol / side / type / quantity`；`limit` 还需 `limitPrice`，market 不允许携带 `limitPrice`。其余示例字段为可选。未知字段被拒绝，避免不支持的委托条件静默失效。evidence 每项必须提供 `id / source / asOf`，可加 URL；最多 100 项。

证据时间表示该信息已经可用的时间。财报期间结束日不能替代披露可用时间。提供 `decisionAsOf` 时，证据不得晚于决策；任何证据和决策也不得晚于执行。引擎验证的是时间与数据形状，证据真实性、来源授权和 AI 是否准确引用仍由上层采集与批判模块负责。

## 3. 成交、持仓、资金与风控

### 3.1 数值与账本

账户仅支持 USD、做多股票/ETF、正数量和完整成交。数量最多八位小数，现金/成交金额/成本/费用统一到小数点后六位 USD；内部现金加减换算成安全整数 micro-units。超出可安全表示范围的数值会被拒绝。最小可记账金额为 0.000001 USD。

这里的六位小数是模拟账本精度，不能被视为真实交易场所的最小价格跳动。若用于精确复现特定经纪商，需要额外供应该经纪商的价格步长、最小数量和舍入规则。

买入现金变化为 `-(成交价 × 数量 + 手续费)`，买入费用计入成本基础。卖出按持仓加权平均成本比例结转成本，净卖出收入减结转成本记入已实现 PnL。全部平仓时结清剩余成本，避免累计舍入留下成本残值。

每笔财务变动写入追加式 `journal`。以下恒等式必须成立：

```text
cash + openCostBasis = initialCash + realizedPnl + dividendIncome
NAV = cash + currentMarketValue
totalPnL = realizedPnL + unrealizedPnL + dividendIncome
```

费用已经包含在已实现或未实现损益中，计算总损益时不能再扣第二遍。现金股息是内部投资收益，绩效计算中不能被标成外部充值。

### 3.2 默认风险配置

| 字段 | 默认值 | 含义 |
|---|---:|---|
| `maxPositionWeight` | 0.25 | 成交/预留后的单一标的最大权重 |
| `maxSectorWeight` | 0.45 | 成交/预留后的行业最大权重 |
| `maxGrossWeight` | 0.95 | 成交/预留后的总多头最大权重 |
| `maxQuoteAgeMs` | 90,000 | 可执行行情最大年龄 |
| `feeBps` | 1 | 每边成交额费用；1 bps = 0.01% |
| `slippageBps` | 5 | 买入上浮、卖出下浮的模拟滑点 |

买入使用 ask（缺失时 price），卖出使用 bid（缺失时 price），再应用不利方向的滑点。费用随后按成交额计算。无现金借贷、卖空、保证金或杠杆入口。

现金可用额扣除 pending 买单的最高可能成交额与费用；可卖数量扣除 pending 卖单预留数量。风控也计入 pending 买单的敞口和费用，pending 卖单在实际成交前不减少风险敞口。持仓使用最新标记价值；实际成交价相对标记价的差异及费用反映进预计 NAV 分母。

最大仓位按费用后的预计 NAV 判断，所以“用初始资产的恰好 25% 下单”可能略微越界。调用端应使用 `evaluateOrder` 的具体拒绝原因调整数量。

### 3.3 限价模型

限价单仅当**包含滑点后的执行价**仍满足限价时才成交；买价不得高于 limit，卖价不得低于 limit。基价触及限价但费用前执行价因滑点越界时，订单继续 resting。引擎不会裁掉滑点来制造成交，也不会以越过 limit 的价格成交。

pending 按提交顺序处理，每次成交前重新验证最新行情、现金、股份、风险与暂停状态。某笔未通过重验会继续 pending，并在 `results` 中给出原因；调用方可选择撤单。新报价必须晚于最初提交报价，且不能早于订单创建时间，以免用之后获取的旧行情回填成交。

成交模型假定每笔可执行委托可以完整成交。订单簿深度、成交队列、部分成交、停牌恢复撮合、竞价和订单有效期尚未建模；因此结果适合比较模拟策略，不宜宣称复现了真实可成交业绩。不会自动把最近 K 线高低点解释成已经发生的限价成交。

### 3.4 Kill switch

`setTradingPaused(ledger, true, context)` 阻止所有新买入及 pending 买单成交。有效卖出、撤单和公司行动仍可执行。暂停不会静默清空 existing pending；恢复前应按策略决定是否撤销旧决策。

## 4. 幂等、溯源与审计

有效订单键接受 1–128 位字母、数字、点、下划线、冒号与连字符，首位必须为字母或数字。订单幂等与公司行动幂等各有独立命名空间。推荐使用稳定的事件 ID，不要为一次网络重试重新生成键。

同键、相同规范化订单 payload 返回首次提交结果并标记 `replayed:true`，不重新成交、不追加审计。报价和 context 不属于订单 payload，因此网络重试即使面对另一份行情仍回放原结果。同键改变订单数量、方向、价格、证据或其他已支持字段，返回 `IDEMPOTENCY_CONFLICT`。格式无效、时间倒流等未能构成可信事件的请求不会写入财务审计；正常业务拒单会保存首次结果。

限价单首次响应如果是 pending，后来即使已经成交，重复提交仍回放最初 pending 响应。查询 `ledger.orders` 才是当前订单状态。这个行为使网络重试的返回值保持稳定，避免把重试误认为新订单。

每个接受的订单保存提交 quote、asOf、source、quality、evidence 与 SHA-256 `snapshotHash`；fill 另存实际成交 quote 和相应 hash。两者可能不同，因为限价等待期间市场已经变化。异步写入口提前复制请求、报价与 context，避免哈希期间外部对象变化造成验证与记账输入不一致。

审计事件包含序号、时间、事件类型、payload、前一事件 hash 及当前账户完整 `stateHash`。哈希采用递归排序键的规范 JSON 与 WebCrypto SHA-256。`verifyAuditChain` 检查事件链、时间顺序、最终账户状态与会计恒等式；它会发现篡改事件、删除中间事件或绕过写接口修改余额。

哈希链是完整性证据，**本身没有外部身份签名**。拥有整个存储写权限的人仍可能重写全部历史并重新计算哈希。需要更强审计时，应把周期性的 headHash 锚定到独立存储或日志。也不能直接裁切 audit/orders/journal 或改变旧 risk 参数；应以明确的迁移与锚定检查点设计归档流程。

## 5. 拆股与现金股息

```js
await applyCorporateAction(ledger, {
  idempotencyKey: 'AAPL:split:2026-10-13:2-for-1',
  symbol: 'AAPL',
  type: 'split',
  ratio: 2,
  effectiveAt: '2026-10-13T13:30:00.000Z',
  source: 'issuer-or-authoritative-provider',
}, context);

await applyCorporateAction(ledger, {
  idempotencyKey: 'AAPL:dividend:2026-10-14',
  symbol: 'AAPL',
  type: 'dividend',
  amountPerShare: 0.25,
  effectiveAt: '2026-10-14T13:30:00.000Z',
  source: 'issuer-or-authoritative-provider',
}, context);
```

`effectiveAt` 必须已经到达，且不得早于 ledger 的最后一次事件。调用方必须按时间顺序在该时点记账。错过公司行动后不能拿当前持仓冒充过去的有权股数，需要从公司行动前的状态回放。

拆股按比例改变数量与平均成本，总成本和现金保持不变。超出八位小数的零碎股精度会拒绝，要求另行明确现金替代规则。动作还会撤销该标的所有旧 pending 单，释放预留并记下原因，以免旧限价/数量在新的股本基础上继续执行。

现金股息采用**除息时模拟确认并入现金**的简化会计约定：按动作前实际持仓数量乘每股金额计入现金和 dividendIncome。它不模拟真实支付日、应收股息期间、税款预扣、DRIP 或实际到账。任何需要真实 pay-date 对账的场景必须另外实现应收与结算事件。

拆股/股息之后，动作前 quote 不再可用于该持仓估值或成交，必须提供股本/价格基础已经更新的 quote。例：10 股 × 100 USD 经 2:1 拆股后为 20 股 × 50 USD，NAV 不变；10 股支付每股 2 USD 且价格从 100 除息至 98，现金加 20、持仓价值减 20，NAV 不变。没有新报价时返回不可估值，不能直接用旧价乘新股数或把股息当作凭空增加的回报。

仅凭时间戳不能证明供应商已正确复权。价格采集层必须提供与公司行动相容的报价，并避免把已经复权的历史价格再次手工拆股。

## 6. 绩效模块

| 导出 | 返回 |
|---|---|
| `buildPortfolioCurve(snapshots, options)` | 按时间排序的 NAV、区间回报、累计回报、增长指数、回撤序列 |
| `calculatePerformance(snapshots, options)` | 原始收益、资金变化、最大回撤、足够样本时的年化/Sharpe、缺失原因、完整 curve |
| `compareWithBenchmark(portfolio, benchmark, options)` | 共同日期区间、双方从 100 开始的指数、同窗累计收益差、足够且连续日频下的 tracking error/information ratio |
| `computeMetrics` / `equityCurve` | 前两项的可读别名 |

输入快照为 `{asOf 或 date, nav, externalFlow?, containsDemoData?}`；benchmark 也可用 `close` 或 `value` 代替 nav。日期只用于分析时允许 `YYYY-MM-DD`。提供 `options.asOf` 会拒绝报告时点之后的样本。

非正或缺失 NAV、无效日期、同一 timestamp 的冲突数据会抛出明确异常。完全相同的重复样本只算一次，输入按时间排序。图表需要缺失间隔时应由 UI 保留 gap，不应给引擎填零 NAV。

区间外部资金流按区间结束时发生处理：`r = (currentNAV - externalFlow) / previousNAV - 1`。增长指数按区间收益链接；回撤按增长指数相对既有峰值计算，因此外部充值不会伪造成投资回报或遮蔽回撤。日内资金流和精确的资金加权收益需要更细时点数据，当前模块不把该简化结果冒称 IRR。

`totalReturn / maxDrawdown / annualizedReturn / annualizedVolatility / excessReturn` 等字段为小数比例；`*Pct` 为百分数。`maxDrawdown` 为正的损失幅度，curve 中 `drawdown` 为负值。Sharpe 和 information ratio 是无量纲比值。

默认至少 365 个日历日且 252 个不同日期样本才给出年化复合回报；不足时 `annualizedReturn:null`。Sharpe 还需要：

1. 调用方明确 `dailyCloseSeries:true`，证明输入是日收盘序列；
2. 至少 60 个日收益观测；
3. 连续交易日，且收益标准差不为零。

千次日内轮询仍只构成一个日度样本。未提供交易日历时，模块只接受周一至周五连续序列，未解释的缺失工作日会禁用日频 Sharpe。对于真实节假日，应传入 `options.tradingDates`，该数组必须来自交易所日历，不能把现有稀疏数据的日期简单当成完整日历来掩盖缺失。

年化采用默认 252 个交易期/年；复合年化回报按真实经过日数和 365.25 日/年计算。`riskFreeRate` 默认为 0，为年率，计算日频超额收益时先转为期率。零波动率不返回 Infinity，而是 `sharpe:null` 和原因。

共同日期 benchmark 比较绝不前向填充缺失数据。双方都从第一个共同日期开始归一化到 100，并在完全相同的共同结束日比较。期间发生在非共同日期上的外部资金流先在完整投资组合曲线中中和，之后再对齐，避免遗漏充值造成相对收益错误。

benchmark 默认 `benchmarkType:'price'`，返回 `PRICE_BENCHMARK_EXCLUDES_DIVIDENDS` 提醒价格指数缺少分红；只有已经具有总回报含义的输入才设为 `'total-return'`。不能把价格 benchmark 与包含股息的组合之差称为纯 alpha。

## 7. 已执行的针对性验证

```bash
node --test tests/paper-engine.test.mjs tests/metrics.test.mjs
```

测试覆盖现金/成本/收益恒等式、部分及全部卖出、滑点/费用、全部行情质量拒绝分支、时间倒流、未来证据、缺失持仓 mark、仓位/行业/总敞口、现金和股份预留、限价边界、pending 重新风控、取消、kill switch、同键回放及冲突、异步输入快照、拆股/股息后的 NAV、公司行动幂等、审计篡改、同实例并发、短样本抑制、日内样本去重、交易日缺失、现金流中和、benchmark 共同日期与资金流对齐。

这些测试验证模拟引擎的具体会计与时序约定；真实供应商资质、真实市场会话、服务端账户隔离和跨实例数据库竞争必须由相应集成测试验证。
