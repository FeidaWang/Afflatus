# financial-services 上游审计与迁移映射

## 结论与审计边界

本报告仅依据本次指定的 `https://github.com/FeidaWang/financial-services` 仓库读取结果编写，不使用历史会话或个人记忆。该仓库是 `anthropics/financial-services` 的 fork。完整 Git tree 与实际 checkout 均固定在：

**`574ed3624aebd0418c7e96cd101262f30210ab26`**。

上游是一套金融服务研究、建模、基金运营工作流的 **agent prompt、skills、commands、MCP 配置及部署/校验参考脚本**。它提供大量专业方法与编排设计，但没有可以直接嵌入 Arena 的股票行情服务、交易撮合引擎、账户账本或完整收益评估系统。迁移应把研究纪律转换为实际可运行的数据契约、计算模块、时间隔离、风控和审计流水，而不是把 Markdown 文件复制到网站并宣称交易系统已升级。[仓库 README](https://github.com/FeidaWang/financial-services/blob/574ed3624aebd0418c7e96cd101262f30210ab26/README.md)

本次研究层已提供新的零依赖 ESM 实现：WACC、三情景 FCFF DCF、同业比较、财报差异分析、证据/研究文档验证、可证伪投资论点及修订、预测概率校准、策略绩效、离线反馈提案、晨间摘要。商业数据连接器仅记录可配置能力与许可状态；上游 URL 的存在不代表本系统已获得凭证、行情授权或发布权。

## 1. 可复核的仓库清单

通过 GitHub 插件读取仓库元数据、`refs/heads/main`、递归 Git tree，并克隆同一提交。Tree 返回 `truncated:false`；共 609 个 tree/blob 条目，363 个文件、284 个不同 blob。实际 checkout 与 GitHub 提交 SHA 一致。

| 内容 | 实际数量/范围 | 含义 |
| --- | --- | --- |
| 全部受版本控制文件 | 363 | 不含 `.git` 元数据 |
| Markdown | 241 | 工作流、知识、说明为主体 |
| JSON | 39 | manifests、MCP、hooks、事件示例 |
| YAML | 40 | 10 个主 agent + 30 个叶子 worker |
| Python | 17 | 部署辅助、校验、版本控制、Office bootstrap 等；包含同步副本 |
| Shell / PowerShell / MJS | 5 / 3 / 1 | 主要为部署及 Microsoft 365 管理工具 |
| 插件 manifests | 19 | 10 agents、6 verticals、2 partners、1 Microsoft 365 安装插件 |
| Slash command Markdown | 50 | 金融、合作方与安装管理命令合计 |
| Vertical skill 源 | 49 | 六个垂直插件 |
| Partner skills | 11 | LSEG 8，S&P Global 3 |
| Agent 中打包的 skill 副本 | 51 | 大多数与 vertical 源相同；3 项缺对应源目录 |
| 根许可证 | Apache-2.0 | S&P Global 部分另保留同许可证和 Kensho 归属说明 |

完整源快照位于本次工作目录下的 `upstream-financial-services`，未向该仓库推送提交、安装插件或部署 managed agents。

## 2. 应吸收的 18 项优势及具体移植方式

优先级表示对 Arena 的实现顺序；不表示上游已经具有相应运行时代码。

| 优先级 | 上游可取之处与精确源路径 | Arena 中的具体落点 |
| --- | --- | --- |
| P0-1 | `plugins/agent-plugins/market-researcher/agents/market-researcher.md`：每个数字有来源，无来源明示缺失 | 每个研究事实带 source IDs；数值事实带单位/来源，缺失不补零；`validateEvidence`/`validateResearch` |
| P0-2 | `plugins/partner-built/spglobal/skills/tear-sheet/SKILL.md`：查询结果先落结构化中间文件，跨报告复用同一数据 | 服务端冻结行情/事实快照；网页、模型、报告读取同一 snapshot，避免重复查询产生版本差异 |
| P0-3 | `managed-agent-cookbooks/*/subagents/*reader.yaml`：外部文本不可信，只读叶子与结构化提取 | 文档/新闻只作为输入数据；事实提取与决策、风控、写账能力分离；输出用实际 schema 验证 |
| P0-4 | `managed-agent-cookbooks/README.md`：深度 1 委派与单独 writer | 固定 analyst → critic → risk → paper execution 阶段；只有事务提交模块能写账户；避免递归 agent 与任意工具执行 |
| P0-5 | `plugins/vertical-plugins/fund-admin/skills/gl-recon/SKILL.md` 与 `break-trace/SKILL.md`：独立对账、差异分类、回溯源交易 | 成交、现金、持仓、已实现/未实现 P&L、手续费分别重算；重复/缺失/价格时点/数量差异有显式原因 |
| P0-6 | `fund-admin/skills/nav-tieout/SKILL.md`：独立重算 NAV，不以被测报表自证正确 | 用不可变成交账本重建 equity，外部入金不计收益；`evaluateStrategy` 使用流量调整后的财富指数 |
| P0-7 | `financial-analysis/skills/comps-analysis/SKILL.md`：期间、单位、口径、输入与公式分离 | 同业比较规范化单位，拒绝币种/TTM-NTM/期末/GAAP-调整后混用；负分母显示 NM，排除误排名 |
| P0-8 | `financial-analysis/skills/dcf-model/SKILL.md`：显式现金流、情景、敏感性完整重算 | `calculateDCF`：FCFF、净债/现金只计一次、稀释股份、三个场景、25 格完整重算；无数据不猜值 |
| P0-9 | 同一 DCF skill 的资本成本与 equity bridge 关注点 | 新 `calculateWACC` 使用市场 equity/gross debt 权重，修正上游净债权重示例问题；净现金留在权益桥接 |
| P1-1 | `equity-research/skills/earnings-analysis/SKILL.md`、`earnings-preview/SKILL.md`、`model-update/SKILL.md`：actual/consensus/prior 的差异驱动 | `analyzeEarnings` 直接计算差额、surprise、零分母/负预期处理；保留不同会计口径不可比较状态 |
| P1-2 | `equity-research/skills/thesis-tracker/SKILL.md`：论点可证伪，对反证与正面证据同等关注 | `createThesis`/`updateThesis`：pillar、invalidation、风险、conviction、状态转换、revision 历史；反证触发 challenged |
| P1-3 | `equity-research/skills/catalyst-calendar/SKILL.md`：事件类型、时点、结果归档 | 催化剂保留 scheduledAt 与 availableAt；未来事件可以已知，但未来公告不能泄漏到历史快照；实际结果独立归档 |
| P1-4 | `equity-research/skills/morning-note/SKILL.md`：紧凑、按影响组织的晨间信息 | `buildMorningBrief` 从真实传入数据组装摘要；行情状态、事件和论点变化可见，不自动编造买卖建议 |
| P1-5 | `equity-research/skills/idea-generation/SKILL.md`：明确筛选条件，区分候选与结论，跟踪命中率 | 用版本化 profile/cohort 记录研究候选和概率预测；分离动作 confidence 与标的上涨概率 |
| P1-6 | `private-equity/skills/portfolio-monitoring/SKILL.md` 与 `returns-analysis/SKILL.md`：预算差异、现金与回报分解 | 股票系统采用成本后 return、drawdown、benchmark、入金调整；短历史不强行年化，日收盘序列才允许 Sharpe/vol |
| P1-7 | 研究工作流的模型更新与复核思想 | `calibrateForecasts`/`proposeFeedback`：已到期已结算样本、Brier/log loss/reliability、冻结训练截止、新版本候选与后续样本验证 |
| P2-1 | `financial-analysis/.mcp.json`、`plugins/partner-built/lseg/CONNECTORS.md`：统一供应商入口与精确工具分类 | 服务端 connector registry 以 not_connected、requiresEntitlement 与 licensed-evidence-import 明示状态；按行情、共识、财报、新闻、文档列用途，不把 URL 当成认证成功 |
| P2-2 | `scripts/check.py`、`sync-agent-skills.py`、GitHub workflows：源与打包副本一致、引用检查、版本交付 | 校验交付包所有 JSON 与 MJS；保留完整上游文件清单与固定版本，测试运行行为并记录构建结果，不分发或执行有缺陷的上游部署器 |

与最新股价和 AI 模拟比赛直接相关的核心价值集中在证据、可比性、受控流程和独立计算。IB、PE、基金运营中的行业专用模块不应全部塞入实时交易主界面；其可重用部分已在上述数据契约、论点、估值和审计逻辑中体现。

## 3. 全部 vertical 与 partner 能力覆盖

下表保留上游完整能力清单，说明适用与不直接迁入的原因，避免把“吸收优点”误写成“所有模板都已经成为股票交易功能”。

| 目录 | 上游 skills | 本次产品映射 |
| --- | --- | --- |
| `equity-research` | catalyst-calendar、earnings-analysis、earnings-preview、idea-generation、initiating-coverage、model-update、morning-note、sector-overview、thesis-tracker | 主研究工作流。计算、证据、论点、事件与摘要已由研究模块提供；完整机构报告与行业资料需要实际数据供应商和服务编排。 |
| `financial-analysis` | 3-statement-model、audit-xls、clean-data-xls、competitive-analysis、comps-analysis、dcf-model、deck-refresh、ib-check-deck、lbo-model、ppt-template-creator、pptx-author、skill-creator、xlsx-author | 采用财务口径、公式、估值、模型 QC 与输入清理。LBO、Office 排版、PPT 模板生成、skill 创建不是当前股票纸上交易运行时功能。 |
| `fund-admin` | accrual-schedule、break-trace、gl-recon、nav-tieout、roll-forward、variance-commentary | 移植账户重算、差异诊断、滚动期一致性与成本分解；不声称能操作真实基金总账或 LP 报表。 |
| `investment-banking` | buyer-list、cim-builder、datapack-builder、deal-tracker、merger-model、pitch-deck、process-letter、strip-profile、teaser | 借用公司画像、数据包、事件跟踪、比较分析与材料 QC；CIM、并购流程函和买家外联不属于实时股票系统。 |
| `operations` | kyc-doc-parse、kyc-rules | 借用规则与提取分离、受控枚举和异常升级；纸上交易不引入无必要的身份资料收集，也不宣称具备真实券商开户能力。 |
| `private-equity` | ai-readiness、dd-checklist、dd-meeting-prep、deal-screening、deal-sourcing、ic-memo、portfolio-monitoring、returns-analysis、unit-economics、value-creation-plan | 采用投资论点/反证、经营 KPI、情景回报、审查记录；私募募资/交易接洽/运营计划保留为未来专用工作区。 |
| `partner-built/lseg` | bond-futures-basis、bond-relative-value、equity-research、fixed-income-portfolio、fx-carry-trade、macro-rates-monitor、option-vol-analysis、swap-curve-strategy | 采用 equity 共识/财务/历史价格连接器分层；宏观/利率可扩展为研究输入。债券、外汇远期、swap、期权 Greeks 需要授权源与独立产品建模，未假装本地实现其专有分析服务。 |
| `partner-built/spglobal` | earnings-preview-beta、funding-digest、tear-sheet | 采用“先源数据落盘、后计算复核、再生成呈现”、NTM/TTM区分、数字跨产物一致性；不假称已接通 Capital IQ/Kensho。 |

10 个 agent 包装器分别是 pitch-agent、market-researcher、earnings-reviewer、meeting-prep-agent、model-builder、gl-reconciler、kyc-screener、valuation-reviewer、month-end-closer、statement-auditor。Arena 采用其研究/复核/写入的分工，不为每个角色强制调用一个昂贵模型。[Agent wrappers](https://github.com/FeidaWang/financial-services/tree/574ed3624aebd0418c7e96cd101262f30210ab26/plugins/agent-plugins)

另外，meeting-prep-agent 中的 `client-report`、`client-review`、`investment-proposal` 三项存在打包副本，但该提交没有对应 `vertical-plugins` 源；这是同步完整性缺陷，而非新增可直接使用的第三个财富管理 vertical。

## 4. 实际连接器清单与许可状态

README 的“11 data connectors”与表格不同。README 表格及文件意图包含 **12 个供应商条目**；core `.mcp.json` 本身语法无效，不能将它描述成“12 个可用连接器”。以下 URL 是仓库声明，未在本次任务中向商业 MCP 发起数据请求，也未验证本账户订阅或内容再分发授权。

| 供应商 | 仓库声明 URL | 本次迁移状态 |
| --- | --- | --- |
| Daloopa | `https://mcp.daloopa.com/server/mcp` | 能力声明；未凭此获得凭证或许可 |
| Morningstar | `https://mcp.morningstar.com/mcp` | 同上 |
| S&P Global/Kensho | `https://kfinance.kensho.com/integrations/mcp` | 同上 |
| FactSet | `https://mcp.factset.com/mcp` | 同上 |
| Moody's | `https://api.moodys.com/genai-ready-data/m1/mcp` | 同上 |
| MT Newswires | `https://vast-mcp.blueskyapi.com/mtnewswires` | 同上 |
| Aiera | `https://mcp-pub.aiera.com` | 同上 |
| LSEG | `https://api.analytics.lseg.com/lfa/mcp` | 同上 |
| PitchBook | `https://premium.mcp.pitchbook.com/mcp` | 同上 |
| Chronograph | `https://ai.chronograph.pe/mcp` | 同上 |
| Egnyte | `https://mcp-server.egnyte.com/mcp` | 同上 |
| Box | `https://mcp.box.com` | 同上；新增片段使当前 JSON 结构损坏 |

依据：[核心 MCP 配置](https://github.com/FeidaWang/financial-services/blob/574ed3624aebd0418c7e96cd101262f30210ab26/plugins/vertical-plugins/financial-analysis/.mcp.json)、[LSEG 工具分类](https://github.com/FeidaWang/financial-services/blob/574ed3624aebd0418c7e96cd101262f30210ab26/plugins/partner-built/lseg/CONNECTORS.md)。所有密钥只能由服务端注入；浏览器不应直接调用这些商业源并暴露授权信息。上游开源许可证覆盖模板代码，不自动覆盖第三方金融数据。

## 5. 已复现或静态确认的上游缺陷

### 5.1 核心 `.mcp.json` 不能解析

Egnyte 对象后、Box 属性前缺逗号；Box 区块闭合也不完整。对全部 39 个 JSON 执行解析，唯一失败为该文件：`Expecting ',' delimiter: line 47 column 5 (char 1100)`。因此直接复制会让核心连接器包不能正确载入。[源文件](https://github.com/FeidaWang/financial-services/blob/574ed3624aebd0418c7e96cd101262f30210ab26/plugins/vertical-plugins/financial-analysis/.mcp.json)

`scripts/check.py` 的 JSON globs 只检查 marketplace、plugin manifests 和 steering 示例，不包含 `.mcp.json`。其“零错误”不能证明所有配置有效。新工程的配置检查必须覆盖实际读取的每个配置文件。

### 5.2 Schema 验证写在注释中，但没有接入工作流

`deploy-managed-agent.sh` 的头部称 reader 输出会经过 validation wrapper；`validate.py` 的说明也称 harness 会调用它。然而实际部署逻辑执行 `del(.output_schema)`，没有提取并写出 schema，也没有调用 `validate.py`；`orchestrate.py` 没有 reader 输出验证环节。`test-cookbooks.sh` 反而只确认发出的 API payload 不含 `output_schema`。这是一段示例意图，不是可依赖的生产级隔离。[部署脚本](https://github.com/FeidaWang/financial-services/blob/574ed3624aebd0418c7e96cd101262f30210ab26/scripts/deploy-managed-agent.sh)、[validator](https://github.com/FeidaWang/financial-services/blob/574ed3624aebd0418c7e96cd101262f30210ab26/scripts/validate.py)

新模块在函数入口实际执行校验，并返回/抛出具体失败；服务层必须根据失败停止后续阶段，而不是仅向模型提示“请遵守 schema”。

### 5.3 Handoff 的正则对合法嵌套 JSON 解析失败

`orchestrate.py` 明示 `REFERENCE ONLY`，并使用非贪婪 `\{"type":\s*"handoff_request".*?\}`。对于正常的 `payload:{...}`，它在 payload 的首个右花括号就停止，缺少外层 `}`，`json.loads` 失败。用实际规定的 `{type,target_agent,payload:{event,context_ref}}` 对象已重现。此外它对单个 SSE text delta 匹配，没有缓冲跨 delta 的完整对象；上游也提醒外部文档可伪造文本形式的 handoff。[编排脚本](https://github.com/FeidaWang/financial-services/blob/574ed3624aebd0418c7e96cd101262f30210ab26/scripts/orchestrate.py)

迁移使用服务端确定类型的事件/函数调用，目标 allowlist、长度限制和 schema 校验，不从模型任意自由文本中正则猜测执行请求。

### 5.4 三个 bundled skills 找不到原始源

`meeting-prep-agent/skills/client-report`、`client-review`、`investment-proposal` 没有对应 vertical skill 源。独立引用检查未发现 agent YAML 的文件引用缺失；递归 bundle 内容比对发现的同步问题正是这三个“无源副本”。`check.py` 的 `filecmp.dircmp` 同步检查本身只检查当前目录层的 diff，不递归检查全部子目录，所以未来 reference/script 漂移也可能漏报。[check.py](https://github.com/FeidaWang/financial-services/blob/574ed3624aebd0418c7e96cd101262f30210ab26/scripts/check.py)

### 5.5 DCF Excel validator 有被警告掩盖的失效

`validate_dcf.py::_check_wacc_range` 调用 `self.workbook_values.get('WACC')`，但当前运行环境的 openpyxl Workbook 没有 `get` 方法；异常被转换为 warning，整体状态仍只由 errors 决定。公式检查读取缓存值，缓存为空时不会执行公式，也可能报告未发现公式错误。因此其 `PASS` 不能证明模型已重算或 WACC 检查实际完成。[源 validator](https://github.com/FeidaWang/financial-services/blob/574ed3624aebd0418c7e96cd101262f30210ab26/plugins/vertical-plugins/financial-analysis/skills/dcf-model/scripts/validate_dcf.py)

本次直接计算全量数值，不依赖 Excel 缓存；分析测试使用独立列出的数学表达式校验结果。未将该 validator 当作服务器风控门。

### 5.6 不宜照搬的金融示例规则

DCF skill 的 WACC 示例写成 `Debt Weight = Net Debt / EV`；净现金公司会得到负债务权重。新 `calculateWACC` 明确采用 supplied market equity/gross interest-bearing debt，现金在 DCF equity bridge 单独处理，并拒绝混入 netDebt/cash 字段。若需要对非经营现金调整资产风险或 beta，应由研究模型显式建模，不能用负债权重凑数。

Comps skill 将“Gross margin > EBITDA margin > Net margin”描述为普遍必然。非经营收益、特殊费用和公司披露口径可能打破简单排序；本次不把它作为全行业硬拒绝条件。倍数的所谓典型范围也只可作为情境提示，不能充当买卖阈值。[DCF 方法](https://github.com/FeidaWang/financial-services/blob/574ed3624aebd0418c7e96cd101262f30210ab26/plugins/vertical-plugins/financial-analysis/skills/dcf-model/SKILL.md)、[Comps 方法](https://github.com/FeidaWang/financial-services/blob/574ed3624aebd0418c7e96cd101262f30210ab26/plugins/vertical-plugins/financial-analysis/skills/comps-analysis/SKILL.md)

### 5.7 文档、运行环境与供应商依赖

该提交的 README 链接到 `claude-for-financial-advisors`，但完整 tree 中不存在这个目录；comps skill 引用的 `examples/comps_example.xlsx` 也不在 tree 中。Office/recalc 等工作流依赖宿主工具，并非全部自包含。Managed-agent manifests 固定模型名为 `claude-opus-4-7`，并使用 preview API/toolset 标识；本次仅把它们视为仓库记录，不据此假定当前账户/API一定支持。部署应使用实际环境允许的模型配置与服务契约，不能靠旧模板字符串完成兼容性验证。

## 6. 为什么新系统需要额外的交易工程

下面能力并不存在于上游运行时，必须在 Arena 自身完成：

- 行情的实时/延迟/缓存/合成状态与交易时段管理；成交只能使用被许可且新鲜的价格。
- 不可变 run/decision/fill ID、幂等写入、并发账户更新、完整现金/持仓/费用账本。
- AI 输出事实/观点/概率/行动语义分离；不把动作信心当成可校准的上涨概率。
- 纸上撮合的价格、滑点、手续费、订单规模、现金与集中度约束，以及独立账本重放。
- 预测 horizon 到期、outcome resolution、已知数据截止与版本固定；不使用未来新闻或未结算预测提升成绩。
- 模型比较的同一初始资金、同一数据与成本口径；没有足够日收盘样本时不显示夸张 Sharpe，未满一年不显示 CAGR。
- 候选反馈版本和后续样本验证；数据好看不能自动更改 live 模型权重。

这些是从上游研究优点落到实时 AI 模拟系统的必要补充，不能归功于上游已经实现的“金融交易 SDK”。本次 `src/research` 的执行接口、限制和完整样例在 `research-contract.md`。

## 7. 来源、归属与复核方式

本审计的可复核依据是固定 commit 的文件，不是 README 功能宣传或星标数。完整 JSON 解析、YAML 引用存在性、递归 bundle 来源/内容比对、正则 handoff 复现和 openpyxl Workbook 接口检查都在本地完成；没有声称跑通付费 MCP、Claude Managed Agents API 或真实市场交易。

研究代码的验证入口为 `node --test tests/research.test.mjs`。样例数据 `fixtures/research-demo.json` 全部明示 synthetic，不是真实价格、公司财务或研究结论。

上游根许可：[Apache License 2.0](https://github.com/FeidaWang/financial-services/blob/574ed3624aebd0418c7e96cd101262f30210ab26/LICENSE)。若交付包附带任何上游原文/代码副本，保留该许可和源路径、commit、修改说明；涉及 S&P Global 原文时也保留其目录 LICENSE 中的 Kensho 归属。仅存在连接器声明不包含第三方数据的许可或账户授权。[S&P Global LICENSE](https://github.com/FeidaWang/financial-services/blob/574ed3624aebd0418c7e96cd101262f30210ab26/plugins/partner-built/spglobal/LICENSE)
