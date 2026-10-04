# P2 host acceptance — 2026-10-05 Melbourne

本轮完成 P2 可推进的适配与工作台。SEC 模块已通过离线适配验证，实网缺真实运营联系人；US09 尚无真实 US earnings connector，US06 的完整行业/研报数据范围未实现。因此不把 P2 整阶段标成完成。用户明确要求 P4/P5 本轮继续阻塞；P3–P6 原项目保持逐项状态。未 push、未 deploy、未启用付费或实盘。

## Implemented surface

|模块|实际来源/行为|限制|
|---|---|---|
|Company profile|固定 Yahoo US 工具；上市身份、估值、财务快照、分析师 EPS/收入预期与评级|当前快照，不是历史时点；供应商时间未知时为 null；listing/quote/financial currency 分开|
|SEC filings / financials|固定 SEC 客户端/概念表；截止日内最新披露事实，保留 unit/start/end/filed/accession/form|只有合成离线验收；剔除未来重述/YTD，不混年度季度，不推算 Q4，不声明完整 ratios 产品|
|13F / ETF|固定 Berkshire/Bridgewater CIK 完整机构组合语义；N-PORT 披露适配，新增 IVV|缺联系人；显示排名页、披露滞后、修订链/上一期缺失，不推断实时持仓或基金结构|
|News / screener|Yahoo 美股新闻与固定词典；Eastmoney 显式 US universe、涨幅前 20|抓取时间不当作供应商时间；成交量/额单位未知；真实暂时失败保留|
|Industry|Yahoo assetProfile 的真实 US sector/industry，比较已接入池内同板块股票|四只 US equities，行业可能不同；不是全行业、资金流或美股研报；上游 A 股分支排除|
|Multi-exchange daily / L2|OKX native 与 Binance CCXT；BTC/ETH/SOL-USDT spot；明确交易所、10 层盘口、10,000 USDT 冲击模拟|基础币/USDT 分开；交易所/本地时间分开，旧盘口拒绝、部分填充标注；无任意交易所/fallback|
|Sentiment|固定英文词典的浏览器本地评分；新闻用固定 Python helper；Alternative.me Bitcoin index 保留 API 时间|无模型/否定语义；不是所选币种或美股情绪；指数旁置归属|
|Q01 patterns|固定纯 helper；完整输入先计算，蜡烛图显示末 80 根|中心峰谷使用确认快照，明确回顾性；缺 warmup 无填充，不是可交易无 lookahead 信号|

13 个显式标的：7 US/ETF + 两交易所各 3 现货对。现货完整开闭时间与 OKX UTC+8 / Binance UTC 日线边界通过验证；未知单位不填造。研究模块由一个 JSON DTO 固定 scope/source/section/field/reason/note，Python/BFF/浏览器共享。研究接口始终私有，公开日线授权不开放研究。未知工具/URL/owner/参数拒绝，错误不转发上游私密文本。

## Test layers and evidence

|层级|结果|证据|
|---|---|---|
|Host kit Python|105 passed，包括 11 项新增 P2 合成 fixtures / mocked transport + 固定 helper|p2-host-python.log；../tests/test_research_host.py|
|Fixed upstream P2|366 passed，socket 禁止；离线源码验证|p2-pinned-offline.log|
|Host Node proxy|51 passed|p2-host-proxy.log|
|Focused Vitest|16 passed，含 scope/DTO、凭据、私有门、截止日、词典 ties-to-even、清空与晚返回取消|p2-new-unit.log；../../../tests/vibe{Market,Research}.test.js|
|Typecheck / build|PASS，含 prebuild/data/site/header/CSS/combat/i18n/OG/SEO|p2-typecheck.log；p2-host-build.log|
|Real worker network|profile/news/screener、两交易所盘口、Bitcoin index；AAPL/SPY/IVV 与两交易所 BTC 日线成功|p2-live-research.json/.log；p2-live-industry.json|
|Real localhost HTTP/BFF|profile/news/books/index 与 industry 成功；SEC 返回配置缺失|p2-live-http.json；p2-live-http-followup.json|
|Entire host unit|1857 passed / 96 failed / 19 failed files；与原 1848/96 基线相同失败集，无新增|p2-host-unit.json/.log；p2-unit-comparison.json|
|Existing browser quality|54 failed / 2 passed / 16 skipped；与原基线相同失败集，无新增|p2-host-browser-gates.log；p2-browser-gates-comparison.json|
|New-feature browser|真实 Chromium 桌面/移动、中英文、来源、键盘、请求无服务端凭据、故障清空；具体值见下表|p2-browser-*.log；../../../output/playwright/vibe/p2-*|

实网报告只保存身份、状态、来源、时间和行数，没有联系人/服务器秘密/完整价格快照。离线 fixtures 与实网明确分层。首次 HTTP screener 返回 200 + SOURCE_UNAVAILABLE，后续真实请求 20 行 available；两份结果均保留，不把暂时失败改写为成功，也不增加替代源。

## Browser checks

|场景|实际结果|证据|
|---|---|---|
|Desktop English profile 1440×1000|Yahoo 来源可见，1 张图，documentWidth=1440|p2-browser-profile.log；p2-desktop-profile.png|
|Keyboard SEC|Tab 聚焦 Load research、Enter 加载；SEC_CONTACT_REQUIRED，SEC 来源可见；请求 Authorization/x-arena-key 均 false|p2-browser-keyboard-sec.log|
|Mobile Chinese OKX / Binance 440×956|各 23 行盘口/模拟数据，显式 exchange、CCXT 来源可见，documentWidth=440|p2-browser-mobile-{okx,binance}.log；对应截图|
|Mobile Bitcoin index|Alternative.me 归属可见，Bitcoin 范围说明可见，1 张日线图，documentWidth=440|p2-browser-fear-greed.log；p2-mobile-zh-fear-greed.png|
|Flag off built preview|research section=0、market/research requests=0，原 Add a stock=1|p2-browser-flag-off.log|
|Actual browser offline|切换历史区间并加载研究后：chart=0、research tables=0、旧来源链接=0、旧价格=false，documentWidth=440；恢复网络|p2-browser-offline.log；p2-mobile-zh-offline.png|

本地移动验收仅为 Chromium 视口模拟，未声称真机、生产或整站全绿。原宿主门禁失败没有删测试/放宽断言。截图区域捕获包含宿主原有 sticky header；研究表格在自身区域横向滚动且可键盘聚焦，页面不横溢。

## Remaining acceptance and configuration

- SEC filings/financials/13F/N-PORT：缺真实 `VIBE_TRADING_SEC_UA`。必须由运营者提供真实身份和联系邮箱；缺失/示例域名时在 worker 和 HTTP 入口返回 `SEC_CONTACT_REQUIRED`，不发 SEC 请求。适配/fixture 通过不等于实网验收。
- US09：固定源码的美国财报日历需要实际 Futu/OpenD 或其他支持的 US connector。当前未连接/未实现；分析师盈利预期不代替财报日历。
- US06：完整行业 universe、资金流和 US research reports 没有适用数据适配；当前仅承诺明确 US 新闻、筛选与池内比较。
- P4/P5：真实 owner identity、对象权限和私有存储仍缺，按用户范围保留阻塞；共享配额 key 不当作身份。P3/P6 未扩展。

本地预览：`python3 scripts/vibe-local.py`，http://127.0.0.1:5175/arena.html；先检查已有端口。它只在 loopback 开启私有临时授权。生产 UI/server flags 默认关闭；研究数据未公开。先关 flags，再停止本地桥并 revert P2 提交可回滚。

数据与契约参考已核对：[SEC developer resources](https://www.sec.gov/about/developer-resources)、[Alternative.me index/API/attribution](https://alternative.me/crypto/fear-and-greed-index/)、[Binance spot REST klines](https://github.com/binance/binance-spot-api-docs/blob/master/rest-api.md)。固定源码 SHA、原 MIT notices 与扩展 blob lock 保持一致；未导入上游字体/桌面前端。

日志只去除了行末空白；测试数量、失败记录和实际结果未改写。
