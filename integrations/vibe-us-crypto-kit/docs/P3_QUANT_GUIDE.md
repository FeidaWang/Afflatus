# P3 量化工程与操作契约

固定源码：`251b094320c1f97d1486626d3618113526914d4c`。保留 Vite MPA 与原有报价/发布管线。量化是有界、只读的研究计算，不是账户账本服务或用户策略代码执行器。

## 运行与配置

`python3 scripts/vibe-local.py` 在宿主根目录启动 loopback bridge 8765 与 Vite 5175；只在服务端生成临时凭据。打开 `http://127.0.0.1:5175/arena.html`。本地脚本启用行情与量化；生产默认关闭。

- 行情 BFF：`VIBE_FEATURE_ENABLED`、`VIBE_BRIDGE_URL`、`VIBE_BRIDGE_TOKEN`、`VIBE_UPSTREAM_AGENT`、`ARENA_ADMIN_KEY`。
- 量化额外需要 `VIBE_QUANT_ENABLED=true` 与 `VITE_VIBE_QUANT_ENABLED=true`；行情 UI 需要 `VITE_VIBE_MARKETS_ENABLED=true`。
- `VIBE_LOCAL_RESEARCH=true` 仅用于本地插件，拒绝非 loopback、异源和跨站请求，不进入生产 bundle。
- SEC 需要真实 `VIBE_TRADING_SEC_UA`。日历需兼容 `get_earnings_calendar` 的 `futu-api` SDK 与实际 OpenD 行情服务，运营方配置 `VIBE_FUTU_CALENDAR_ENABLED=true`、`VIBE_FUTU_CALENDAR_HOST`、`VIBE_FUTU_CALENDAR_PORT`。只允许本地网关；只调用 quote context，不读取交易配置/账户/密码或解锁交易。

浏览器不发送 bridge token 或共享配额密钥。生产私有入口仍需可信服务端的受控访问层；没有它会返回 403，不能靠开启 public market-data flag 绕过。共享配额门不提供用户身份或对象授权。P4/P5 继续阻塞。

## 固定任务协议

`POST /api/vibe-quant` 提交 JSON，返回 202；`GET /api/vibe-quant?id=<32 位十六进制>` 查询；`DELETE` 同一路径取消。后端只有固定 `/v1/quant/jobs` 路由，没有任意 tool、URL、文件路径、owner、策略代码或命令参数。

请求由 `quant-contract.json`、Python `QuantRequest` 与 JS `vibeQuantContract` 共同限制。请求体最多 32 KiB，参数最多 24 KiB；工作进程输出最多 1 MiB；两个并发槽与最多四个活动任务，包含排队的最长时间 150 秒，子进程最长 120 秒。完成任务最多 32 个、10 分钟 TTL，重启丢失。创建 6 次/分钟、查询/取消 120 次/分钟，单实例内存预算；不可直接多副本部署。

任务终态和研究结果分别记录：`complete` 可能包含 `unavailable` 及必需字段清单。网络错误、缺数据与模型输入错误不相互伪装。选择/区间改变、停止与卸载会取消任务并清除旧结果。子进程只接收过滤后的环境与临时 HOME，不继承模型/交易密钥或主机 session。

## 可用计算与输入

历史模块必须指定 `start_date`、`end_date`；结束日不包含在区间内，最大 366 天，只接完整日线。UI 使用所选历史区间。下列输入是**说明语法的合成算例，绝不作为数据源失败兜底或产品默认值**。

### 美股与现货回测

```json
{"instrument_id":"US:AAPL","module":"backtest","start_date":"2025-01-01","end_date":"2025-12-31","parameters":{"strategy":"sma_cross","initial_capital":"10000","commission_bps":"10","slippage_bps":"5","participation":"0.01","fast":5,"slow":20}}
```

固定策略 `buy_hold` / `sma_cross`。资金、基点和比例为最多八位小数的字符串；周期为整数。前一根收盘信号决定下一开盘成交；用前日成交量限制成交量，不能用本日尚未发生的量。美股调用 `GlobalEquityEngine(market='us')` 执行政策，并用宿主 Decimal 账本执行费用与现金/资产结算；独立现货账本不调用永续引擎。

只做多、无借贷、无资金费/强平；美股数量两位、现货数量八位；现金与净值八位半偶数舍入。完整成交/净值逐行核对、同区间同成本买入持有基准；期末持仓只标记、不强制卖出。部分入场后不追加买入，退出可部分成交。复权按数据源声明，不额外发放股息。Yahoo 日线成交量为 shares；现货数量依据固定 loader 与 [OKX 历史蜡烛字段](https://www.okx.com/docs-v5/en/#rest-api-market-data-get-candlesticks-history)、[Binance Kline 字段](https://github.com/binance/binance-spot-api-docs/blob/master/rest-api.md#klinecandlestick-data) 确认为基础币。币种及日线时区不会被替换。

### 期权与估值

- `options_chain`：美股/ETF；空参数取源默认到期日，或 `expiration` 为整数 epoch 秒。Yahoo 实际报价不以 BS 值补齐；quote timestamp 未提供时为 null。每侧最多 60 项，不能称完整链或可成交报价。
- `option_model`：`spot/strike/years/rate/volatility/dividend_yield` 为 JSON 数字，`right` 为 call/put。例如 `{"spot":100,"strike":100,"years":1,"rate":0.05,"volatility":0.2,"dividend_yield":0,"right":"call"}`。仅欧式模型，无美式提前行权。
- `option_payoff`：`legs` 为 `{option_type,strike,qty,premium}` 数组，最多八腿；`spots` 为升序唯一数字网格，最多 400；另需 `entry_spot/years/rate/volatility/multiplier/commission_rate`。权利金与乘数必须明确提供，不自动理论定价；只计算到期，不模拟美式指派。
- `dcf`：需要 `inputs`、`capital_structure_basis`（current/target）、`discounting_convention`、`terminal_value_method`、`gdp_growth_ceiling`。inputs 包括固定版本要求的资本成本、预测 EBIT/折旧/资本支出/营运资金、资本结构及每股桥接。`terminal_growth`、`exit_multiple` 必须是 `{name,value,basis,source?}`，name 与字段一致；size/country premium 显式填写，预测最多 20 期。完整 worked example 见 `tests/test_quant_host.py`。
- `comps`：`target/peers/calendarisation_policy`；至少两家可比公司。每家公司流量字段 `ebitda/ebit/revenue/diluted_eps` 采用 `FlowMetricPeriods`（财政年末月份、上全年、当年 YTD、上年 YTD、下全年），EPS basis 与股数/资本结构显式。固定 helper 处理无意义倍数，不把缺值补成零。
- `three_statement`：`opening/drivers/assumption_basis`。固定 required fields 全部提供，driver 为相同长度数组、最多 20 期，开账与每期三表平衡由固定 helper 验证。模型是情景预测，不冒充 SEC 报表。

### 因子、目录与组合

因子参数示例：`{"factor":"academic_strev","commission_bps":"10","slippage_bps":"5"}`。只有 metadata 允许美股的 `academic_strev/academic_illiq`；六只股票为 AAPL/MSFT/NVDA/MU/AMZN/GOOGL，不把 ETF 当股票横截面。前日因子、当前 open 至下一 open 标签；训练/验证按时间切分，隔离一日期。三层毛净收益与显式交易费用分别记录；有限标的池不是全市场发现。

组合参数示例：`{"instruments":["US:AAPL","US:MSFT"],"weights":["0.6","0.4"],"benchmark_weights":["0.5","0.5"]}`。权重必须为 Decimal 字符串、非负且精确合计 1，所选标的需在组合内。最多八项；币种、日历、日线时区与日期序列必须一致，不能填空或默认换算 USD/USDT。固定权重每日再平衡研究，不含费用与股息。算术贡献与复合归因分开；可选基准用 Brinson-Fachler / Carino 核对复合主动收益。

`catalogue` 不需要参数，返回固定策略与合资格因子，以及请求/行情快照哈希证据政策。没有用户策略代码执行、持久策略发现或个人证据库。

## 本机计算与严格永续

使用 kit 的 Python 3.11+ 环境运行 `integrations/vibe-us-crypto-kit/.venv/bin/python scripts/vibe-quant.py`，将固定请求通过 stdin 输入。`--snapshot` 可读取操作者本机已保存、按部署 instrument ID 索引的标准化 bars；重新校验来源、完整日期与请求窗口。路径不进入 HTTP API。

`cashflows/rigor/audit/decay/reconcile` 仅本机 CLI；共享 BFF 拒绝 OWNER_REQUIRED。现金流区分 contribution/distribution/NAV、显式币种/时间口径；源金额字符串精确，绩效 helper 使用科学 float，不是资产账本。审计的对照源值由操作者提供，不能称独立事实验证；衰减只建议状态，不写入假设库。对账只比较显式供应的 AccountState/RiskSnapshot/BinanceAccountSnapshot，不连接真实账户。

永续必须显式 `perpetual_id`，只接受对应 Binance BTC/ETH/SOL USDT linear perpetual。使用 `--perpetual-snapshot`，严格 JSON 包含：instrument_id、source=binance_usdm_historical、interval=8H、observed_at、contract_specifications 与 rows。每根 rows 必须有完整交易/mark OHLC、volume、execution_open、真实 funding_rate/结算时点、maintenance_brackets/内容 SHA256/历史有效开始时点；UTC 8H 连续、已闭合、维护规则不能来自未来。缺任意必要数据拒绝，现货数据不会自动升级为永续风险数据。

固定 `CryptoEngine(perpetual_strict=True,funding_mode='data')` 输出事件、成交、净值、summary 与快照哈希。仅为上游 float 研究模拟，8H 极值不还原盘中强平先后；只有合成离线验收，没有真实历史风险快照成功声明。服务端默认返回 PERPETUAL_DATA_REQUIRED。

## 复验与回滚

Host、固定源码、真实本地与浏览器的证据分别列在 `validation/P3_TEST_REPORT.md`。真实本地复验用 `node integrations/vibe-us-crypto-kit/scripts/verify_live_quant.mjs`；它覆盖写入原报告，先保留旧证据。此前源失败及修复过程也保留，不能用重跑成功抹掉。

停止量化先关闭 UI/server 量化 flags；停止 bridge 会取消在途子进程并清除内存任务。行情 kill switch 为 VITE_VIBE_MARKETS_ENABLED / VIBE_FEATURE_ENABLED。仅撤销本轮提交可回到已上线的 df8c8630；不要根据最初 overlay receipt 删除已修改文件。未创建个人数据、付费资源或实盘订单。
