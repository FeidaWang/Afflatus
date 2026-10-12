# Arena FSI 升级包

**面向 `feida.au/arena.html` 的可运行源码、原站安装器和部署交接包。**

本次仅依据用户提供的两个地址及其实际链接到的源码进行审计，没有使用个人记忆或旧对话。上游和原站基线固定在 `config/upstream-lock.json`。代码已针对真实 Afflatus 的 React / Vite / Vercel 结构编写，不需要另建一套网站。

先读 **`CODEX_START.md`**。让 Codex 在已有 Afflatus 仓库中运行安装器、补充环境配置、执行验证，再提交和发布。这个压缩包本身不会创建云资源、运行付费模型或修改线上站点。

## 已经写完的内容

| 层 | 实现 | 主要文件 |
| --- | --- | --- |
| 实时看板 | 同源 API、15 秒可见页面轮询、共享行情缓存、来源/市场时间/接收时间/质量、IEX 档位说明、历史日线、双语与空态 | `ui/`、`server/market.mjs` |
| 行情适配 | Alpaca 多标的 bid/ask 快照、经授权的 IEX/SIP/延迟 SIP、官方市场 clock、已完成日线 | `server/market.mjs` |
| 三个策略 | S 研究、P 估值、T 组合风险；独立模型 ID、同一冻结事实快照、分析师与 critic 两次结构化调用 | `server/ai.mjs`、`server/config.mjs` |
| 模拟交易 | 市价/限价、现金/股份/风险预留、取消、暂停新增买入、费用/价差/滑点、持仓与平均成本、拆股和现金股息 | `src/core/paper-engine.mjs` |
| 研究计算 | WACC、三情景 FCFF DCF、5×5 敏感性、可比公司、财报 actual/consensus/prior、晨间摘要 | `src/research/` |
| 证据与论点 | facts/assumptions/inferences、来源时点验证、可证伪论点、反证与版本、催化剂时间和结果 | `src/research/`、`server/service.mjs` |
| 反馈 | 预测到期结算、Brier/log loss/reliability、按模型/版本/模式/质量/期限分组、候选新版本、不自动改实跑参数 | `src/research/feedback.mjs` |
| 账户与审计 | S/P/T 独立账户、demo/live 隔离、hash chain、账实对账、冻结输入保存与 hash 复核、全状态导出 | `src/core/`、`server/service.mjs` |
| 持久化 | 本地真实 SQLite、生产 Neon/Postgres、单个版本化 JSON 文档的 CAS 原子提交、重复请求重放 | `server/store.mjs`、`config/001-arena-state.sql` |
| 运维与交付 | 环境诊断、加表迁移、受控 cron 模板、原站安装/元数据迁移、先暂存再验收后 promote 的发布脚本 | `scripts/`、`config/` |

`financial-services` 的主要价值是专业研究方法、skills、agents、校验与 MCP 组织方式。它本身没有股票报价或执行账本。这里将可用于 Arena 的方法转成了真正运行的模块；完整 18 项映射、全部垂直领域覆盖和上游缺陷在 `docs/upstream-audit.md`。

12 个商业 MCP 提供方保留为**未连接的供应商目录和经许可的结构化证据导入入口**。没有凭据、合同或测试结果时，页面不会宣称 FactSet、LSEG 等已接通。现有 Vibe 日线与专业研究面板通过原来的 feature flag 保留；其原接口的服务配置仍由现有系统管理。

## 对现网反馈后做出的具体修改

1. 原主 journal 的硬编码价格和种子图形退出主数据路径；真实服务失效时保留明确错误，不切入合成报价。
2. 行情、研究数据、模型建议和成交都携带时间和来源。未来事实无法凭较早的接收时间混入模型上下文；执行报价必须在分析完成之后，且没有过期。
3. 旧静态比赛日志保留为历史资料，不并入新账户业绩。新账户从独立的初始资金和新状态开始。
4. 模型不能直接写账、改变风控或调用任意工具。分析、反方审核、确定性风控和模拟成交分别留下记录。
5. 重复点击、超时重试、并发请求和多实例访问使用服务端幂等与持久化 CAS；单个请求中的三个账户公司行动一起提交或一起回滚。
6. 预测严格使用指定 horizon；晚超过 5 分钟的结果标为 expired。跨已登记拆股/分红事件、尚未取得正确调整结果的预测标为 invalidated，并从概率评分中排除。
7. 不把日内轮询次数当成日频样本；不凭短样本年化、不混合不同模型与期限给出伪排行榜。完整修复记录见 `docs/feedback-changelog.md`。

## 本地直接运行

需要 Node.js **22.13+，建议 24**。

```bash
npm ci
npm run verify
npm run dev
```

本地开发默认使用隔离 demo 和真实 SQLite 文件。打开终端给出的本机地址下的 `/arena.html`。首次启动会把本地管理员令牌写到 `.arena-data/admin-token`，权限为 `0600`；按需要自行打开该文件，将令牌输入页面的“连接设置”。服务不会将令牌自动注入网页，也不会在终端输出其值。

先查看未连接状态或显式演示，再在“决策与反馈”运行一轮、或在订单票据提交模拟订单。演示回合使用可重复的确定性规则，**没有真实 LLM 调用**。页面和输出都带 demo 标识。刷新页面清除浏览器中的令牌，SQLite 账户仍保留。

`npm run dev` 用于下载后的本机环境。在受管理的 ChatGPT Sites 工作区中，它会拒绝启动，以遵守该环境的预览管理方式。

## 安装到现有 Afflatus

先在目标仓库创建工作分支，并保留已有修改。以下命令在解压包目录执行：

```bash
node scripts/install-host.mjs --target /absolute/path/Afflatus
node scripts/install-host.mjs --target /absolute/path/Afflatus --apply
node scripts/patch-host-metadata.mjs --target /absolute/path/Afflatus --apply
```

安装器验证 `project-afflatus` 和已审计的页面挂载位置；遇到未知入口会停止并提供原因。它复制模块到 `integrations/arena-fsi`，增加 `/api/arena-fsi`，替换 Arena 的主组件，并保留共享头部、语言路由及 `researchPanel`。原始被改文件保存到 `integrations/arena-fsi-install-backup`。

随后在 Afflatus 根目录执行：

```bash
npm install
npm run arena:fsi:check
npm run arena:fsi:test
npm run build
```

安装器不会提交、推送、迁移数据库或上线。详见 `docs/deployment.md`。压缩包的 `patches/afflatus-arena-fsi.patch` 是针对锁定基线的完整备选补丁；**安装器与补丁二选一**。已经安装后不要再重复套用补丁。安装目录包含运行源码、测试和技术文档；`validation/` 与 `patches/` 是解压交付包中的验收资料，不复制进网站运行目录。

## 真实模式的外部配置

| 配置 | 作用 | 未配置时 |
| --- | --- | --- |
| `DATABASE_URL` | Neon PostgreSQL 持久化，先执行加表迁移 | 生产只允许有限只读诊断，不允许临时内存写账 |
| `ALPACA_API_KEY`、`ALPACA_SECRET_KEY` | 报价、日线与只读市场 clock | 明确显示行情未连接 |
| `ALPACA_DATA_FEED` | `iex` / `sip` / `delayed_sip` | 默认 IEX，明确单交易所；延迟报价不得成交 |
| `ARENA_ADMIN_TOKEN` | 至少 24 字符的独立管理令牌 | 普通 POST 管理操作拒绝；cron 使用独立 CRON_SECRET |
| `ARENA_S/P/T_PROVIDER` 与 `ARENA_S/P/T_MODEL` | 三个策略的提供商与准确模型 ID | 缺配置的策略保持 held，不伪造模型输出 |
| 对应 `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | 模型服务凭据 | 不发生该提供商的有效模型调用 |
| `ARENA_MODE=live` | 连接行情模式 | `.env.example` 的本地值为 demo，上线应显式修改 |
| `ARENA_PUBLIC_QUOTES=true` | 在确认供应商允许公开展示后启用公开行情 | 公共页面不返回受控行情 |
| `CRON_SECRET`、`ARENA_AUTORUN` | 可选受鉴权的周期行情/预测结算/策略回合 | 默认不安装 cron、不自动调用模型 |

以上都放服务端环境，不使用 `VITE_` 前缀承载秘密。真实模型名称没有写死猜测版本；使用账户实际可用并经过验证的模型 ID。

## 默认执行口径

- 仅 USD、多头、模拟现金账户，不提供真实券商订单接口。
- 单标的上限 25%，行业上限 45%，总仓位上限 95%。未知行业聚合为 UNKNOWN，不能借缺字段绕过行业上限。
- 报价有效期 90 秒；市场 clock 未验证、休市、延迟、未来或坏报价均不能正常执行。
- 买入基于 ask、卖出基于 bid，另计默认 5 bps 滑点和 1 bp 费用；限价即使计入滑点也不得被突破。
- 暂停阻止新增买入，允许减仓与撤单。限价单保留资金/股份并在每次撮合时重新过风控。
- 公司行动是经授权输入、需依时间顺序登记；现金分红采用简化的除息日入账口径。没有自动公司行动源或券商清算模型。

详细会计精度、限制与例子见 `docs/engine-contract.md`。这些是明确可修改的研究假设，不是真实市场成交保证。

## 运行边界与可维护性

这是个人站点的持久化研究系统：每种模式使用一个版本化状态文档，先保证账本事务与可复核性。每次提交的完整状态必须小于 16,000,000 字节；达到 1,500 回合后拒绝新建 AI run。其它操作仍受自身容量和完整状态大小限制。需要定期导出、归档并启用新赛季。长年高吞吐运行应把行情、审计与研究事件拆到独立表，并增加独立任务队列；本包不把这一规模宣称为已经实现。

行情是 15 秒 REST 轮询，不是逐笔 WebSocket。状态读取只更新共享行情缓存，不撮合挂单。显式 refresh 会重新评估挂单；feedback 会先刷新再结算预测，cron 同时执行这些工作。历史图使用已完成日线，不把日线价格用于当前模拟成交。

概率事件定义是“标的在给定 horizon 的**价格回报大于零**”，不含股息；模型动作的信心与该概率概念分开。不同质量、期限、模型版本不合并评分。重叠预测存在相关性，样本数不能直接视作独立实验数。

没有在本次交付环境中使用真实服务密钥，没有真实 Neon/Alpaca/模型服务的认证联调，也没有远程发布。已完成的自动化验证、真实原站构建和未完成的浏览器验收范围，以 `validation/verification-report.md` 为准。

## 文档导航

- `CODEX_START.md`：给 Codex 的完整执行交接。
- `docs/deployment.md`：环境、迁移、验证、发布、cron、回滚与归档。
- `docs/api.md`：完整 API 字段、模式与鉴权。
- `docs/engine-contract.md`：会计、订单、风控和绩效口径。
- `docs/research-contract.md`：研究输入输出与公式边界。
- `docs/ui-contract.md`：页面挂载、交互与显示口径。
- `docs/upstream-audit.md`：全部上游能力盘点和迁移映射。
- `docs/current-system-audit.md`：现网问题与直接证据。
- `docs/feedback-changelog.md`：实际反馈修复清单。
- `validation/`：测试日志、构建报告、可重建演示运行与证据快照。
- `NOTICE.md` 与 `licenses/`：来源和许可证。

