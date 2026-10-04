# IMPLEMENTATION STATUS — 2026-10-05 (Australia/Melbourne)

当前交付：P0 源码与能力核对完成；P1 的本地真实日线闭环已集成；继续实现了 P2/Q01 的技术指标子模块。P2 整阶段、P3–P6 尚未完成。所有高级项目保留在矩阵中，没有可点击的空壳功能。未 push、未 deploy、未扩大公开数据、未启用付费工具或实盘。

## 阶段与修改文件

|阶段|结果|文件|验收/下一阶段|
|---|---|---|---|
|P0|源码核对完成，宿主既有门禁失败另列|integrations/vibe-us-crypto-kit/{scripts,manifests,extracted}; HOST_BASELINE.md / CAPABILITY_COVERAGE.md / DEPENDENCY_MAP.md|固定 SHA + 5 blob；142 静态候选、109 local tools、76 MCP、102 API、90 skills、16 frontend routes；差集未分类为 0|
|P1|限定日线模块本地通过；US01 全范围仍部分实现|api/vibe-market.js; services/vibe-bridge/; src/lib/vibe{BridgeProxy,MarketContract}; src/features/vibe-markets/; Arena entry/App slot; scripts/vibe-{local,dev-plugin}|AAPL/SPY/BTC-USDT 实网 loader 与本地 HTTP 均 200；默认关闭、私有访问、错误态、桌面/移动/键盘、关闭 flag 已验证；下一步完成 P2 各卡|
|P2/Q01|技术指标子模块完成，整阶段未完成|bridge/technical.py / worker.py / upstream.py; fixed DTO; research panel|调用固定上游纯计算，完整原始 bars 计算；warmup 不足明确 unavailable；下一模块 US03 公司档案，之后 US04/US05/US06/CR02–04/形态|
|P3–P6|未实现/未开始|仅保留源码出处、依赖与能力状态|没有挂载回测、个人研究、账户、订单、付费或 shell/MCP 配置 API|

## 每项功能状态

|ID|能力|阶段|宿主状态|缺项/来源边界|
|---|---|---|---|---|
|US01|美股 / ETF 标的识别、搜索、自选池|P1|PARTIAL|9 个显式标的可选择；完整上游搜索、自选持久化和标的扩展尚未适配|
|US02|OHLCV、历史区间、数据源降级与来源信息|P1|DAILY_IMPLEMENTED|日线真实闭环；盘中/周/月及更多供应商未实现|
|US03|公司档案、估值、分析师预期|P2|NOT_IMPLEMENTED|源码/模板已经盘点；宿主适配和对应验收尚未完成|
|US04|SEC 文件、三张财务报表、时点安全基本面|P2|NOT_IMPLEMENTED / CONFIG_REQUIRED|SEC/财务适配尚未实现；缺真实联系信息 VIBE_TRADING_SEC_UA|
|US05|13F 机构持仓及环比、ETF 穿透|P2|NOT_IMPLEMENTED|源码/模板已经盘点；宿主适配和对应验收尚未完成|
|US06|新闻、市场筛选、行业比较|P2|NOT_IMPLEMENTED|源码/模板已经盘点；宿主适配和对应验收尚未完成|
|US07|期权链、Black–Scholes、Greeks、多腿到期收益|P3|NOT_IMPLEMENTED|源码/模板已经盘点；宿主适配和对应验收尚未完成|
|US08|DCF、可比估值、三表情景模型|P3|NOT_IMPLEMENTED|源码/模板已经盘点；宿主适配和对应验收尚未完成|
|CR01|加密货币交易对、交易所、现货历史行情|P1|SPOT_DAILY_IMPLEMENTED|OKX BTC/ETH/SOL-USDT 真实现货日线；其他交易所/计价币未实现|
|CR02|OKX / Binance / CCXT 多交易所数据|P2|NOT_IMPLEMENTED|源码/模板已经盘点；宿主适配和对应验收尚未完成|
|CR03|L2 盘口、价差、深度不平衡、冲击成本|P2|NOT_IMPLEMENTED|源码/模板已经盘点；宿主适配和对应验收尚未完成|
|CR04|情绪文本评分与恐惧贪婪指数|P2|NOT_IMPLEMENTED|源码/模板已经盘点；宿主适配和对应验收尚未完成|
|CR05|永续合约回测：费用、资金费、逐仓/全仓、强平|P3|NOT_IMPLEMENTED|永续源码存在，未适配；strict 需真实 funding/mark/保证金历史输入，不能降级冒充|
|CR06|合约证据事件、保证金与对账验证|P3|NOT_IMPLEMENTED|永续源码存在，未适配；strict 需真实 funding/mark/保证金历史输入，不能降级冒充|
|CR07|Funding/Basis、清算图、稳定币流、解锁与 DeFi 收益研究|P4|UNAVAILABLE_DATA / TEMPLATE_ONLY|90 个技能模板已审阅；funding/basis/清算图/on-chain/稳定币/解锁/DeFi 未接数据|
|Q01|技术指标、图表形态识别|P2|PARTIAL|已复用固定源码 RSI/MACD/BB/SMA/EMA/volume；形态识别未适配|
|Q02|通用美股回测、仓位、滑点与收益指标|P3|NOT_IMPLEMENTED|源码/模板已经盘点；宿主适配和对应验收尚未完成|
|Q03|现货策略回测|P3|NOT_IMPLEMENTED|尚无独立现货现金/资产账本；不能用 CryptoEngine leverage=1 代替|
|Q04|因子 IC/IR、分层回测、Alpha Zoo|P3|NOT_IMPLEMENTED|源码/模板已经盘点；宿主适配和对应验收尚未完成|
|Q05|策略浏览、查询、证据缓存与策略发现|P3|NOT_IMPLEMENTED|源码/模板已经盘点；宿主适配和对应验收尚未完成|
|Q06|组合、相关性、风险画像与归因|P3|NOT_IMPLEMENTED|源码/模板已经盘点；宿主适配和对应验收尚未完成|
|Q07|现金流绩效 XIRR/MOIC/DPI/TVPI/TWR/Modified Dietz|P3|NOT_IMPLEMENTED|源码/模板已经盘点；宿主适配和对应验收尚未完成|
|AI01|研究会话、目标、证据、历史与产物|P4|NOT_IMPLEMENTED / OWNER_REQUIRED|先实现真实 owner identity、对象权限、私有存储/预算隔离；ARENA_ADMIN_KEY 仅为配额门|
|AI02|可组合技能、提示词、策略代码生成|P4|NOT_IMPLEMENTED / OWNER_REQUIRED|先实现真实 owner identity、对象权限、私有存储/预算隔离；ARENA_ADMIN_KEY 仅为配额门|
|AI03|多 Agent Swarm、团队预设与重试|P4|NOT_IMPLEMENTED / OWNER_REQUIRED|先实现真实 owner identity、对象权限、私有存储/预算隔离；ARENA_ADMIN_KEY 仅为配额门|
|AI04|定时研究、时区、报告和审计|P4|NOT_IMPLEMENTED / OWNER_REQUIRED|先实现真实 owner identity、对象权限、私有存储/预算隔离；ARENA_ADMIN_KEY 仅为配额门|
|SH01|交易日志诊断 → 影子策略 → 回测 → 报告 → 信号|P4|NOT_IMPLEMENTED / OWNER_REQUIRED|先实现真实 owner identity、对象权限、私有存储/预算隔离；ARENA_ADMIN_KEY 仅为配额门|
|TR01|券商/交易所连接配置与只读账户|P5|NOT_IMPLEMENTED / OWNER_REQUIRED|没有连接账户；先真实身份、只读 connector 能力与 paper sandbox 验证；实盘默认禁用|
|TR02|Paper execution / 实盘订单权限路径|P5|NOT_IMPLEMENTED / OWNER_REQUIRED|没有连接账户；先真实身份、只读 connector 能力与 paper sandbox 验证；实盘默认禁用|
|CTX01|FRED 宏观、网页、文档、论文和预测市场证据|P4|NOT_IMPLEMENTED / OWNER_REQUIRED|先实现真实 owner identity、对象权限、私有存储/预算隔离；ARENA_ADMIN_KEY 仅为配额门|
|EXT01|可选付费数据市场 / 外部 MCP 扩展|P6|DISABLED|付费与任意 MCP 配置保持关闭；未授权资源/数据权利/费用|
|US09|美国财报日历、预期与事件研究|P2|NOT_IMPLEMENTED|源码/模板已经盘点；宿主适配和对应验收尚未完成|
|Q08|Decimal 数值验证与报告审计|P3|NOT_IMPLEMENTED|源码/模板已经盘点；宿主适配和对应验收尚未完成|
|Q09|研究假设、回测关联与策略衰减|P3|NOT_IMPLEMENTED|源码/模板已经盘点；宿主适配和对应验收尚未完成|
|AI05|跨会话记忆与多模态研究|P4|NOT_IMPLEMENTED / OWNER_REQUIRED|先实现真实 owner identity、对象权限、私有存储/预算隔离；ARENA_ADMIN_KEY 仅为配额门|

每项源码根目录和验收见 `integrations/vibe-us-crypto-kit/manifests/capabilities.json`；逐工具/路由/技能决定及理由见 `manifests/coverage.json`。源码存在、方法模板、真实数据、宿主可用四种状态分别记录。

## 测试真实性

- Kit 原版离线 Python：82 passed（新增 host/pinned 检查默认 skip）；原版 Node：51 passed。
- 宿主版 kit Python：87 passed / 3 pinned-only skipped；真实固定模块环境 Python：90 passed。宿主版 Node：51 passed。新增 Vitest：7 passed。
- 固定上游适用测试：175 passed，禁止 socket，属于离线源码测试；不称为实网。
- 实网 loader 契约：AAPL/SPY/BTC-USDT 全 PASS。首次测试真实失败原因 trade_date 不匹配已保留；修复后重测通过。
- 真实本地浏览器/HTTP → BFF → bridge → pinned loader：三标的均 200；技术指标同一 bars/source/asOf。浏览器 offline 故障测试显示 unavailable 并清空图表。
- 宿主 typecheck、build 及 prebuild 的 data/site/header/css/combat/i18n/OG/SEO 检查通过。
- 宿主 unit 仍有原来的 19 文件 / 96 项失败；新增 7 项通过。没有关闭旧测试。
- 宿主 browser-quality-gates：54 failed / 2 passed / 16 skipped。用 c7901191 原入口/App 重建对照，失败集合相同，新增失败为 0。不能声称整站浏览器门禁通过。
- 新模块本地 Chromium：1440×1000 桌面、440×956 移动 viewport，英文/中文、真实数据、键盘与关闭 flag 验证。移动 documentWidth=440；这是视口模拟，不是真机验收。
- 验收日志位于 `integrations/vibe-us-crypto-kit/validation/`；截图位于 `output/playwright/vibe/`；无线上测试/部署声明。

## 配置、数据与回滚

本地可运行 `python3 scripts/vibe-local.py`；它生成临时服务端凭据，绑定 127.0.0.1，不把服务/交易密钥交给浏览器。默认生产代码 flag 关闭。已有 quote/history/published pipeline 未改动；既有设计示例价格也没有被改名成真实报价。

服务端所需名称：VIBE_FEATURE_ENABLED、VIBE_BRIDGE_URL、VIBE_BRIDGE_TOKEN、VIBE_UPSTREAM_AGENT、ARENA_ADMIN_KEY；UI 仅用非密钥 VITE_VIBE_MARKETS_ENABLED；本地临时授权用 VIBE_LOCAL_RESEARCH。SEC 后续缺 VIBE_TRADING_SEC_UA；个人模块缺真实身份系统，不假设填写一个环境变量即可获得 owner identity。部分高级项目缺实际数据 adapter，不能仅靠 API key 或技能文档补齐。

公开数据与付费/实盘保持关闭。回滚先关闭 VITE_VIBE_MARKETS_ENABLED / VIBE_FEATURE_ENABLED，停止本地桥，再 revert 本次本地实现 commit；不要按初始 overlay 回执删除已修改文件，不删除任何个人数据。
