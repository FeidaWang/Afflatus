# 反馈驱动修复记录

本表记录交付代码中已经落实的反馈；部署环境条件单独列在 deployment 文档中。

| 发现 | 具体修复 | 验证层 |
| --- | --- | --- |
| 原 journal 直接导入 fictional marketData | 新 UI 只读规范化服务快照，独立显式 demo，错误不触发合成回退 | UI 契约、SSR、宿主构建 |
| 旧公开研究 API 返回 FEATURE_DISABLED | 公开 capabilities；新 Alpaca provider；保留独立 gated Vibe panel | 现网只读证据、HTTP/provider 契约 |
| 历史 JSON/SEO 描述被误读为当前连续运行 | 历史资料不进入新状态；原站 metadata 迁移器明确 archive | 源锚点、manifest/SEO 构建门 |
| 供应商有 URL 就被当作已连接 | registry 全部从 not_connected 起步，明确 licensed-evidence-import | 模块源码与 API/UI 显示 |
| .mcp.json 和嵌套输出的上游校验缺口 | 完整 JSON.parse / 严格模型结构校验；不复制损坏 parser/wrapper | schema、malformed/refusal/extra-field 测试 |
| 未来 quote 借旧 receivedAt 混入上下文 | 同时核查事实、发布时间、接收时间与 cutoff；过滤 safeSnapshot | runtime-review |
| 未来半秒报价被客户端/服务当作实时 | 服务 quoteStatus 对 age < 0 一律 unavailable；core 同样拒绝未来 | core、runtime-review |
| 接收时间误写为网络请求前的时间 | 数据响应完成后用服务器 clock 记录 receivedAt；执行时刻重新读取 | provider contract、runtime-review |
| 模型完成后仍用决策前的陈旧参考价成交 | 独立拉取执行快照；q.asOf 必须不早于 decisionAt | runtime-review |
| 幂等键和最新 snapshot 绑定导致重试冲突 | 服务以原始订单输入持久保存第一次结果，重复请求重放 | server、SQLite 并发 |
| 128 字符 run key 加后缀超出引擎/评分上限 | 用固定长度 hash 生成 order/forecast ID，runId 独立保存 | runtime-review |
| 并行写可能重复扣款或丢持仓 | 一个文档的 versioned CAS；SQLite/Neon 参数化写；重试不含网络调用 | 8 并发、多连接、SQL 契约 |
| 异步 hash 期间调用方可能改变报价/证据 | 提交订单与挂单撮合入口先复制报价、订单和 context | core 时间与 mutation 测试 |
| 只记录 hash、原始研究上下文被覆盖 | run.frozen 保存共同 snapshot/evidence/research 与每个 portfolio，导出复核 hash | server 冻结导出回归 |
| 公司行动只处理单个账户，其他账户 NAV 失真 | 全三账户同事务应用；任何账户拒绝则全部回滚 | core、runtime-review |
| 公司行动后重新使用旧报价 | 账户保存生效时点，即使零持仓也不接受事件前报价 | core |
| 拆股产生伪 -50% 预测结果 | 跨登记公司行动的未正确调整 forecast 标为 invalidated 并退出评分 | runtime-review |
| 任意较晚报价被当作指定 horizon 结果 | 只在 horizon 后 5 分钟内结算；其余 expired，不替换预测期限 | server |
| 入金、股息、费用或日内采样被混进收益解释 | 会计分项、外部流量中和、价格预测与现金股息分开、明确频率门 | metrics、research |
| DCF 的净现金公司可能得到负债务权重 | WACC 使用市场权益和 gross debt；现金在权益桥接只计一次 | research |
| 较少/混合样本给出夸大收益或概率榜单 | 样本门、horizon/quality/model/version cohorts、短历史不年化 | metrics、research、UI |
| 本地 Vite 转发后同源检查误拒绝合法 POST | 本地 HTTP 桥仅接受 loopback Host，并保留原前端 Host | local adapter、HTTP 契约 |
| health 只看持久化标记，坏 DB 也可能 promote | health 真正读表，失败 503；release 验证 ready/status/页面脚本/未鉴权 401 | runtime-review、发布脚本 |
| 初始空行情触发历史组件 null.bars 崩溃 | 历史图独立检查 record/symbol/bars 后渲染 | 完整 React SSR |

反馈提案仅输出新版本实验建议。系统没有把训练期评分直接写回当前交易参数，也没有把相同样本同时用于训练与宣称样本外获胜。

原站集成构建另发现并修复默认导出与具名导入不一致，以及 researchPanel → legacyResearch 的挂载参数不一致；安装器已有针对真实组件契约的回归。

原站回归还修正两个旧测试数据：Finnhub访问门测试补齐现有生产validator已要求的OHLC和timestamp；中文本地化测试更新为本次确认的新Arena标题。生产quote校验没有放宽，历史JSON没有改写。
