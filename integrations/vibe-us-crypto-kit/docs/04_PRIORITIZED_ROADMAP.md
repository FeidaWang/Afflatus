# 按优先级实施：先形成可验收闭环，再逐项补齐

每个阶段只改必要文件，完成测试后再进入下阶段。`manifests/capabilities.json` 的范围不能因为分阶段而被偷偷删除；未实现的项目始终保留状态和阻塞原因。优先复用上游实现，不重写所有量化数学，不把所有业务塞进一个 Agent。

## P0 · 固定源码、基线与完整功能盘点

读取项目当前 AGENTS/CLAUDE 指引，检查 git diff，记录 `package.json`、路由清单和现有股票页面入口。不要根据旧记忆使用 Next.js/Prisma，也不要假定旧 QuantAgent 分支已合并。

运行 bootstrap 和 inventory，核对 SHA 与 blob；在隔离环境补运行时工具注册清单、API OpenAPI 路由、前端页面和 skills 清单。静态未知项先归类，不删掉以“通过验收”。输出 `HOST_BASELINE.md`、`CAPABILITY_COVERAGE.md`、`DEPENDENCY_MAP.md`。

验收：每个能力有保留/条件保留/排除/不可用理由；记录依赖和许可证；现有 `npm run typecheck`、`npm test`、build/站点质量检查结果留档。基线本来失败的与此次引入失败分开记录。

## P1 · 日线接入，保留现有实时报价

审阅并复制 overlay 的新文件，页面按现有入口 lazy mount。先接 US 股票与 ETF，再接 OKX Crypto spot。上游 loader 真实网络测试必须在本地完成；没有数据只显示 unavailable，不加“开发兜底假数据”。原有 Finnhub quote、history 缓存和访问策略不可覆盖。

验收：AAPL/SPY 与 BTC-USDT 各一条真实数据链；公开/私有开关、错误和来源展示；数据桥不可访问香港/A股/订单/文件/任意URL；关闭 feature flag 不改变旧站。新增代码测试先跑本包，再跑宿主门禁。

## P2 · 行情研究工作台

迁移 verified US stock profile/SEC/财务/13F/ETF、新闻筛选、技术指标和 pattern recognition；Crypto 加盘口/恐惧贪婪、更多明确交易所的现货行情。根据实际 UI 需要 lazy-load 蜡烛图库，保持全站字体、卡片、顶部栏和色彩变量；本包初始折线组件可替换但 DTO 不漂移。

验收：逐工具确认 US/Crypto 分支、数据权限及 API key；每张卡都有 source/asOf/quality；指标 warmup 和公式与固定版本一致；图表无重建泄漏、移动端不横溢。所需财经数据没有实现时展示“需要数据源”，不偷换国内市场数据。

## P3 · 回测、因子、期权、组合

独立有界 worker，不在 UI 请求内跑长回测。用 registry 限制仅 US/crypto 的运行配置。美股调用 GlobalEquityEngine(market='us')；先补费用和借券等缺失假设，再显示可比业绩。现货账本与永续模型分别测试；严格永续需要真实 funding、mark、维护保证金等相应历史字段。

迁移 Alpha Zoo/因子/策略证据；按照 metadata 过滤 universe，不把 GTJA191 全塞进美股，不把股票基本面因子运行在 crypto。期权模型与真实市场链分离；DCF 缺数据拒绝运行。组合禁止默认将 USD/USDT 或不同币种直接相加。

验收：同一固定数据、版本、seed、策略有可复现结果；无 lookahead；基准、费用、持仓和完整成交账本相互校对。金钱用 decimal/fixed-point 保存账本，不能简单沿用行情 JSON float 当生产资产账。

## P4 · 私人 AI 研究与 Shadow

引入真实 owner identity、数据隔离与 object-level authorization 后才接 session/run/report。先单 Agent，后 Swarm；已有 research/quant 模块能复用则复用。统一 BudgetPolicy 控制模型、tokens、最大工具调用、每任务费用、重试、并发与每日总额。普通行情请求不得调用大模型。

迁移 journal → shadow extraction → backtest → report → scan；保护上传 CSV 和持仓；Shadow 不等于 paper broker。网页/文档输入属于不可信数据，策略执行另开无网络/受控网络且无密钥的隔离容器。定时研究保存 job 状态、时区与幂等键，UI 轮询即可，第一版不强制常驻 socket。

验收：用户A不能读用户B的 sessionId/runId/报告；任务可停止；预算耗尽停止；模型无法通过用户输入改 MCP server、shell、文件根路径或路由白名单。发布报告需要显式动作和脱敏检查。

## P5 · 账户与模拟交易，实盘仍禁用

核实各 connector 的真实能力矩阵：数据读取、真实 paper sandbox、只读 live、可授权 live。IBKR 本地网关和各种 OAuth/session 的部署条件不能假装都是远程无状态 API。先接只读，再独立 paper ledger；不得用一个 shared admin key 模拟多用户鉴权。

验收：paper 与 live 的 host/accountId/context 明确不同；所有订单幂等、数量/价格上限、持仓风控、审计和 kill switch；任何未知 connector 状态 fail closed。用户此次仅请求集成看板，没有授权实盘下单，不开 live 开关。

## P6 · 可选扩展、公开发布与回滚

QVeris/付费数据/额外 MCP/更多交易所按需启用；先核对数据使用权和花费。构建 staging，跑 host 所有质量门禁、权限测试、故障演练；让新增功能受配置控制。公共页面只呈现获授权的数据与脱敏研究结果。生产发布、扩大可见范围、实盘或新增付费资源必须由用户决定。

完成后输出：实际迁移列表、未支持及原因、测试日志、来源版本、所需环境变量名称（不输出值）、preview信息（仅实际生成时）、回滚步骤。不得写“已上线”除非确实完成了有授权的部署。
