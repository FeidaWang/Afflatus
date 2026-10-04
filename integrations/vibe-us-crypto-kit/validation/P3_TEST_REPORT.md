# P3 工程 / US09 日历验收 — 2026-10-05 Melbourne

宿主 `codex/vibe-us-crypto-integration`，工作区 `/Users/feida/.codex/worktrees/5615/afflatus`。固定源 `251b094320c1f97d1486626d3618113526914d4c`。此前 P2/排版 df8c8630 已获用户授权上线；本报告是新增 P3 本地实现，不代表它已部署到 production。

## 实现范围

有界可取消量化任务与中英文工作台，固定模块共享 DTO：美股/独立现货现金账本、期权实际链/理论定价/到期收益、DCF/可比估值/三表、限定 US academic 因子、组合风险/相关性/归因、固定目录。提供本机现金流绩效/数值验算/报告数值审计/纯衰减/快照对账，以及真实历史风险输入必需的严格永续适配。补齐所选 US 公司 Futu quote-only 财报日历适配。portable overlay 已同步 host adapter、schema 和源锁。

所有原始能力 ID 保留在根 IMPLEMENTATION_STATUS.md。个人持久化、全因子库/全市场策略发现、完整行业/研报数据及附加历史频率没有被标为完成。真实 owner identity 未提供，P4/P5 保留阻塞。

## 验证层次

|层次|实际结果|证据与含义|
|---|---|---|
|宿主 Python integration|142 passed|p3-host-python.log；合成 OHLCV/风险/财务算例、模拟 transport、实际固定 helper；不冒充实网|
|portable overlay 默认环境|91 passed / 51 skipped|p3-overlay-python.log；host-only tests 在无宿主路径时明确 skip，源 pin 拒绝未验证的合成 worker|
|所选 pinned upstream|943 passed|p3-upstream-offline.log；socket connect/connect_ex/create_connection 全部拒绝，纯量化/风险/期权/估值/对账/日历 mock transport 验证|
|Node BFF|51 passed|p3-proxy.log；既有行情/研究代理保护继续通过|
|Host feature Vitest|28 passed|三组 tests/vibeMarket、vibeResearch、vibeQuant；共享协议、private/default-off、期限/配额/固定路由、实际 Python Decimal fixture 的跨语言校验、半偶数舍入边界、来源/取消/旧结果/错误状态|
|全站 Vitest|1869 passed / 96 failed，19 failed files|p3-unit-comparison.json；对比 P2 的 1857/96，无新增或移除失败名称。不是全站通过|
|类型/构建与发布门禁|通过|typecheck；build 的 data/site/header/CSS/combat/i18n/OG/SEO 检查均通过；15 个 fixed-locale + 456 个 novel 文档，23 个 route SEO 文档|
|真实 localhost host→BFF→worker|六条成功|p3-live-localhost.json；不使用合成/缓存兜底，不扩大生产公开权限|
|真实浏览器|模型/回测/取消/密钥头/排版通过|p3-browser-cancel.json、p3-browser-rails.json；Chromium 视口模拟，不是真机或 P3 生产验收|

所选上游文件：quantlib/valuation 的 DCF/comps/threestatement；quantlib options、IV tolerance、risk、attribution/nonfinite、performance、fundmath；options chain/payoff/tool；financial rigor/Benford；report audit/signed/accounting parentheses；crypto engine、perpetual risk、Binance reconciliation；factor analysis core/academic samples；Futu extended reads。未运行或声称全部 upstream 测试。

Host Python 一条 Starlette/httpx deprecation warning 保留，不通过安装额外库掩盖。此前 browser quality gate 的基线失败见 P2 报告；本轮没有宣称修复或重新通过那组既有门禁。

## 六条真实本地链

- AAPL 日线 SMA 回测：完整 cash/fill/equity、费用与同窗口 benchmark，BFF BigInt 校验通过。
- OKX BTC-USDT 现货与 Binance BTC-USDT 现货：各自实际数据、明确 venue/日线时区、基础币 volume、独立账本，不能混成同一时间边界或永续。
- AAPL/MSFT 固定权重组合：相同 currency/calendar，真实相关性/风险与 Carino 归因输出。
- AAPL Yahoo options chain：实际 calls/puts，理论模型 false，未知 quote timestamp 仍为 null。
- 六只 US equities academic_strev：实际股票历史、lag、IC/IR、净费用分层与 chronological split。

这六条均返回 create HTTP 202、final HTTP 200、complete/available 与固定 commit/request hash；历史源还含 bars SHA256。网络源恢复/变化后的结果未被包装成可重复固定市场快照；相同固定输入的可复现性由离线 fixture 验证。

初次实网检查的失败另存 p3-live-initial-failures.json：spot BFF 的 UPSTREAM_SCHEMA 和验证脚本把 Decimal 参数写成 JSON 数字导致 INPUT_INVALID。发现并修复：Binance source 名称、Decimal scientific zero 的固定点序列化、JS 净值在总额上执行一次 half-even；脚本改用十进制字符串。修复后六条重跑成功。增加了对应跨语言/零仓位/舍入测试，不删除失败证据。

## 浏览器与配置闸门

欧式标准算例 S/K=100、T=1、r=.05、vol=.2、q=0 返回 10.450583572185565；实际 AAPL 回测在 UI 显示 complete、ledger 与终值。真实运行后 DELETE 返回 HTTP 200/status cancelled，旧结果空；POST/DELETE 浏览器 header 名称中无 Authorization 或 x-arena-key。

EN/ZH × 320/375/440/1440：研究容器、main、footer 与 Logo 左/语言键右边界相同；copyright 与最后社会链接的右边对齐，最大浮点差 0.008 px；document horizontal overflow=0。表格只在自己的滚动区域滚动，长 hash 文本换行。生产默认 flags 的构建不挂载行情/量化 UI；私有 API 在未启用时拒绝。

日历通过真实 pinned `sdk.get_earnings_calendar` 加模拟 quote transport 验证：US market、明确配置/日期、公司过滤、DataFrame 投影、异常日期拒绝和 context 关闭；交易 context 与读取用户交易配置会使测试失败。真实本地 BFF 在没有 OpenD 时返回 US_CONNECTOR_REQUIRED；SEC 返回 SEC_CONTACT_REQUIRED，均不伪造调用成功。

## 未完成的外部条件

- 真实 SEC 运营联系人；没有伪造 email 或使用 example.com。
- 实际兼容 SDK/OpenD 美股行情 gateway；没有实网财报日历成功声明，也不借用 Yahoo earnings estimates。
- Binance 永续真实历史 funding/mark/maintenance tiers、有效期与合约说明；只完成严格适配和合成离线验收。Float 研究引擎/8H 极值不证明真实资产精度或盘中强平次序。
- Owner identity/object authorization；现金流、报告、假设写入与账户等只在本机数值 CLI 或 unavailable 边界，不能从 shared admin key 推断多用户隔离。
- 完整 US sector/研报/更多因子与历史频率的实际数据；无国内分支替换、付费/MCP/实盘兜底。

配置、参数、边界和回滚详见 ../docs/P3_QUANT_GUIDE.md。关闭 flags + 停止 bridge 会取消子进程/清除内存任务；本轮没有个人数据库、云资源或订单。
