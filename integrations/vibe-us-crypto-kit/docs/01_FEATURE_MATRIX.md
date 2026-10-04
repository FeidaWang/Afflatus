# US Stock + Crypto 功能迁移矩阵

范围以固定 commit 的实际源码为准。下表是**已识别的迁移范围**，不是“所有功能已实现”的报告。开工后必须执行静态提取与运行时工具枚举，发现未分类功能不得跳过。源码存在、文档声明、真实数据可用、已完成网站适配，是四种不同状态。

`P1` 的日线接入骨架已随包交付，其余在路线图按依赖迁移。表中 * 表示不能自动假定适用于两个市场。

|编号|功能|市场|阶段|源码证据级别|迁移/验收边界|
|---|---|---|---|---|---|
|US01|美股 / ETF 标的识别、搜索、自选池|US|P1|已审阅市场识别和行情入口；完整搜索实现待本地枚举|保留现有 api/quote.js、api/history.js；新增显式 instrumentId，不从 ticker 猜全球市场|
|US02|OHLCV、历史区间、数据源降级与来源信息|US+Crypto|P1|已审阅关键实现|本包日线桥已实现；盘中、周月线和更多供应商在后续阶段；禁止抽样 OHLC 当连续 K 线|
|US03|公司档案、估值、分析师预期|US|P2|上游工具文档声明，函数定位由提取器生成|缺数据返回 unavailable，不能用 0 或 LLM 填空|
|US04|SEC 文件、三张财务报表、时点安全基本面|US|P2|上游工具文档声明|保存 filedAt、报告期、原文来源；同一报告截止日的年度/季度不可混用|
|US05|13F 机构持仓及环比、ETF 穿透|US|P2|上游工具文档声明|展示披露滞后；ETF 穿透不是实时持仓；只接美股适用分支|
|US06|新闻、市场筛选、行业比较|US+Crypto|P2|上游工具文档声明，逐工具市场适用性待验证|不能把 A 股行业资金流或国内研报接口更名为美股接口|
|US07|期权链、Black–Scholes、Greeks、多腿到期收益|US|P3|工具文档声明 + 源文件存在性|理论定价和真实报价分栏；注明欧式假设和美式期权局限|
|US08|DCF、可比估值、三表情景模型|US|P3|README/工具层声明；具体入口待枚举|缺参数必须 NOT_RUNNABLE，不补造增长率或资本成本|
|CR01|加密货币交易对、交易所、现货历史行情|Crypto|P1|已审阅入口，支持源目录已确认|本包初始仅 OKX 三个 USDT 现货对；更多交易所/计价币列为扩展而非删除|
|CR02|OKX / Binance / CCXT 多交易所数据|Crypto|P2|工具文档声明 + loaders 存在性|同币不同交易所不得静默替换；地域不可用返回状态，不能绕过限制|
|CR03|L2 盘口、价差、深度不平衡、冲击成本|Crypto|P2|上游工具文档声明|不是历史完整订单簿或清算热力图；必须显示交易所和快照时间|
|CR04|情绪文本评分与恐惧贪婪指数|Crypto+US|P2|上游工具文档声明|本地词典评分不等于 LLM 判断；美国股票与 crypto 指数不可混同|
|CR05|永续合约回测：费用、资金费、逐仓/全仓、强平|Crypto perpetual|P3|已审阅 CryptoEngine 关键实现|默认关闭；perpetual_strict 要 funding_mode=data；明确 spot ≠ perp；缺历史风险输入则拒绝严格回测|
|CR06|合约证据事件、保证金与对账验证|Crypto perpetual|P3|引擎代码引用与源码路径已确认|保存成交/资金费/强平序列，严格模式不得降级成固定资金费又宣称真实|
|CR07|Funding/Basis、清算图、稳定币流、解锁与 DeFi 收益研究|Crypto|P4|主要为技能/团队研究范围，不保证有即用数据接口|逐项验证数据工具；没有数据源时明确“方法模板/需数据”，不能伪造图表|
|Q01|技术指标、图表形态识别|US+Crypto|P2|工具文档声明|复用上游实现；RSI/MACD 等先计算在连续原始 bars 上，再采样展示|
|Q02|通用美股回测、仓位、滑点与收益指标|US|P3|已审阅 GlobalEquityEngine|显式 market=us；上游 US commission=0 是简化，需补实际费用、借券与成交约束|
|Q03|现货策略回测|Crypto spot|P3|不是已确认独立现货引擎；需要适配并验证|禁止因 leverage=1 就把永续引擎标为 spot；无借贷/无资金费/无强平的现货成交账本单测|
|Q04|因子 IC/IR、分层回测、Alpha Zoo|US+Crypto*|P3|工具文档声明 + 模块存在性|按 __alpha_meta__ universe、columns、warmup 过滤；GTJA191 中国专用；股票基本面因子不自动支持 crypto|
|Q05|策略浏览、查询、证据缓存与策略发现|US+Crypto|P3|工具文档声明 + 模块存在性|来源、样本区间、训练/验证集、费用假设与证据行均需留存|
|Q06|组合、相关性、风险画像与归因|US+Crypto|P3|模块存在性与工具文档声明|USD 与 USDT 不自动按 1:1 合并；时区/交易日/缺失值/基准口径显式|
|Q07|现金流绩效 XIRR/MOIC/DPI/TVPI/TWR/Modified Dietz|US+Crypto|P3|上游工具文档声明|个人现金流不得写入 public/、静态 JSON 或 CDN|
|AI01|研究会话、目标、证据、历史与产物|US+Crypto|P4|会话/路由已审阅，模块存在性确认|需要所有者身份及 object-level authorization；现有 ARENA_ADMIN_KEY 只是配额门，不是用户系统|
|AI02|可组合技能、提示词、策略代码生成|US+Crypto|P4|工具文档声明|通用知识保留；工作目录隔离；生成代码只能在无交易密钥的隔离 worker 中跑|
|AI03|多 Agent Swarm、团队预设与重试|US+Crypto|P4|工具文档声明 + 模块存在性|每用户预算/并发/token/重试上限；一次点击不是无限团队循环|
|AI04|定时研究、时区、报告和审计|US+Crypto|P4|API assembler 引用已确认|持久 job、幂等、防 DST 重复；公共发布必须单独审批脱敏|
|SH01|交易日志诊断 → 影子策略 → 回测 → 报告 → 信号|US+Crypto|P4|上游工具文档明确完整研究链路|Shadow Account 是反事实研究，不等于实时 paper broker，也不是实盘执行|
|TR01|券商/交易所连接配置与只读账户|US+Crypto|P5|工具文档及 API assembler 确认|按 connector 的实际 capabilities 区分 paper / live-readonly / mandate-gated；不能“一键全开”|
|TR02|Paper execution / 实盘订单权限路径|US+Crypto|P5|确认存在 live 路由；不同 connector 能力需逐一实测|默认 disabled；本包不挂载订单路由；先 paper 和 kill switch，再由用户明确批准 live；密钥禁提现|
|CTX01|FRED 宏观、网页、文档、论文和预测市场证据|US+Crypto context|P4|上游工具文档声明|仅作研究上下文；URL 读取防 SSRF、上传隔离；预测市场概率不是股价预测|
|EXT01|可选付费数据市场 / 外部 MCP 扩展|US+Crypto optional|P6|上游工具文档声明|默认不启用；付费需运营者配置预算；禁止用户传 command/args/env/mcpServers|

## 排除与隔离

不把 A 股、港股、加拿大/英国/印度/韩国/越南股票、中国期货、外汇的专属界面和数据工具接进目标看板。Crypto 的不同交易所与计价币属于可选加密货币范围，不因交易所所在国家而把现货当作当地股票排除。桌面 Electron、聊天渠道机器人、电脑 shell/MCP 配置管理也不成为公开网站 API。

共享的基类、数据归一化、风险、审计和部分含多市场分支的文件需要保留。**文件仍在参考源码里不等于服务端会开放该市场。** 第一阶段以 instrument allowlist 和数据源精确匹配限定产品能力；后续以同样的边界限定 Agent 工具和回测任务。绝不通过删除字符串 `China`、`HK` 来粗暴剪依赖。

## “所有功能”的完成判定

从 `agent/mcp_server.py`、本地 tool registry、`agent/SKILL.md`、API routes、前端页面和 skills 建立六方对照。每项必须有 retain / conditional / exclude / unavailable 结论和理由；不能将 skill 的承诺记为连接器实现。`inventory_upstream.py` 只覆盖静态装饰器、源码函数、路由装饰器和工具文档，**不能证明动态注册已穷尽**；Codex 要在隔离环境输出运行时 tool registry 并与清单求差集。

## P0 runtime audit additions — 5 October 2026

|ID|Discovered capability|Source level|Status|
|---|---|---|---|
|US09|US connector earnings calendar|Runtime tool schema|Requires verified connector; not mounted|
|Q08|Decimal verification and report numeric audit|Runtime tool schema|Deterministic source; not yet adapted|
|Q09|Hypotheses, run linkage and strategy decay monitoring|Runtime classes/store|Requires owned storage and validated samples|
|AI05|Persistent memory, session search and image interpretation|Runtime classes|Requires owner isolation/model budget|

`options_pricing`, `options_payoff`, `pattern`, `alpha_compare`, `scheduled_research`, `portfolio_risk_xray` are actual runtime names added to the original feature IDs. Full per-item audit: `../manifests/coverage.json`. Original capabilities are retained.
