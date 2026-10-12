# Arena FSI HTTP API

本文对应交付包的 `api/arena-fsi.mjs`、`server/http.mjs`、`server/service.mjs` 及配套本地/部署脚本。它描述当前工程契约，不代表付费行情、模型账户或线上部署已通过实网验证。研究计算的完整字段见 `research-contract.md`；模拟订单、账本和公司行动的细节见 `engine-contract.md`。

## 1. 入口、模式与基本约定

统一入口：

```text
/api/arena-fsi?route=<操作名>
```

`route` 省略时为 `status`。路由名称区分大小写；未声明的 route/method 组合返回方法错误。静态浏览器界面通过本站 API 访问服务，不直接持有市场数据商或模型供应商密钥。

GET 的模式通过 `?mode=demo` 或 `?mode=live` 指定；POST 通过 JSON 的 `mode` 字段指定。省略 mode 时采用服务端 `ARENA_MODE`；`route=demo` 始终强制 demo。服务端配置默认偏向 live，本地启动脚本和 `.env.example` 则显式采用 demo；客户端应总是发送当前选定 mode，避免环境切换带来歧义。

| 约定 | 实际行为 |
| --- | --- |
| POST 请求体 | 必须为 JSON object；不能是数组、字符串或 null。 |
| Content-Type | `application/json`，允许 `; charset=utf-8`。 |
| 请求体上限 | 150,000 bytes；既检查声明长度，也检查实际读取字节。 |
| 返回格式 | JSON；多数成功响应直接返回业务对象，没有统一的 `{data:...}` 外壳。 |
| 缓存 | API handler 返回 `Cache-Control:no-store`。 |
| 请求追踪 | 正常 handler 响应带 `X-Request-ID`；错误 JSON 也包含 requestId。初始化阶段 503 可能尚未进入该 handler。 |
| 时间 | 服务端时钟控制决策/执行/导入时点；市场报价的 asOf 保留供应商市场时间。客户端不能通过传入 now 改变执行时间。 |
| 数值 | JSON numbers；不要发送数字字符串、NaN、Infinity。 |
| 成交范围 | USD、做多股票/ETF的纸上交易；sell 表示减少已有持仓，无真实券商下单、保证金或卖空入口。 |

## 2. 鉴权与公开读取

全部普通 POST 使用：

```http
Authorization: Bearer <ARENA_ADMIN_TOKEN>
Content-Type: application/json
```

`ARENA_ADMIN_TOKEN` 至少 24 个字符，完整 Bearer header 必须匹配；此 API 不使用 cookie 会话。浏览器请求如果携带 `Origin`，普通 POST 要求该 Origin 与实际服务 Origin 一致。不提供跨域 CORS 写入入口。命令行工具通常不发送 Origin，但仍需有效 Bearer token。

`route=cron` 使用单独的 `CRON_SECRET`，同样至少 24 字符：

```http
Authorization: Bearer <CRON_SECRET>
```

公开 GET 不要求管理员 token，但 live 数据是否展示受 `ARENA_PUBLIC_QUOTES=true` 控制：

- demo 的明确合成数据可公开读取。
- live `status` 在未开启公开展示且请求未通过管理员鉴权时，移除报价、仓位明细、成交、pending 订单、研究材料和运行推理详情；仍可返回系统能力和部分账户汇总/运行元数据。该开关不是“隐藏全部模拟账户信息”的隐私模式。
- live `history` 在没有管理员权限且未开启公开展示时返回 `PUBLIC_DATA_DISABLED`。
- 公开 status 读取可触发节流后的行情缓存刷新；它不会匹配订单或启动 AI。管理员 `refresh` 与 cron 的行为不同，见下文。

只有确认行情展示权后才开启 `ARENA_PUBLIC_QUOTES`。管理员身份不代替供应商订阅或数据许可。连接器列表中的 URL、`requiresEntitlement` 和 `not_connected` 只表示接入能力声明，不能视为成功认证。

## 3. 路由总表

| 方法 | route | 参数/请求体 | 鉴权 | 返回与主要副作用 |
| --- | --- | --- | --- | --- |
| GET | `status`，或省略 | query `mode?` | 公开；token 可解锁受限详情 | 当前模式、capabilities、snapshot、portfolios、runs、feedback、research、connectors、audit、lastError；live 可刷新只读行情缓存。 |
| GET | `demo` | 无必需字段 | 公开 | 明确 demo 的 status；不会读取 live 账户。 |
| GET | `history` | query `symbol`、`mode?` | demo公开；live须公开展示开关或admin | `{symbol,bars,asOf,source,quality,...}`；只读历史 K 线，可写行情缓存，不成交。 |
| GET | `health` | 无 | 公开 | 版本、模式、存储/数据库和公开上线准备状态；不把“进程能响应”当作行情/模型已实测成功。 |
| POST | `refresh` | `{mode?}` | admin | 拉取快照、重新评估 pending 限价单、记录可用 NAV，返回管理员可见 status。可能产生纸上成交。 |
| POST | `run` | `{mode?,idempotencyKey,profiles?}` | admin | 冻结研究上下文，执行 analyst/critic，独立刷新执行行情，风控/纸上成交并记录 forecast；返回 run。 |
| POST | `order` | `{mode?,ledgerId?,order}` | admin | 提交手动纸上订单；返回引擎结果。 |
| POST | `pause` | `{mode?,ledgerId,paused}` | admin | 暂停/恢复该账户的新买入及 pending 买单执行；有效卖出与撤单仍可用。 |
| POST | `cancel` | `{mode?,ledgerId,orderId}` | admin | 撤销 pending 限价单、释放预留额；返回引擎结果。 |
| POST | `research` | `{mode?,kind,input}`；计算发布另需 `visibility,symbol,sourceIds` | admin | 财务计算、证据导入、研究验证或发布晨间摘要；返回 `{result,mode,asOf,artifact?}`。 |
| POST | `thesis` | create/update，详见第 8 节 | admin | 创建或追加论点修订；返回 `{result}`。 |
| POST | `catalyst` | create/resolve，详见第 9 节 | admin | 创建事件或记录到期结果；返回 `{result}`。 |
| POST | `feedback` | `{mode?}` | admin | 先刷新行情并处理 pending，再结算到期 forecast、计算校准；返回 `{settled,feedback,changesApplied:false}`。 |
| POST | `corporate-action` | `{mode?,action}` | admin | 将同一权威拆股/股息事件原子应用到当前模式 S/P/T 全部账户，并使跨事件预测失效；任何账户拒绝则整批回滚。 |
| POST | `export` | `{mode?}` | admin | 返回完整模式状态、SHA-256 和各账本验证结果；不会自动清空/删除历史。 |
| GET | `cron` | 无客户端模式覆盖；使用服务配置 mode | CRON_SECRET | 刷新、pending 处理、forecast结算；启用 autorun 且市场开放时可按时段幂等触发 AI run。 |

`OPTIONS`、`PUT`、`PATCH`、`DELETE`、把普通写操作当 GET 调用等均不属于当前契约。

## 4. Status、历史行情与 health

### Status 的主要结构

```js
{
  schemaVersion: 1,
  mode: 'demo' | 'live',
  serverTime: '<server ISO time>',
  capabilities: { market, ai, storage, legacy, adminConfigured, autorun },
  snapshot: { id, asOf, receivedAt, mode, quotes, marketOpen, calendarStatus, /* ... */ },
  portfolios: [{ id, label, provider, model, paused, valuation, metrics, benchmark,
                 pendingOrders, fills }],
  runs: [/* recent runs, newest first; redacted for unprivileged live reads */],
  feedback: { /* cohort calibration and exclusions */ unresolved, expired, invalidated,
              changesApplied: false },
  research: { theses, catalysts, brief, evidence, artifacts },
  connectors: [/* declared provider capabilities/status */],
  audit: { events, headHash },
  lastError: null | { code, message }
}
```

账户/profile ID 为 `S`、`P`、`T`。具体 provider/model 来自服务端配置；demo 返回 `deterministic-demo` / `demo-rules-v1`。未配置模型时显示未配置，不填一个猜测的最新模型名称。

Quote 的 `quality` 可能是 `realtime`、`demo`、`delayed`、`eod`、`stale` 或 `unavailable`。`changePct` 在 **market/status 原始行情中是百分数**，例如 `1.2` 代表 1.2%；研究 brief 内部已转换成小数比例 `0.012`。`price` 是 USD/share；不可用价格为 null。UI 应显示其实际 source/feed/时点，不能因服务器刚刷新就把旧市场时间改成实时。

IEX 表示单一交易所覆盖；SIP 表示需相应 entitlement 的综合行情；delayed SIP 明确延迟并禁止成交。EOD K 线只用于图表，不是可成交报价。live 历史请求使用已完成日期的数据、声明供应商 adjustment 策略；如果供应商返回需翻页的未完整序列，服务拒绝把截断部分冒充完整历史。

### Health 与准备状态

`health` 供诊断和分阶段部署探测使用，成功响应包括：

```js
{
  ok: true,
  version: '1.0.0',
  mode: 'demo' | 'live',
  persistent: true | false,
  databaseReachable: true,
  configured: { admin, market, ai, publicDisplay },
  readyForPublicArena: true | false
}
```

上线准备状态 `readyForPublicArena` 要同时满足 live 模式、持久化数据库可达、管理员 token 配置、行情配置、三个模型配置，以及公开展示开关。持久化适配器的可达检查会实际读取应用表，不能仅凭存在 `DATABASE_URL` 判断；读取失败返回 `DATABASE_UNAVAILABLE`/503。没有生产数据库的诊断适配器可以响应，但 `persistent:false` 且准备状态为 false，不能凭 `ok` 或 `databaseReachable` 单个字段批准上线。

即使准备状态为 true，也不表示刚刚调用并验证了所有模型/商业源、行情内容许可或某笔真实订单。运行后的 quote quality、实际模型响应、账本结果仍有各自验证。发布脚本应检查准备状态和该版本的验收结果，再推广已暂存部署；本文不宣称已经上线。

## 5. 手动纸上订单、暂停与撤销

示例均使用 demo，价格/数量仅用于接口演示：

```json
{
  "mode": "demo",
  "ledgerId": "S",
  "order": {
    "idempotencyKey": "manual-demo-20261012-001",
    "symbol": "AAPL",
    "side": "buy",
    "type": "limit",
    "quantity": 2,
    "limitPrice": 199.5,
    "snapshotId": "replace-with-current-demo-snapshot-id"
  }
}
```

订单必填 `idempotencyKey`、`symbol`、`side:buy|sell`、`type:market|limit`、`quantity`。`limit` 需 `limitPrice`；`market` 禁止 `limitPrice`。`ledgerId` 省略时为 `S`；建议显式填写。

`snapshotId` 可省略；提供时必须仍为当前模式快照，否则 `SNAPSHOT_CHANGED`/409。服务端总是以自己的当前快照、时钟、市场会话、质量和风控配置执行，不能从 body 指定行情价格、完整 ledger、`marketOpen`、`allowDemo` 或风险上限。手动订单的 strategyId 由服务标记为 `manual-paper-v1`。

服务层订单/run幂等键限制为 8–128 字符，使用字母、数字、下划线、点、冒号或连字符；为兼容底层及派生订单 ID，建议以字母/数字开头。网络重试使用原键和原 payload。相同 key、不同订单输入返回 `IDEMPOTENCY_CONFLICT`/409；相同输入回放首次结果，包含 `replayed:true`，不会再次成交。

引擎成功接收请求后可能返回：

```js
{
  ok: true | false,
  status: 'filled' | 'pending' | 'rejected' | /* other engine operation status */,
  orderId: '...',
  order: { /* current result payload */ },
  fill: { /* only when a fill occurred */ },
  errors: [/* concrete business rejection reasons */],
  replayed: true // only on replay
}
```

**HTTP 200 不等于已成交。**额度、行情、交易时段等业务拒单可以通过 `ok:false`、`status:'rejected'` 和 `errors` 返回。pending 限价单等待之后的新快照重新校验；同键回放可能仍是首次 pending 响应，应通过 status 中的当前订单/成交记录或 export 查询最终状态。

暂停与撤单请求：

```json
{"mode":"demo","ledgerId":"S","paused":true}
```

```json
{"mode":"demo","ledgerId":"S","orderId":"replace-with-pending-order-id"}
```

分别发到 `route=pause` 与 `route=cancel`。暂停是买入 kill switch，不会自动删除旧 pending，也不会禁止有效风险减仓。

## 6. AI Run 与预测语义

请求：

```json
{"mode":"demo","idempotencyKey":"research-demo-run-001","profiles":["S","P","T"]}
```

`profiles` 可省略，默认为三个账户；指定时需为 1–3 个不重复的有效 ID。服务端先刷新行情，再冻结上下文与 context hash，并保留该轮 snapshotId；analyst 与 critic 只得到这份输入。模型不能自行浏览、调用工具、改变风控或写账户。研究完成后再次拉取独立执行快照，风险/撮合在服务端运行。

Run 返回包括 `id`、`mode`、`createdAt`、`status`、`snapshotId`、`executionSnapshotId`、`version`、`profiles`、`frozen`、`results`、`decisionAt`、`completedAt`。每个 result 记录 profile、context hash、模型/provider、用量、analyst intent、critic、风险与 fill 阶段。某个模型失败或被 critic 拒绝，会记录 held/error，不会用另一模型或静态买入掩盖失败。整体 run 完成不意味着每个账户都成交。

`run.frozen` 保留该轮公共 snapshot、evidence、research 以及每个 profile 的 portfolio 输入和 contextHash。截止点前已公开发布的最近 3 件计算 artifact 会进入 research 上下文，并明确标为基于管理员输入假设的确定性计算。之后导入新来源、修改论点或发布新估值不会重写旧 run 的冻结输入。完整导出可逐 profile 重新核对冻结内容的 hash。

同一模式只允许有效 writer lease 控制的活动 run。并发冲突可返回 `RUN_IN_PROGRESS`；过期 lease 不允许陈旧推理结果继续提交。每日研究预算由 `ARENA_MAX_RUNS_PER_DAY` 控制，并按服务端 UTC 日期计数。AI失败也可能已经占用研究次数；同幂等键重试已保存的 run不会重新生成一轮。

### 预测概率的准确口径

当前 run 的 AI intent 字段保留名称 **`confidence`**，其明确定义是：

**`P(该标的在 horizonHours 后的价格回报 > 0)`**。

它与 `action:buy|sell|hold` 无关，也不是“这笔买/卖建议有多少把握”。卖出意图可以合理地有较低上涨概率。服务将它保存为 forecast 的 `probability`。数量是股数，不是金额。

注意：`research kind=validate` 的研究文档中同名 `decision.confidence` 是独立的研究动作信心字段；该文档不会自动变成 run 的 forecast。不要把其值导入概率校准样本。

当前可核实的结算公式为 `exitPrice / entryPrice - 1`，大于零时 outcome=1，否则为0。它是**价格回报**，不应被宣称为含分红总回报或无成本真实收益。拆股/股息会改变该简单价格比较的含义；需要及时导入权威公司行动，跨越相关事件的预测应标为失效并排除评分，而非继续给出错误命中率。系统不宣称已经自动获得完整、已核实的公司行动数据源。

## 7. Research：计算、证据与验证

统一请求：

```json
{"mode":"demo","kind":"<研究操作>","input":{}}
```

统一响应：

```js
{ result: /* function result */, mode: 'demo' | 'live', asOf: '<server time>',
  artifact: /* optional; only when explicitly publishing a calculation */ }
```

| kind | input 结构 | 是否持久化 |
| --- | --- | --- |
| `wacc` | 市场 equity/gross debt、税率、债务成本、显式 equity cost 或 CAPM 输入 | 默认只返回；可显式发布 artifact |
| `dcf` | 明确货币/单位/FCFF、bear/base/bull、WACC/g、净债桥接、稀释股数 | 默认只返回；可显式发布 artifact |
| `comps` | peer 数组，或 `{peers:[...]}` | 默认只返回；可显式发布 artifact |
| `earnings` | `{actual,consensus,prior,directions?}` | 默认只返回；可显式发布 artifact |
| `evidence` | `{visibility:'public',sources:[...]}` | 验证成功后写入当前 mode 的公开研究来源，追加导入事件 |
| `validate` | 带 sources/facts/assumptions/inferences 的完整研究文档 | 返回结构/时点验证结果；不下单 |
| `brief` | 可选额外摘要内容；状态/来源/论点/事件由服务选定 | 用服务当前快照和已存研究组装 brief，保存并追加审计事件 |

金融函数完整字段以 `research-contract.md` 为准。例如 DCF 的金额可显式采用 millions，股份仍是实际股数；净债模式和 debt/cash 模式不能混用。Comps 禁止混币种、TTM/NTM或会计口径。计算 API 的外层 asOf 是服务该次操作的截止时间，不可仅凭该外层时间把历史输入标成最新市场事实。

### 计算结果发布到研究上下文

`dcf`、`wacc`、`comps`、`earnings` 默认只计算并返回。需要将输入/结果保存为当前 mode 的公开研究 artifact 时，在 **请求 body 顶层**显式加入 `visibility:'public'`、watchlist 中的 `symbol`，以及 1–20 个已导入公开来源 ID 的 `sourceIds`。这与 evidence 导入的 `input.visibility` 位置不同。

以下 WACC 数值全部为**合成假设**；先导入下节 demo 来源，再调用：

```json
{
  "mode": "demo",
  "kind": "wacc",
  "visibility": "public",
  "symbol": "AAPL",
  "sourceIds": ["synthetic-public-results-001"],
  "input": {
    "marketEquity": 1000,
    "marketDebt": 200,
    "costOfEquity": 0.10,
    "preTaxCostOfDebt": 0.05,
    "taxRate": 0.25
  }
}
```

成功响应增加 artifact，包括 `id`、`kind`、`symbol`、`availableAt`、`visibility`、`inputOrigin:'administrator-supplied assumptions'`、原 input、sourceIds 及 result。`status.research.artifacts` 返回当前允许公开查看的集合；下一次 run 使用截止点前最近 3 件。来源引用存在不代表管理员所有假设已被该来源证实，也不会把计算输出自动登记为财报事实。

artifact ID 由 kind、symbol、input 与 sourceIds 的确定性 hash 生成，相同内容不重复存储；修订假设产生新 artifact，历史保留。当前集合最多 50 件，达到上限返回 `ARTIFACT_CAPACITY`。未找到引用来源返回 `UNKNOWN_EVIDENCE`，缺少有效 sourceIds 返回 `MISSING_EVIDENCE`。发布不会启动 AI 或提交订单。

### 公开 evidence 导入结构

以下是**合成演示**请求，只能用于 `mode=demo`。`example.invalid` 不是真实金融来源；此操作不会抓取该 URL：

```json
{
  "mode": "demo",
  "kind": "evidence",
  "input": {
    "visibility": "public",
    "sources": [
      {
        "id": "synthetic-public-results-001",
        "kind": "filing",
        "type": "company_results",
        "title": "SYNTHETIC: Fictional results used only to demonstrate ingestion",
        "url": "https://example.invalid/arena/synthetic-results",
        "symbol": "AAPL",
        "publishedAt": "2025-01-14T20:00:00Z",
        "availableAt": "2025-01-14T20:01:00Z",
        "retrievedAt": "2025-01-15T12:00:00Z",
        "synthetic": true,
        "summary": "SYNTHETIC: This is not Apple financial information.",
        "fact": {
          "metric": "demonstration_revenue",
          "value": 1000,
          "currency": "USD",
          "unit": "million",
          "period": "fictional-period"
        }
      }
    ]
  }
}
```

必填来源字段是 `id`、`kind`、`title`、`publishedAt`、`availableAt`，以及除 user 来源以外的 HTTP(S) URL。允许 kind：filing、market_data、news、transcript、user、dataset、research_report。source ID 必须在本次导入与当前模式存储中都唯一。

时点必须满足 `publishedAt <= availableAt <= server now`；若提供 retrievedAt，它不能早于 availability；若提供 versionAt，须明确该内容版本何时已可得。财报期末不是披露时点，不能用来伪装资料提前可见。服务保存 `receivedAt=导入服务器时间`，并强制来源 visibility 为 public。

`summary`、`fact`、symbol 和其它补充证据内容会跟随来源保存，并可能进入 AI 的冻结上下文；它们不是执行指令。**此导入验证的是结构与声明的时间，不能证明财报真伪、数值提取正确或您拥有数据再分发权。**正式 live 导入必须使用核实后的真实公开资料，保留授权范围与确切 vintage。研究事实的逐数字 sourceIds/units 校验应另外通过 `kind=validate`。

private evidence 不属于此公开模拟系统导入契约，`visibility` 必须显式为 `public`；不要上传客户非公开资料。当前来源集合有容量限制，达到后返回 `EVIDENCE_CAPACITY`，不会静默覆盖已有来源。此 API 没有删除/更新来源的便捷路由；更正应使用新版本 source ID、保留历史并显式更新依赖研究。

### Research validate 与 brief

`kind=validate` 使用服务端当前时点验证来源和 snapshot；失败通常返回 HTTP 200 下的 `result.valid:false` 和 `result.errors`，便于展示逐项反馈。HTTP 调用建议省略 input.snapshotAt，让服务端决定验证截止点；若显式提供，该字段必须与服务本次截止点完全相等，否则返回 `SNAPSHOT_MISMATCH` 验证错误。固定历史截止点的可复算验证应调用研究模块的显式 asOf 契约。`kind=evidence` 则要求验证通过才写入，失败返回 `INVALID_EVIDENCE`，不会部分导入。

brief 使用自动行情证据与已导入公开来源、当前论点/催化剂。浏览器不能通过 input 把服务选定的行情、mode、快照时间或研究存储替换成另一套来源。它不会替用户生成不存在的财报、共识或新闻。

## 8. Thesis：创建与追加修订

创建请求：

```json
{
  "mode": "demo",
  "operation": "create",
  "thesis": {
    "id": "demo-thesis-aapl-001",
    "symbol": "AAPL",
    "statement": "SYNTHETIC: An example of a falsifiable research thesis.",
    "pillars": [
      {
        "id": "growth",
        "expectation": "SYNTHETIC: Growth exceeds the scenario threshold.",
        "invalidation": "SYNTHETIC: Two observations below the threshold."
      }
    ],
    "risks": ["SYNTHETIC: The scenario may fail."],
    "stopTrigger": "SYNTHETIC: Review when the pillar is disproved.",
    "conviction": "medium"
  }
}
```

symbol 必须在服务配置的 watchlist。服务将创建时间定为实际 now；不能通过 body 创建一份虚假的历史论点。`thesis` 可使用 `input` 作为兼容入口，建议采用示例的明确字段。

追加 evidence 修订：

```json
{
  "mode": "demo",
  "operation": "update",
  "id": "demo-thesis-aapl-001",
  "update": {
    "id": "demo-thesis-event-001",
    "type": "evidence",
    "description": "SYNTHETIC: Newly imported demonstration data weakens the pillar.",
    "pillarId": "growth",
    "impact": "weakens",
    "sourceIds": ["synthetic-public-results-001"]
  }
}
```

update 未给 at 时用服务器 now；给出时仍必须满足时间顺序且不得超出现在。所有引用 sourceIds 必须已在当前 mode 的 `state.evidence` 中导入。每轮临时 quote evidence ID 不自动成为该持久研究集合的来源。

支持 evidence、review、transition 事件；后两者与 active/challenged/invalidated/closed 的合法转换详见研究契约。重复事件 ID 返回 `DUPLICATE_THESIS_EVENT`，不会再次应用；closed 论点不可重新编辑。接口没有直接覆盖 revision/history 的入口。创建和更新均返回 `{result:<完整当前论点>}`。

## 9. Catalyst：时间明确的事件与结果

创建：

```json
{
  "mode": "demo",
  "operation": "create",
  "event": {
    "id": "demo-event-001",
    "symbol": "AAPL",
    "title": "SYNTHETIC: A future demonstration event",
    "expectedAt": "2030-01-15T21:00:00Z",
    "timezone": "America/New_York",
    "sourceIds": ["synthetic-public-results-001"]
  }
}
```

expectedAt 必须是请求时尚未发生的有效时点；示例远期日期仅用于演示，应替换为实际核实事件。symbol 必须在 watchlist，建议发送规范大写。title 长度 3–300 字符；sourceIds 必须非空且已导入。id 可省略，由服务根据事件字段生成稳定 hash。timezone 是显示/来源上下文，expectedAt 的显式 UTC offset 才决定实际比较时点。

到期后记录结果：

```json
{"mode":"demo","operation":"resolve","id":"demo-event-001","outcome":"SYNTHETIC: Demonstration outcome after the expected event time."}
```

只有 scheduled 且 expectedAt 已到的事件可 resolve。结果文字需 3–2000 字符。服务写入 confirmedAt 和 resolved 状态，不允许通过 outcome 回填一个尚未发生的结果。返回 `{result:<事件>}`。

## 10. Forecast feedback、cron 与公司行动

`POST route=feedback` 不是纯只读统计：它先执行 refresh，因此可能匹配已有 pending 订单，然后结算到期预测。只有 horizon 已到、报价可用且市场报价时间不早于 horizon 的 forecast 才有可评分 outcome；超过允许的窄结算窗口会过期，不把任意晚来的价格替代目标时点。

当前服务采用 **最多迟到 5 分钟** 的结算窗口。每小时 horizon 到了却几天后才按按钮，不能得到合法命中率。应配置可靠的周期结算；假日、闭市、源故障导致缺少可用报价时，允许样本过期，不能伪造一个结果。

概率校准按 profile、model/strategyVersion、mode、报价 quality 与 horizon cohort 分组。服务 cohort 的含义为 `<mode>:positive-price-return:<quality>:<horizonHours>h`，不把 demo、不同数据质量或不同时域混算。未结算、未来、过期或公司行动失效记录不增加有效样本数。默认未达最低样本数显示 insufficient；不同 cohort 不混在一个 headline score 中。反馈只计算评分/提出未来版本实验，不修改 live 权重或模型参数。

status 的 `feedback.unresolved` 仅计尚未结算、未过期且未因公司行动失效的记录；`expired` 与 `invalidated` 分别计数。失效记录保留在 export 中，但进入校准前被过滤；因此不要预期每个失效记录都另有 calibration exclusion 条目。

### Cron

`GET route=cron` 使用 CRON_SECRET，按 `ARENA_MODE` 执行 refresh、settle。`ARENA_AUTORUN=false` 时不启动新 AI run，但已有 pending 限价单仍可因刷新而被重新评估。开启 autorun 后，只在权威市场状态开放时运行，并使用稳定时段键防止同一周期重复建仓，仍受每日研究预算限制。

`config/vercel-cron.example.json` 是示例配置，不是自动安装好的远端定时任务。部署者需按所在计划允许的频率配置调度，并验证 cron 请求成功、密钥正确、结算窗口和市场会话相容。不要把缺少实际调度的 demo 成功当成 unattended live 运行证明。

### 拆股与股息

公司行动是当前 mode 的全局市场事件，请求 envelope 为 `{mode,action}`。一次提交会对 S/P/T **全部账户**应用同一 action；即使附带旧客户端的 ledgerId 字段，也不会将动作限制在该账户。例如：

```json
{
  "mode": "demo",
  "action": {
    "idempotencyKey": "demo-split-event-001",
    "symbol": "AAPL",
    "type": "split",
    "ratio": 2,
    "effectiveAt": "2026-10-12T13:30:00.000Z",
    "source": "SYNTHETIC: Demonstration only; replace with a verified issuer/provider in live mode"
  }
}
```

股息使用 `type:'dividend'` 与 `amountPerShare` 代替 ratio。effectiveAt 必须已到且满足每个账本的严格时间顺序；上述固定日期不保证在任意当前账户上有效。若已错过事件，不能拿今天的股数冒充当时 entitlement，应从事件前快照按顺序回放。

服务在单次状态事务中应用全部账户。任意账户拒绝会返回 `CORPORATE_ACTION_REJECTED`/409，并回滚整批状态；不会留下两个账户已拆股、第三个未拆股的部分成功。成功响应为：

```js
{
  ok: true,
  status: 'applied',
  symbol: 'AAPL',
  effectiveAt: '<effective ISO time>',
  results: { S: {/* engine result */}, P: {/* engine result */}, T: {/* engine result */} }
}
```

重试必须保留相同 action 的 idempotencyKey 和字段，各账户引擎结果会标示是否回放。不要为同一个事件生成新 key 以绕过先前拒绝或已应用状态。

拆股改变股数与成本、取消受影响旧 pending；股息按引擎声明的简化确认时点计入现金。后续需要与公司行动相容的新报价，旧价不能直接乘新股数。服务将同一 symbol 且 `predictedAt <= effectiveAt <= horizonAt` 的 forecast 标记 `invalidatedAt`，并写入 `invalidatedReason:'CORPORATE_ACTION_REQUIRES_ADJUSTED_OUTCOME'`；包括已结算的相关记录，后续校准均排除它们。运行者需及时从权威公开来源导入事件，防止事件尚未录入时价格跳变污染统计；当前没有自动、完整且已核实的公司行动供应商接入。

## 11. Demo/live 隔离与持久化

状态键分别为 `arena:fsi:v1:demo` 和 `arena:fsi:v1:live`，两者有独立账本、NAV、run、forecast、thesis、catalyst、来源、计算 artifacts 与 audit。切换页面 mode 不迁移任何历史，也不会把 synthetic demo 的收益接在 live 曲线上。

demo 的价格/历史与分析来自明确的确定性生成器，交易仍走实际纸上引擎；live 只接受满足执行条件的真实供应商行情。live 缺凭证、订阅不匹配、行情过期或时钟不可用时，不用 demo 行情补位。管理员仍应保证导入的 synthetic fixture 仅发送到 demo；来源元数据中的 synthetic 文本不能代替服务模式和数据治理。

本地 `npm run dev` 使用 SQLite 文件持久化；生产适配器使用 PostgreSQL/Neon 的 version/CAS。写入冲突重试不会在事务中重发网络模型请求。`WRITE_CONTENTION` 时用相同幂等键重试。账本状态超过容量限制会拒绝新增，要求归档处理；export 不会自动删除数据。

Vercel 在没有 DATABASE_URL 时仅允许初始化诊断与明确 demo/status 等只读入口，其它操作返回 `DATABASE_NOT_CONFIGURED`/503，不用临时内存假装生产账本已经持久化。数据库有连接串但表未迁移/不可达也不能通过健康验收。

## 12. 导出、错误与运维脚本

`POST route=export` 返回：

```js
{
  exportVersion: 1,
  exportedAt: '<server time>',
  mode: 'demo' | 'live',
  sha256: '<canonical state hash>',
  ledgerVerification: { S: {/* verification */}, P: {/* ... */}, T: {/* ... */} },
  frozenContextVerification: [{ runId: '...', profiles: [{ id: 'S', valid: true | false }] }],
  state: { /* complete stored mode state */ }
}
```

这份导出包含完整研究内容、run/forecast、订单、成交和账本，应按其实际内容管理。frozenContextVerification 重新计算每轮保存的公共上下文与各 profile 账户输入的 hash，便于核对决策输入是否仍与当时记录相符。hash 用于内容完整性校验，不是外部身份签名。当前没有“上传完整 ledger 覆盖服务状态”或一键删除历史的 HTTP 路由。

### 错误格式

```json
{
  "error": {
    "code": "IDEMPOTENCY_CONFLICT",
    "message": "Same key with different order inputs",
    "requestId": "server-generated-request-id"
  }
}
```

| HTTP | 典型情况 |
| --- | --- |
| 400 | JSON/payload/domain 字段无效、未知研究 kind、无效模式/账户/来源、财务模型不满足约束 |
| 401 | admin 或 cron Bearer token 缺失/错误/未配置 |
| 403 | Origin 不匹配、受限制的公开 live history |
| 404 | 指定 thesis/catalyst 不存在等已声明的对象查找错误 |
| 405 | 未支持 route/method 组合、试图用 GET 调用普通写接口 |
| 409 | 幂等冲突、快照改变、run lease/并发写竞争、任一账户拒绝全局公司行动等状态冲突 |
| 413 / 415 | 请求体过大 / Content-Type 不符 |
| 429 | 每日研究运行预算达到上限 |
| 502 | 上游 HTTP/JSON/响应完整性或 AI 输出失败 |
| 503 | 数据库、市场数据或模型未配置/服务初始化不可用 |
| 507 | 赛季、状态或记录容量达到限制 |
| 500 | 未识别内部异常；返回通用信息，不将堆栈、供应商响应体或密钥回传 |

AI run 的单 profile 失败和普通业务拒单可以被记录在 HTTP 200 返回的 trace/engine result 中，不一定升级为 HTTP error。请同时检查 `run.results[].status/error`、`execution.ok/errors`、`result.valid/errors` 和相应顶层状态。

### 脚本边界

| 脚本/命令 | 行为 |
| --- | --- |
| `npm run dev` | 启动本地 UI/API，创建本地 SQLite 与本地管理员 token 文件；不会自动把 token 注入网页。 |
| `npm run doctor` | 检查配置及数据库可达性；其输出不打印密钥，也不应被解释为已经调用成功所有付费源/模型。 |
| `npm run db:migrate` | 用 DATABASE_URL 执行 additive `arena_state` schema 迁移。 |
| `npm run install:host -- --target <Afflatus路径>` | 先展示安装计划；`--apply` 才修改已核对的宿主接缝并备份；不会自行 commit/push/migrate/deploy。 |
| `node scripts/release-host.mjs --target <宿主路径>` | 执行本地验证；需显式 `--deploy` 才暂存部署、探测并推广。 |
| `node scripts/snapshot-example.mjs` | 生成明确标为 demo 的样例 run/status，不声称是 live 绩效。 |

用 curl 调用时可复用已在本机环境中的管理员 token，不应把真实密钥写入提交内容或共享示例：

```bash
curl 'http://127.0.0.1:4174/api/arena-fsi?route=run' \
  -H "Authorization: Bearer $ARENA_ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"mode":"demo","idempotencyKey":"curl-demo-run-001","profiles":["S"]}'
```

浏览器通过同源 UI 的 `/api/arena-fsi` 请求服务；本地开发代理需要保持受控的 Origin/Host 转换。不能为便利而关闭生产 Origin 和 Bearer 校验。
