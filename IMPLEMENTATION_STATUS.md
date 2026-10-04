# IMPLEMENTATION STATUS — 2026-10-05 (Australia/Melbourne)

当前交付：P2 研究工作台基础上，新增 P3 有界任务与中英文量化工作台：美股/独立现货 Decimal 回测、期权链与模型、DCF/可比估值/三表、限定美股因子、组合风险与归因；财报日历的固定 Futu 只读适配也已补齐。真实本地数据链与离线算例分别验收，不代表所有原始能力都完整迁移。SEC 缺真实 VIBE_TRADING_SEC_UA；日历缺可用 OpenD/SDK；严格永续缺真实历史风险快照。按用户要求，P4/P5 的 owner identity 阻塞继续保留，个人计算仅提供本机 CLI。

此前 P2/排版版本 df8c8630 已在 feida.au 上线。本轮已获用户明确上线授权：发布 P3 与服务状态提示至 origin/main 和功能分支，并开启生产页面 VITE_VIBE_MARKETS_ENABLED / VITE_VIBE_QUANT_ENABLED。生产研究桥接 URL/token 尚未配置，服务端研究开关仍关闭；页面可见不代表在线查询或计算已可用。付费资源、公开研究数据和实盘仍关闭。最终部署结果以 Vercel 对应提交及线上验收为准。

## 阶段与修改文件

|阶段|结果|文件|验收/下一阶段|
|---|---|---|---|
|P0|源码核对完成，宿主既有门禁失败另列|integrations/vibe-us-crypto-kit/{scripts,manifests,extracted}; HOST_BASELINE.md / CAPABILITY_COVERAGE.md / DEPENDENCY_MAP.md|固定 SHA + 5 blob；142 静态候选、109 local tools、76 MCP、102 API、90 skills、16 frontend routes；差集未分类为 0|
|P1|限定日线模块本地通过；US01 全范围仍部分实现|api/vibe-market.js; services/vibe-bridge/; src/lib/vibe{BridgeProxy,MarketContract}; src/features/vibe-markets/; Arena entry/App slot; scripts/vibe-{local,dev-plugin}|AAPL/SPY/BTC-USDT 实网 loader 与本地 HTTP 均 200；默认关闭、私有访问、错误态、桌面/移动/键盘、关闭 flag 已验证；P2 新增 IVV/Binance|
|P2|研究适配完成可推进部分；配置/connector/数据范围阻塞另列|bridge/{research,research_models,patterns}.py / research-contract.json; api/vibe-research.js; fixed BFF DTO; research.js / sentiment.js / index.js|见 integrations/vibe-us-crypto-kit/validation/P2_TEST_REPORT.md；SEC 缺真实联系信息，US09 缺 connector，国内研报未伪装美股；下一步是在真实配置/connector 到位后补验收|
|P3|限定模块本地验收；外部数据与个人持久化保留阻塞|有界任务、完整账本、数学模型、限定因子/组合、严格快照 CLI|不支持用户策略代码、共享个人现金流/账户或伪造风险数据|
|P4/P5|OWNER_REQUIRED，按用户要求保留阻塞|仅本机数值辅助计算，无私有产物服务|没有真实身份、对象授权、研究会话或账户/订单 API|
|P6|默认关闭、私有代理、取消与回滚路径已验证|P3 与页面展示已获授权发布；服务端计算仍待真实生产配置|无新增付费资源、MCP 配置或公开数据可见性|

## 每项功能状态

|ID|能力|阶段|宿主状态|缺项/来源边界|
|---|---|---|---|---|
|US01|美股 / ETF 标的识别、搜索、自选池|P1|PARTIAL|13 个显式标的可选择（7 US/ETF + 6 交易所明确的现货对）；完整上游搜索、自选持久化和标的扩展尚未适配|
|US02|OHLCV、历史区间、数据源降级与来源信息|P1|DAILY_IMPLEMENTED|日线真实闭环；盘中/周/月及更多供应商未实现|
|US03|公司档案、估值、分析师预期|P2|LOCAL_VALIDATED|固定 Yahoo 工具；listing symbol/quote/financial currency 区分；估值、目标价、EPS/收入修订、评级；AAPL 实网 worker/BFF/UI 验证，asOf 未声明时保持未知；非历史时点数据|
|US04|SEC 文件、三张财务报表、时点安全基本面|P2|ADAPTER_OFFLINE_VALIDATED / CONFIG_REQUIRED|SEC 文件、固定概念三表与 filed cutoff 已适配；每值保留单位/start/end/filed/accession；排除未来重述/YTD、年度季度不混用；不推算 Q4，不是完整 ratios/get_fundamentals 产品；实网缺真实 VIBE_TRADING_SEC_UA|
|US05|13F 机构持仓及环比、ETF 穿透|P2|ADAPTER_OFFLINE_VALIDATED / CONFIG_REQUIRED|Berkshire/Bridgewater 固定 CIK 组合+环比，修订不完整/上一期缺失明确显示；ETF 固定 US SEC N-PORT 分支（新增 IVV），保留报告期、filing、滞后与排名截取；不推断基金结构；缺 SEC 真实联系人，尚无实网成功声明|
|US06|新闻、市场筛选、行业比较|P2|PARTIAL_LOCAL_VALIDATED|Yahoo 美股新闻+词典评分、Eastmoney 明确 US universe；行业比较用 Yahoo assetProfile，仅已接入同板块股票；worker/HTTP 实网成功，筛选也保留一次真实源失败；上游 sector/research_reports 的 A 股分支不适用，未接完整行业 universe 或美股研报|
|US07|期权链、Black–Scholes、Greeks、多腿到期收益|P3|LOCAL_VALIDATED|Yahoo 真实期权链与理论模型分离；保留未知报价时间/最多 60 行；固定 BS/Greeks、多腿到期收益与显式权利金/合约乘数，算例与实网链分别验收；不模拟美式提前行权/指派|
|US08|DCF、可比估值、三表情景模型|P3|ADAPTER_OFFLINE_VALIDATED|固定 DCF/可比估值/三表 helper；必需输入、假设依据、期间和字段校验；缺数据拒绝；算例、估值输出、三表平衡通过；不自动填报表或贴现率|
|CR01|加密货币交易对、交易所、现货历史行情|P1|SPOT_DAILY_IMPLEMENTED|OKX 和 Binance（CCXT）BTC/ETH/SOL-USDT 限定现货；OKX/Binance BTC-USDT 实网成功；无静默交易所替换，其他交易所/计价币未实现|
|CR02|OKX / Binance / CCXT 多交易所数据|P2|LIMITED_LOCAL_VALIDATED|OKX 原生 loader + Binance 固定 CCXT loader；显式交易所和 source，OKX UTC+8/Binance UTC 日线，完整开闭时间；两交易所 BTC 现货日线与盘口实网成功；不开放任意 CCXT exchange 或代理绕过|
|CR03|L2 盘口、价差、深度不平衡、冲击成本|P2|LOCAL_VALIDATED|固定上游 orderbook 工具，10 层展示、10,000 USDT 名义模拟；基础币/USDT 单位分离；两交易所实网/BFF 成功；venue time 与 local fetch time 区分，陈旧拒绝、部分填充标注；非历史订单簿或清算图|
|CR04|情绪文本评分与恐惧贪婪指数|P2|LOCAL_VALIDATED|固定英文词典在浏览器本地计算，含 Python float 四位 ties-to-even 边界；新闻标题用固定 Python helper；Alternative.me API 保留 index timestamp，旁置归属；比特币指数不是所选币种/美股情绪，不调用 LLM|
|CR05|永续合约回测：费用、资金费、逐仓/全仓、强平|P3|ADAPTER_OFFLINE_VALIDATED / HISTORICAL_DATA_REQUIRED|本机严格 Binance USDT 永续快照适配；实际 funding、mark OHLC、历史维护保证金有效期/内容哈希必需；8H UTC、明确 PERP 身份；合成验收通过，无真实风险历史数据成功声明；上游 float 模拟不是资产账本|
|CR06|合约证据事件、保证金与对账验证|P3|LOCAL_CALCULATOR / HISTORICAL_DATA_REQUIRED|严格快照事件/费用/资金费/强平证据与固定对账 helper 已接；仅本机供应快照比较，非账户连接/交易所强平顺序实证；8H 极值不还原日内路径|
|CR07|Funding/Basis、清算图、稳定币流、解锁与 DeFi 收益研究|P4|UNAVAILABLE_DATA / TEMPLATE_ONLY|90 个技能模板已盘点并条件分类；funding/basis/清算图/on-chain/稳定币/解锁/DeFi 未接数据|
|Q01|技术指标、图表形态识别|P2|LOCAL_VALIDATED|RSI/MACD/BB/SMA/EMA/volume + 蜡烛/头肩/双顶底/三角/扩散/支撑阻力/趋势纯 helper；完整 bars 先算、图仅显示末 80 根；warmup 无填充；峰谷明确回顾性且确认快照单列，不能冒充可交易的无 lookahead 信号|
|Q02|通用美股回测、仓位、滑点与收益指标|P3|LIMITED_LOCAL_VALIDATED|固定 buy_hold / sma_cross；GlobalEquityEngine(us) 执行政策配合独立 Decimal 现金账本；前一收盘信号、下一开盘成交/显式费用、前日量上限；基准同区间成本、完整账本校验；AAPL 真实链通过；仅做多/无借贷/不含股息|
|Q03|现货策略回测|P3|LOCAL_VALIDATED|独立现货现金/资产账本、8 位十进制半偶数舍入、前日基础币成交量、完整逐笔/净值核对；OKX 与 Binance BTC 真实链通过；不使用 CryptoEngine 作为现货引擎|
|Q04|因子 IC/IR、分层回测、Alpha Zoo|P3|LIMITED_US_LOCAL_VALIDATED|academic_strev / academic_illiq 按 metadata 限制六只美股；因子滞后一根、open-to-open 标签、IC/IR/三层毛净收益/显式费用、按时间训练验证与隔离；真实 strev 链通过；未迁移全 Zoo/全市场因子发现|
|Q05|策略浏览、查询、证据缓存与策略发现|P3|PARTIAL_LOCAL_VALIDATED / OWNER_REQUIRED|固定策略/合资格因子目录、有界内存任务、请求/行情快照哈希与完整结果证据；不保存个人策略库、持久证据或运行任意策略代码；这些写入仍需 owner identity|
|Q06|组合、相关性、风险画像与归因|P3|LOCAL_VALIDATED|显式权重、相同币种与完全相同日历/时区才运行；相关性/历史 VaR-CVaR/回撤、算术贡献和 Brinson-Fachler/Carino 归因；AAPL/MSFT 真实链通过；研究每日再平衡，不含成本股息或自动外汇换算|
|Q07|现金流绩效 XIRR/MOIC/DPI/TVPI/TWR/Modified Dietz|P3|LOCAL_CLI_OFFLINE_VALIDATED / OWNER_REQUIRED|本机固定现金流/helper，XIRR/MOIC/DPI/TVPI/TWR/Dietz/MWR；持有人方向与 NAV 非现金显式、金额十进制字符串、科学指标使用上游 float；不经共享 BFF 接收个人现金流或持久化|
|AI01|研究会话、目标、证据、历史与产物|P4|NOT_IMPLEMENTED / OWNER_REQUIRED|先实现真实 owner identity、对象权限、私有存储/预算隔离；ARENA_ADMIN_KEY 仅为配额门|
|AI02|可组合技能、提示词、策略代码生成|P4|NOT_IMPLEMENTED / OWNER_REQUIRED|先实现真实 owner identity、对象权限、私有存储/预算隔离；ARENA_ADMIN_KEY 仅为配额门|
|AI03|多 Agent Swarm、团队预设与重试|P4|NOT_IMPLEMENTED / OWNER_REQUIRED|先实现真实 owner identity、对象权限、私有存储/预算隔离；ARENA_ADMIN_KEY 仅为配额门|
|AI04|定时研究、时区、报告和审计|P4|NOT_IMPLEMENTED / OWNER_REQUIRED|先实现真实 owner identity、对象权限、私有存储/预算隔离；ARENA_ADMIN_KEY 仅为配额门|
|SH01|交易日志诊断 → 影子策略 → 回测 → 报告 → 信号|P4|NOT_IMPLEMENTED / OWNER_REQUIRED|先实现真实 owner identity、对象权限、私有存储/预算隔离；ARENA_ADMIN_KEY 仅为配额门|
|TR01|券商/交易所连接配置与只读账户|P5|NOT_IMPLEMENTED / OWNER_REQUIRED|没有连接账户；先真实身份、只读 connector 能力与 paper sandbox 验证；实盘默认禁用|
|TR02|Paper execution / 实盘订单权限路径|P5|NOT_IMPLEMENTED / OWNER_REQUIRED|没有连接账户；先真实身份、只读 connector 能力与 paper sandbox 验证；实盘默认禁用|
|CTX01|FRED 宏观、网页、文档、论文和预测市场证据|P4|NOT_IMPLEMENTED / OWNER_REQUIRED|先实现真实 owner identity、对象权限、私有存储/预算隔离；ARENA_ADMIN_KEY 仅为配额门|
|EXT01|可选付费数据市场 / 外部 MCP 扩展|P6|DISABLED|付费与任意 MCP 配置保持关闭；未授权资源/数据权利/费用|
|US09|美国财报日历、预期与事件研究|P2|ADAPTER_OFFLINE_VALIDATED / US_CONNECTOR_REQUIRED|固定 Futu quote-only get_earnings_calendar、选定公司/US 市场/最多七天、实际字段投影与日期校验；真实 pinned SDK + mock transport 验收通过；缺运营方可用 OpenD 与兼容 SDK，未声明实网日历成功；不替换为分析师预期|
|Q08|Decimal 数值验证与报告审计|P3|LOCAL_CLI_OFFLINE_VALIDATED / OWNER_REQUIRED|本机固定 Decimal 验算/安全算术 AST/可复现抽样报告审计；拒绝任意代码；对照值由操作者提供，不冒充独立来源事实核查；个人报告不进入 BFF|
|Q09|研究假设、回测关联与策略衰减|P3|LOCAL_CLI_OFFLINE_VALIDATED / OWNER_REQUIRED|固定纯 DecayEvaluator 与状态建议可在本机计算；没有私有假设库、回测关联写入或自动持久化状态，需要真实 owner identity|
|AI05|跨会话记忆与多模态研究|P4|NOT_IMPLEMENTED / OWNER_REQUIRED|先实现真实 owner identity、对象权限、私有存储/预算隔离；ARENA_ADMIN_KEY 仅为配额门|

每项源码根目录和验收见 `integrations/vibe-us-crypto-kit/manifests/capabilities.json`；逐工具/路由/技能决定及理由见 `manifests/coverage.json`。源码存在、方法模板、真实数据、宿主可用四种状态分别记录。

## 本轮 P3 与日历测试

详见 [P3_TEST_REPORT.md](integrations/vibe-us-crypto-kit/validation/P3_TEST_REPORT.md)。源码 pin、离线/真实本地层次、既有失败集合和数据/身份阻塞分别记录。P2 的历史验收见下文，不替代本轮验证。

## P2 历史测试真实性

- 宿主 kit Python：105 passed；其中 11 项新增 P2 测试为合成 fixtures / mocked transport，调用真实固定 helper；不称为实网。
- 固定上游所选 P2 模块：366 passed，socket 禁止，属于离线源码验证。
- Host Node BFF：51 passed；新增/扩展 Vitest：16 passed；typecheck / build 与 data/site/header/css/combat/i18n/OG/SEO 门禁通过。
- 实网短生命周期 worker：profile/news/US screener、Yahoo US 行业分类、OKX/Binance 盘口、Bitcoin F&G 及 AAPL/SPY/IVV/OKX BTC/Binance BTC 日线均成功。真实本地 HTTP/BFF 验证独立记录；筛选第一次 HTTP 源失败保留，后续结果见报告，不静默兜底。
- SEC 联系人未提供：worker 与 HTTP 返回 SEC_CONTACT_REQUIRED，未发送不合规 SEC 请求；财务/13F/N-PORT 实网验收未完成。
- 整站 unit 与 browser 的既有失败保留，逐项集合对照见 p2-unit-comparison.json / p2-browser-gates-comparison.json；新增失败另列，不能声称整站门禁全绿。
- 本地 Chromium 新功能：1440×1000 桌面与 440×956 移动视口，中英文、键盘、来源、浏览器无服务器鉴权/配额头与故障态单独验证。不是线上或真机验收。
- 汇总与限制见 integrations/vibe-us-crypto-kit/validation/P2_TEST_REPORT.md。原 P0/P1 测试历史仍留在 validation/IMPLEMENTATION_TEST_REPORT.md 与 HANDOVER.md。

## 配置、数据与回滚

本地可运行 `python3 scripts/vibe-local.py`；它生成临时服务端凭据，绑定 127.0.0.1，不把服务/交易密钥交给浏览器。默认生产代码 flag 关闭。已有 quote/history/published pipeline 未改动；既有设计示例价格也没有被改名成真实报价。

服务端所需名称：VIBE_FEATURE_ENABLED、VIBE_BRIDGE_URL、VIBE_BRIDGE_TOKEN、VIBE_UPSTREAM_AGENT、ARENA_ADMIN_KEY；量化还需服务端 VIBE_QUANT_ENABLED 与非密钥 UI VITE_VIBE_QUANT_ENABLED；UI 行情用非密钥 VITE_VIBE_MARKETS_ENABLED；本地临时授权用 VIBE_LOCAL_RESEARCH。SEC/财务/13F/N-PORT 现已适配，但仍缺真实 VIBE_TRADING_SEC_UA；个人模块缺真实身份系统，不假设填写一个环境变量即可获得 owner identity。部分高级项目缺实际数据 adapter，不能仅靠 API key 或技能文档补齐。

公开数据与付费/实盘保持关闭。回滚先关闭 VITE_VIBE_MARKETS_ENABLED / VIBE_FEATURE_ENABLED，停止本地桥，再 revert 本次本地实现 commit；不要按初始 overlay 回执删除已修改文件，不删除任何个人数据。

日历可选配置：VIBE_FUTU_CALENDAR_ENABLED/HOST/PORT，仅接受运营方提供的本地 OpenD quote gateway；不接账户或交易密码。本机量化命令与输入契约见 [P3_QUANT_GUIDE.md](integrations/vibe-us-crypto-kit/docs/P3_QUANT_GUIDE.md)。关闭量化先停 VITE_VIBE_QUANT_ENABLED / VIBE_QUANT_ENABLED，再停止 bridge 取消内存任务。
