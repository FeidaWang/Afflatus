# course.md — Bruce 的个人 AI 协作成长课程（v3.0 · 2026-07-12）

> **定位**：这不是面向大众的课程，是 Fable 5 基于 Bruce 的真实 Claude Code 历史、git 记录与工作流文档量身定制的个人学习蓝图。
> **维护规则**：本文是活文档（living document）。每完成一个里程碑或工作流发生变化，更新对应章节并在 Ch01 的「Playbook 更新日志」加一行。旧结论不删除，划掉并注明日期——错误的自我认知也是数据。
> **分析基础（诚实声明）**：Ch01 的画像基于以下可核查证据——本仓库 310 次 commit（2026-06-03 至今）、`Urgent.md` / `roadmap.md` / `RELEASE_NOTES.md` 三份工作流文档、`prompts/` 提示词库、36 个 vitest 测试文件、近期 60 个 Claude 会话记录（含定时任务）。逐 token 的账单级用量日志不在本工作区内，token 效率结论从 `prompts/README.md` 的设计规范与会话模式**推断**得出，非直接计量。

---

## Chapter 00 · AI Engineer Tech Tree（v3.0 新增，2026-07-12）

> **定位**：全课程的地图。一段共用主干（Trunk）+ 三条可选分支（Branch A/B/C）。主赛道未裁决前（见 §0.4）每周预算只投主干节点与 Ch06 测评，不点分支。
> **情报基线（2026-07-12 巡检）**：Anthropic Academy 现有 20 门公开课（anthropic.skilljar.com，2026-03 上线后持续扩容）；官方工程博客「context engineering 三部曲」；Agent SDK / Agent Skills / MCP 官方文档均已成体系。本章外链沿用 Ch02 策展纪律：不自编教材、每季巡检。

```
                          ┌── Branch A · Applied LLM Engineering（agent / 上下文 / 评估工程，§0.2）
  Trunk 主干（§0.1）──────┼── Branch B · AI Infrastructure / MTS（= Ch05 全章，长线 12–18 月）
   T1→T2→T3→T4/T5         └── Branch C · Data Synthesis & Analytics（= Ch04 升级，短线 12 周）
```

### 0.1 主干 Trunk（任何分支都必修，按序点亮）

| 节点 | 内容 | 源 | 出口标准（可验） |
| --- | --- | --- | --- |
| T1 ✅ 已点亮 | 状态外置 / token 工程 / 范围裁决 | 你自己的 S1–S3（Ch01） | 已有证据，无需重修 |
| T2 · Evals 工程 | 给 AI 产出建考卷——**全树最高优先节点**，A/B/C 三支全部依赖它 | Lesson 2.2 + Claude Cookbook 的 eval/context-engineering 篇目 | 为自己任一 AI 产出环节建 10 条黄金集并跑通一次回归 |
| T3 · Context Engineering | prompt engineering 的正式继承者：上下文预算、compaction、工具清理、多轮状态 | Anthropic 工程博客三部曲：《Effective context engineering for AI agents》《Writing effective tools for AI agents》《Code execution with MCP》 | 为自己任一条定时任务画出「上下文预算表」（system/tools/history/data 各占多少、削减策略是什么） |
| T4 · 统计判断 | 显著性、分布、「好到可疑」 | Lesson 2.3（不变） | 同 2.3 |
| T5 · Big-O 审查语言 | review 时闻出复杂度问题 | Lesson 2.5（不变） | 同 2.5 |

### 0.2 Branch A · Applied LLM Engineering（v3.0 新增分支）

> **为什么这条分支存在**：你的 S2（token 工程）已是半专业水平，但全部是野路子自学——这条分支把它转正为 2026 年市场认可的「AI Engineer」技能栈，且与 Anthropic 官方课程完全对齐，是三条分支里变现最快的。预计 12 周 @ 5h/周。

| 节点 | 内容与源 | 产出物（必须真实存在） | 依赖 |
| --- | --- | --- | --- |
| A1 · Claude API 系统课 | Academy《Building with the Claude API》——tool use / streaming / prompt caching / batch / citations 全谱系。你已在生产用 caching，此课把野路子转正 | 课程证书 + 一页「我的 prompts/README.md 五条硬规则 vs 官方最佳实践」差异笔记 | T2 T3 |
| A2 · MCP 双课 | Academy《Introduction to MCP》+《MCP: Advanced Topics》（Python 从零建 server/client；进阶含 sampling/notifications/transports） | 给 feida.au 数据管线写一个真实 MCP server（如 arena 账本查询），本地接入 Claude Code 可用 | A1 |
| A3 · Agent Skills | Academy《Introduction to agent skills》+ 官方 skill authoring best practices 文档 | 把你的 Urgent.md 三层工作流做成一个可分发 skill（skill-creator 可辅助），自己日常真用 | A1（与 A2 可并行） |
| A4 · Subagents & Agent SDK | Academy《Introduction to subagents》+ Agent SDK 官方文档（Claude Code 同源框架） | 用 Agent SDK 重写一条现有定时任务（候选：arena-autopilot），行为与旧版等价 | A2 A3 |
| A5 · 工具设计与生产评估 | 《Writing effective tools for AI agents》精读——自包含、不重叠、参数显式 | 为 A2 的 MCP server 建 20 条黄金集 + 及格线，重构一次工具描述使通过率上升并记录前后数据 | A4 |
| A6 · Capstone | 综合应用 | arena/sectors 管线完整 agent 化：RFC 先行（O1）→ Agent SDK 实现 → eval harness 守门 → 对外工程博客一篇（O3） | A5 |

### 0.3 Branch B / C（指针，不重复正文）

- **Branch B · AI Infrastructure / MTS** = Ch05 全章不变（DDIA → CMU 15-445 → MIT 6.824 → 集群 infra，三支柱评分卡照旧）。**2026-07 补丁**：I4 阶段的资料清单加「Anthropic/各大厂公开训练 infra 工程博客」为固定巡检源。
- **Branch C · Data Synthesis & Analytics** = Ch04 全章不变（12 周 DA Playbook）。**2026-07 补丁**：新增节点 **C+ · 合成数据工程**——用 LLM 生成训练/测试数据的质检（分布检查、污染检测、黄金集验收即 4.3 方法平移）。诚实标注：此节点暂无单一权威官方课，材料弱，按季巡检补。

### 0.4 主赛道裁决记录

| 日期 | 裁决 | 依据 |
| --- | --- | --- |
| 2026-07-12 | **待定**——先做 Ch06 定向测评（三维摸底），用测评数据裁决 | Bruce 选「先测评后定向」 |

待定期间预算：每周 ≤10h 只投 T2/T3 主干 + Ch06 测评题，分支节点一律不开。

### 0.5 官方材料清单（2026-07 巡检版，季度更新）

- Anthropic Academy 全目录：https://anthropic.skilljar.com/ （全部免费，完课有证书）
- 工程博客三部曲：https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents 及同站《Writing effective tools for AI agents》《Code execution with MCP》
- Agent Skills 概览与 authoring best practices：https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview
- Agent SDK 文档：https://docs.claude.com/en/docs/agent-sdk/
- Claude Cookbook（evals / context engineering 实操篇）：https://platform.claude.com/cookbook
- 求真背景读物：《Equipping agents for the real world with Agent Skills》（anthropic.com/engineering）

---

## Chapter 01 · My Personal Vibe Coding Playbook

> 本章由 Fable 5 以第一人称客观撰写。「你」= Bruce。评价基于证据，不基于客气。

### 1.1 数据快照（截至 2026-07-12；月度重跑追加 2026-07-13，见带删除线行）

| 维度 | 观测值 | 证据 |
| --- | --- | --- |
| 产出节奏 | ~~310 commits / 6 周，峰值单日 50（07-05）~~ → **月度重跑（07-13）**：近 30 天 341 commits，峰值单日仍是 50（07-05），周度节奏 ~52/周 → ~80/周（+54%） | git log |
| 工作时段 | ~~**40%+ 的 commit 落在 21:00–02:00**，23 点是单一最高峰（59 次）~~ → **月度重跑（07-13）**：近 30 天 21:00–02:00 占比升至 **61.6%**（210/341），23 点单峰 65 次；单峰小时占比基本稳定（19.0%→19.1%），但整个夜间窗口的集中度显著恶化 | git log 小时分布 |
| 测试纪律 | 36 个测试文件，518/518 通过是合并前提 | tests/ + Urgent.md 验收记录 |
| 自动化程度 | 60 个近期会话中过半是定时任务（arena/sectors/leagues/transits 日更） | 会话记录 + prompts/ |
| Token 工程 | system/run 拆分吃 prompt caching、强制 JSON、状态外置、长度硬上限、数据预消化 | prompts/README.md 五条硬规则 |
| 技术债 | ~~styles.css 7444 行（靠「文末追加 + !important 赢」层叠）、main.js 3523 行、主 chunk 868 kB~~ → **月度重跑（07-13）**：styles.css **7826 行**（+5.1%，W1 靶子仍在增长而非收敛）、main.js 3498 行（基本持平）、主 chunk 因 U21 Phase 1 vendor 拆分降至 **192.85 kB**，但连同 vendor-three 674.49 kB + vendor-astronomy 46.31 kB 总字节数升至 913.65 kB（拆分带来缓存收益，不代表代码量减少） | RELEASE_NOTES.md 12a 体检 + U21 Phase 1 |

### 1.2 你的强项（保持，并且知道为什么强）

- **S1 · 状态外置纪律是专业级的。** `Urgent.md`（当前问题）→ `RELEASE_NOTES.md`（完成归档）→ `roadmap.md`（未来队列）的三层流水线，等价于一人公司的 issue tracker + changelog + backlog。「对话可弃，文件永存」你已经内化了。这是多数 vibe coder 两年都学不会的东西。
- **S2 · Token 效率意识领先于市场。** `prompts/README.md` 里「一个数字模型算得出来 ≠ 应该让模型算」这句话，是 2026 年 AI 工程的核心命题。你把指标计算、去重、截断全部前置到脚本，只让模型做决策推理——这就是本课程 Ch04 要教别人的东西，你已经在做。
- **S3 · 范围裁决（scope adjudication）成熟。** U9 只换机械表盘保留舰船剪影、A2 Phase 4 明知 state/nav/boot 纠缠就不在沙盒里强拆、C5 先评估再加第 9 页——你会说「不做」，这比会做更稀缺。
- **S4 · 验收有物理结构。** 「沙盒无法渲染 → 所有视觉改动待真机复核」被你写成了铁律而不是口头承诺；build diff 逐字节验证 CSS 迁移这种手法说明你懂「验证要客观，不能靠 AI 自述」。
- **S5 · 真实部署闭环。** 9 个有 URL 的页面 + Vercel + GA 埋点 + 定时任务数据管线。你的作品集问题已经解决了，缺的是叙事整理（见 Ch03 §3.4）。

### 1.3 你的弱项（本课程的靶子）

- **W1 · CSS/前端架构判断力落后于产出速度。** 7444 行 styles.css、9 处重复 `--hud-cols`、约 40 处已知死选择器「记录不清理」——「文末追加靠 source order 赢」是止血手法，不是架构。你目前**识别得出**债（12a 体检很诚实），但**开不出**重构处方。→ Ch02 状态管理与渲染课。**月度重跑（07-13）：** styles.css 涨到 7826 行（+5.1%），靶子在这个月是在增长而非收敛；main.js/主 chunk 结构因 U21 vendor 拆分改善，但那是分包收益不是重构处方。
- **W2 · 视觉验收积压是系统性风险。** `.fld-manual` 隐藏 bug 在「待真机验收」标签下存活了多个版本才被截图抓到。待验收清单只增不减，说明验收不是流程里的硬关卡。→ Playbook 规则 R3。**月度重跑（07-13）：** 积压首次量化——Urgent.md 状态表里 10 项待真机验收（U1–U6/U12b/U13-14/U15/U16/U17/U18/U19/U24/U25），是 R3 上限 5 项的 2 倍，本周新增两项完成（U24/U25）后积压仍未见净减少。
- **W3 · 算法与复杂度直觉缺乏第一性训练。** 全仓库的算法工作（星历、排盘、技术指标）都由 AI 代写、以「行为对不对」验收。这在你自己的项目里成立，在 2026 年面试房间里不成立。→ Ch03 整章。
- **W4 · 作息曲线不可持续。** 23:00–02:00 是你的黄金产出段，07-04/05 两天 89 个 commit 之后是明显低谷。冲刺-崩溃循环在数据里清晰可见。本课程所有配速（每周 3 题、12 周路径）都按可持续节奏设计，**不许**用冲刺补进度。**月度重跑（07-13）：** 21:00–02:00 占比从基线 40%+ 升至近 30 天 61.6%，本周单周更是到 72.7%——每次重新测量都比上一次高，作息曲线没有企稳迹象。
- **W5 · 未提交改动漂移。** course.html 作为第 9 页在未提交状态下游离多日、连带 vite.config/sitemap 一批改动悬空——违反你自己 CLAUDE.md 的 surgical changes 原则。→ Playbook 规则 R5。

### 1.4 你的编码哲学（我观察到的，非你宣称的）

你实际执行的哲学可以概括为：**「AI 高速产出 + 文件化状态 + 客观验证闸门 + 人只做裁决」**。你不逐行读码，但你逐项验行为；你不背语法，但你背红线。这个哲学的天花板在于：当验证闸门无法自动化（视觉、架构品味、算法正确性证明）时，你的裁决质量直接暴露。Ch02–Ch04 全部围绕「提升无法自动化那部分的裁决力」设计。

### 1.5 Playbook 规则（当前版本，随证据修订）

- **R1 · 铁律不变**：永远不合并自己解释不了的代码。
- **R2 · Token 三问**（沿用你的 prompts 规范并推广到交互式会话）：这个数据能预消化吗？这个上下文能进 system 吃缓存吗？这个输出能限长吗？
- **R3 · 验收 WIP 上限**：「待真机验收」清单超过 5 项即冻结新视觉改动，先清验收债。验收积压 = 未爆 bug 库存（证据：.fld-manual）。**例外（2026-07-14，U27 开工时裁决）**：默认关闭、需显式 `?flag=1` 才渲染的视觉改动不计入此上限——未激活的 flag 等于用户不可见，不产生新的「等待验收」曝光面；U25 的教训不是「flag 隔离不够小心」，是「一次性做完就默认转正」，制度化的修法是 flag 本身，不是禁止所有新视觉工作。真正验收积压仍要清，只是不拿它当挡 flag 切片的理由。
- **R4 · 深夜只写不并**：23 点后允许产出，不允许 merge/push 主干。判断力衰减期不做不可逆操作。
- **R5 · 工作区清洁**：任何会话结束时 `git status` 必须干净——要么提交、要么 stash 并在 Urgent.md 记一行去向。
- **R6 · 每周一次架构审视**（对冲 W1）：让 AI 报告本周新增的重复定义/死代码/文末覆盖，你只裁决「清理 or 记账」，10 分钟封顶。

### 1.6 Playbook 更新日志

| 日期 | 变更 | 触发证据 |
| --- | --- | --- |
| 2026-07-12 | v2.0 初版：从平台蓝图改为个人课程；确立 R1–R6 | 本次全量分析 |
| 2026-07-12 | v2.1 新增 Ch05「AI Infrastructure & MTS Track」+ 每 4 周 gap-analysis 循环（定时任务 `mts-gap-analysis`）；Ch04/Ch05 赛道分岔见 §5.5 | 用户立项（Anthropic 团队画像数据） |
| 2026-07-12 | v3.0 新增 Ch00「AI Engineer Tech Tree」（Trunk + 三分支；Branch A Applied LLM Engineering 为全新内容）与 Ch06「互动导师制与三维评估循环」；主赛道由 Ch05 默认改为**待定向测评**（§0.4）；官方材料对齐 2026-07 的 Anthropic Academy（20 门课）与工程博客三部曲 | 用户立项 + Academy/docs 巡检 |
| 2026-07-13 | 月度画像重跑（U20 归并职责，与周报同一定时任务）：§1.1 产出节奏/工作时段/技术债三行按 30 天窗口更新（旧值划线保留）；W1/W2/W4 追加最新证据（CSS 债增长、R3 积压量化为 10/5、夜间占比 40%→61.6%→72.7%）；无删除，纯累加 | course-weekly-review 月度附加（30 天 git log 重跑） |

---

## Chapter 02 · AI / 数学 / CS 基础：学会评判 AI 的输出

> **核心转向**：你已经不需要学「怎么写 prompt」（S2 证明你会）。本章教「怎么判断 AI 给你的东西是不是对的、好的、值得合并的」。
> **策展纪律**：本章**不自编教材**。每课指向原始出处，只写「看什么、跳什么、用什么标准验收自己」。外链每季度巡检一次。
> **格式**：每课固定收尾 **「So you can tell AI this…」**——把概念立刻兑换成一条更专业的指令。

### Lesson 2.1 · LLM 是怎么工作的（建立「它为什么会错」的直觉）

- **源**：3Blue1Brown《Neural Networks》系列（重点：Transformers / Attention / How LLMs store facts 三集）。
- **看什么**：token 化、注意力权重、下一词概率分布——理解「模型没有事实数据库，只有统计倾向」。
- **验收自己**：能向别人解释为什么模型会自信地编造 API 名称。
- **So you can tell AI this…**：「这个库的 API 你可能在编。给我答案时同时给出你引用的文档 URL；给不出 URL 的部分显式标注 UNVERIFIED，我自己查。」

### Lesson 2.2 · 评估（Evals）：给 AI 产出建考卷

- **源**：Anthropic docs「Create strong empirical evaluations」+ OpenAI Cookbook 的 evals 相关篇目。
- **看什么**：eval 的三件套——测试集、评分标准（rubric）、及格线；LLM-as-judge 的适用边界。
- **验收自己**：为你的 horoscope 排盘函数之外任选一个 AI 产出环节（如 Arena 复盘文案质量）写出 10 条带预期答案的 eval。
- **So you can tell AI this…**：「先别写实现。先给我 10 个输入-预期输出对作为验收集，其中至少 3 个是边界/对抗样例。我确认验收集后你再写码，写完自己跑一遍报告通过率。」

### Lesson 2.3 · 概率统计：显著性、分布与「好到可疑」

- **源**：MIT 18.05（Introduction to Probability and Statistics，只取贝叶斯推断与假设检验章节）+ 3Blue1Brown 贝叶斯定理单集。
- **看什么**：p 值滥用、基础比率谬误、辛普森悖论——全部对着你 Arena 的 confidence 字段与命中率数据学。
- **验收自己**：用你自己的 Arena 预测账本算一次「命中率是否显著优于抛硬币」，写清样本量够不够。
- **So you can tell AI this…**：「你报的这个提升可能是噪声。给我样本量、置信区间和基线对比，没有区间就不许说'更好'。」

### Lesson 2.4 · 线性代数直觉：embedding 与相似度

- **源**：3Blue1Brown《Essence of Linear Algebra》（1–10 集足够）。
- **看什么**：向量空间、点积=相似度、矩阵=变换。目的不是手算，是看懂 AI 说「用 embedding 做语义去重」时它在提议什么。
- **So you can tell AI this…**：「解释你选的相似度度量（cosine vs dot product vs 欧氏）在这个数据分布下的差别，以及阈值是怎么定的。」

### Lesson 2.5 · 算法效率：Big-O 作为审查语言

- **源**：MIT 6.006（2020 版，Lecture 1–3 + 排序/哈希两讲）。
- **看什么**：够用即止——你需要的不是证明技巧，是**在 review 时闻出嵌套循环的味道**。与 Ch03 的 SPAR-A 步共用。
- **验收自己**：给你 main.js 里任一 rAF 循环报出每帧成本量级。
- **So you can tell AI this…**：「这个列表将来会到 10 万条。写码前先报你方案的时间/空间复杂度和瓶颈点，超过 O(n log n) 要给理由。」

### Lesson 2.6 · 工程素养：shell / git / 调试

- **源**：MIT Missing Semester（重点：Shell Tools、Version Control、Debugging and Profiling 三讲）。
- **针对你**：你的 git 用得多但窄（commit/push 流畅，bisect/rebase/worktree 基本没出现在历史里）。W5 的解药一半在这。
- **So you can tell AI this…**：「不要直接改。先 `git stash` 现场，给我一个能用 `git bisect` 定位的最小复现步骤，修完给我 diff 而不是新文件。」

### Lesson 2.7 · 渲染管线：你的 868 kB 主 chunk 欠的课

- **源**：MIT Missing Semester 的 profiling 讲 + Anthropic/OpenAI 无对应内容，浏览器部分用 Chrome DevTools 官方 Rendering 文档（策展外的唯一例外，因为它就是原始出处）。
- **看什么**：layout → paint → composite；16ms 预算；transform/opacity 免重排;你全站 48 处 `backdrop-filter` 正是移动端 GPU 大户（12a 体检原话）。
- **So you can tell AI this…**：「这个动画只许用 transform 和 opacity。改完在 DevTools Performance 面板录 5 秒给我看有没有紫色 layout 块。」

### Lesson 2.8 · UI/UX 品味：可打分的技术技能

> 品味不玄。四个维度，各 25 分，低于 70 不上线。每次视觉验收（R3 清单）顺手打一次分，分数写进验收记录——积累 20 次后你就有了自己的品味基线数据。

| 维度 | 满分 25 的标准 | 你的已知偏差 |
| --- | --- | --- |
| **视觉层级 Visual Hierarchy** | 3 秒内看出「先看哪、后看哪」；字号 ≤3 级；一屏一个主角 | HUD 页曾因元素过密被你自己截图投诉（U8 立项原因）|
| **间距 Spacing** | 8px 网格；组内距 < 组间距；无「近一屏空白」类失控留白 | U13d 的 hero 空白 = min-height 遗留值失控 |
| **对比度 Contrast** | 正文过 WCAG AA（4.5:1）；状态色不只靠色相区分 | 深色科幻主题天然高危，逐页测 |
| **设计克制 Restraint** | 动效只服务状态变化；删一个元素页面不塌 = 该删；新特效先问「谁需要它」 | 你的强项——U8 整课就是做减法 |

- **训练法（批判练习）**：每周取一对 AI 生成的界面（或你自己页面的新旧版），按四维打分并写一句「哪句 prompt 能把差的救回来」。
- **So you can tell AI this…**：「按视觉层级/间距/对比度/克制四维自评你刚生成的界面（各 25 分），先报你最弱的一维和你会怎么改，再给我看代码。」

---

## Chapter 03 · Codeforces 训练 + 2026 求职准备

> **哲学**：learn to think, do not just paste answers。这补的是 W3——你的项目全靠 AI 代写算法，面试房间里没有这个选项。
> **配速**：**每周 3 题，不多做**。数据（W4）显示你会冲刺，而算法直觉只能靠间隔重复长出来，冲刺无效。

### 3.1 四段位进阶阶梯（反刷题设计）

| 阶段 | 段位带 | 时长 | 主题 | 出口标准（客观、可验） |
| --- | --- | --- | --- | --- |
| P1 | 800–1000 | 4 周 | 实现、暴力、数学直觉 | 30 分钟内独立 AC 一道 1000 分题 |
| P2 | 1000–1300 | 6 周 | 贪心、二分、双指针、前缀和 | 先口述解法再写码，口述与最终代码一致 |
| P3 | 1300–1600 | 8 周 | 基础 DP、BFS/DFS、排序思想 | Virtual Contest 稳定 2 题 |
| P4 | 1600+ | 持续 | 按面试反馈补洞 | 模拟面通过 |

- **每月 1 场 Virtual Contest**（Div.3/Div.4 起步），当月第 4 周的 3 题额度换成这一场。VC 成绩曲线是唯一进度指标——不涨就回上一阶段，没有羞耻，只有数据。
- **禁止事项**：不追 streak、不上排行榜、不做「今天状态好多刷两道」——超额部分明天会用倦怠还回来（07-05 的 50 commits 已经证明过一次）。

### 3.2 SPAR 框架（每题强制四步）

1. **S — Solve alone（25 分钟计时，无 AI）**：写下思路，哪怕是错的。没有这步，后面全部作废——AI 只许出现在 P/A/R。
2. **P — Probe（阶梯提示）**：
   > 「我在做这道题：[题面]。我目前的思路：[思路]。**不要给我解法**。阶梯式提示：先只指出我思路里最关键的一个漏洞；我说『下一层』你再给下一层；每层 ≤2 句。」
3. **A — Analyze（过题后复盘）**：
   > 「这是我的 AC 代码：[代码]。三件事：① 报时间/空间复杂度并指出瓶颈（对接 Lesson 2.5）；② 给出你认为最优雅的解法并对比差异；③ 这题属于哪个可复用模式？一句话概括该模式的识别信号。」
4. **R — Riff（变体再练）**：
   > 「基于这题出一道**同模式不同外壳**的变体（改叙事、改约束规模），不给解法。三天后我用它自测。」

SPAR 记录写进 `training/` 目录按周归档（复用你的状态外置纪律 S1）——这些记录同时就是 3.4 的面试素材。

### 3.3 · 2026 面试现实（写给你的求职策略）

2026 年的技术面试里，纯手写算法轮在收缩，两个新轮次的权重已与白板算法**同级**：

- **AI 协作轮**：给你半成品仓库 + 一个 agent，40 分钟修复并解释。考的是任务分解、验收标准设定、对 AI 产出的审查——这正是你的 S1–S4 强项区。你在这一轮应该以「展示 Urgent.md 式工作法」为目标，而不是藏着它。
- **Code Review 轮**：一个 AI 生成的 PR，找出其中的坑。你的弱点会在这暴露：性能坑（Lesson 2.5/2.7）、统计坑（Lesson 2.3）你目前闻不出来。每月用自己仓库的 AI diff 做一次模拟 review。
- **算法轮**：仍然存在,这就是 3.1/3.2 的用途。目标不是 1900 分选手，是「1600 水平 + 能讲清思考过程」。

### 3.4 · 作品集 > 简历

你已有 9 个真实 URL 的页面 + 完整数据管线,超过绝大多数候选人。缺的动作：为 Arena（数据管线+prompt 工程）、Horoscope（复杂领域建模+518 测试）、战斗 HUD（性能与范围裁决）各写一篇「我如何与 AI 分工」短文——素材直接从 RELEASE_NOTES.md 提炼，SPAR 复盘记录直接转 STAR 故事。

---

## Chapter 04 · The 2026 Data Analyst Playbook

> **分工铁律**：AI 写全部 Pandas/SQL 语法；你**只**负责业务逻辑与数据叙事。你在语法上花的每一分钟都是浪费——这条你在自己项目里已经执行（S2 的数据预消化就是这个分工），本章把它系统化到 DA 领域。

### 4.1 十二周路径（Business Frameworks 先行）

| 周 | 内容 | 产出（必须是能给别人看的东西） |
| --- | --- | --- |
| **W1** | **需求翻译专周——一行代码不许写。** 把模糊业务问题翻成可度量分析问题：北极星指标、反指标、「这个分析改变谁的什么决策」一票否决制 | 10 份「业务问题 → 分析问题」转写 |
| W2 | 业务框架续：漏斗/同期群/单位经济学三个框架各配一个转写练习 | 3 份框架应用笔记 |
| W3–4 | 统计判断（对接 Lesson 2.3）：每课一个「AI 算的结果哪里可疑」找茬 | 找茬记录 8 条 |
| W5–7 | **案例 1 · Churn Prediction** | 模型 + 一页决策备忘录 |
| W8–9 | **案例 2 · Real-time BI Dashboard** | 可分享 URL 的活看板 |
| W10–11 | **案例 3 · Unstructured Data Parsing** | 结构化表 + 质量报告 + 叙事简报 |
| W12 | 自命题组合冲刺：任选公开数据 | 作品集条目（URL + 一页备忘录 + 编排流程图） |

### 4.2 三个实战案例的人机分工

1. **Churn Prediction（电信/订阅公开数据集）**
   AI：特征工程草案、模型代码。
   你：定义「流失」口径、审计数据泄漏（AI 最常犯——「好到不像话的 AUC 先怀疑泄漏」）、选业务可解释的模型、把 AUC 翻译成「挽留预算该花在哪 5% 用户」。
2. **Real-time BI Dashboard（模拟事件流/公开 API）**
   AI：自包含 HTML 看板全部代码（你已有 build-dashboard 级别的产出能力）。
   你：KPI 层级设计（一屏 ≤5 个数字，对接 Lesson 2.8 的层级维度）、告警阈值逻辑、「凌晨 3 点值班的人 10 秒能不能看懂」可用性测试。
3. **Unstructured Data Parsing（几千条评论/工单 → 结构化仓）**
   AI：LLM 抽取管线。
   你：设计抽取 schema、**建 Eval Set 验收抽取质量（见 4.3，本案例的真正课程）**、把主题聚类讲成产品建议。

### 4.3 核心进阶技能：给 AI 的数据工作建 Eval Set

> 2026 年 DA 与「会用 AI 的实习生」的分界线就在这。流程固定五步：

1. **抽样**：从 AI 处理过的数据里分层随机抽 100 条（不许挑好抽的）。
2. **人工标注 ground truth**：你亲手标。这 100 条是你的黄金集，成本就是护城河。
3. **定义指标**：抽取任务用字段级 accuracy / precision / recall；叙事类输出用 rubric 打分（1–5 分，标准写死在文档里）。
4. **设及格线**：先跑一次拿基线，及格线 = 基线之上有业务意义的阈值（如「字段准确率 ≥95% 才允许入仓」）。
5. **回归运行**：每次改 prompt / 换模型都重跑黄金集——你 prompts/README.md 的「解析失败重试一次后放弃并记日志」纪律直接平移过来。

**练习衔接**：先拿你自己的 Arena 复盘文案或 sectors 数据管线练一轮迷你 eval（20 条即可），再上 W10 的正式案例。

### 4.4 贯穿纪律（与 Ch01 Playbook 同构）

需求写进文件再开工（R5）；AI 产出必过 sanity-check 清单；每周产物必须有 URL 或一页纸，「我学了」不是产出;所有分析结论过 Lesson 2.3 的显著性三问。

---

## Chapter 05 · The AI Infrastructure & MTS Track

> **定位**：把技术能力推向顶级 AI 公司（Anthropic / OpenAI）与顶级量化机构的招聘水位。本章由 Fable 5 以 Principal Engineering Mentor 视角设计，把职业进阶当成一个严格工程化的系统：有基线、有度量、有 4 周一次的自动重校准（见 §5.6）。

### 5.0 基线校准：目标画像 vs 你的当前坐标

Anthropic 工程团队的已验证画像（本章的设计输入）：

| 事实 | 数据 | 对你的含义 |
| --- | --- | --- |
| 本质是「基础设施系统工程军团」 | 40% 工程师来自 backend / 分布式系统 / 数据库 / 集群 infra；仅 3.3% 专攻 RLHF | 最大的门在 infra，不在 ML 理论——这是 Pillar 1 权重最高的原因 |
| 经验重于学历 | 行业经验中位数 12.2 年；仅 13.7% 有 PhD；主流是 FAANG / Stripe / Databricks / Snowflake 背景的 BS/MS 实战派 | 你不需要读博。你需要可验证的系统工程战绩 |
| 扁平结构 | 80% 头衔是 Member of Technical Staff (MTS)，要求高度自治与端到端所有权 | Ownership 是一个独立可训练的技能维度——Pillar 3 |
| 「天才少年」管道 | <3 年经验的 junior 只走极端筛选：IOI 银牌、Codeforces 2900+、Citadel / Jane Street 校友 | **这扇门对你数学上已关闭**（见下方两门论） |

**两门论（本章最重要的战略裁决）**：进入这类公司有两扇门。**门 A（天才少年门）**：CF 2900+ 是全球前 ~200 名的段位，从你当前的 800 起点，这不是努力问题，是路径不存在——任何声称能带你走这扇门的课程都是欺诈。**门 B（资深工程师门）**：12.2 年经验中位数、40% infra 背景意味着这扇门收的是「分布式系统深度 + 端到端战绩 + 可展示的工程判断力」，且它对大龄、无 PhD、非名校完全开放。**本章全部资源押注门 B**；Ch03 升级后的算法训练（§5.2）只作为门 B 的信号增强器（过面试算法轮 + 量化逻辑底子），不是门本身。这个裁决每次 gap analysis 重审一次，但推翻它需要 VC 曲线给出异常证据。

**你的当前坐标（对照门 B 的三支柱）**：Pillar 1 infra ≈ 入门（有 Vercel 部署+定时任务管线，但无分布式系统/数据库内核知识，styles.css 的债说明单机架构力也待补）；Pillar 2 算法 ≈ 起步（Ch03 P1 未开始）;Pillar 3 ownership ≈ **意外地强**（一人运营 9 页站点+数据管线+事故回滚记录 f2836e3，这就是微缩版 MTS 日常）。差距最大处 = Pillar 1，这决定了初始权重。

### 5.1 Pillar 1 · Distributed Systems & Cluster Infra（初始权重 50%）

> 现代 AI 的真正瓶颈是算力集群与数据管线，不是模型 idea。策展纪律沿用 Ch02：不自编教材，指向原始出处。

**课程序列（按依赖排序，预计 12–18 个月，与 4 周循环联动调速）**：

| 阶段 | 源（strictly curated） | 出口标准（可验、不可自欺） |
| --- | --- | --- |
| I1 · 单机根基 | 《Designing Data-Intensive Applications》(Kleppmann) 第 1–2 部分 + MIT Missing Semester profiling 讲 | 每章写一页「本章概念在我自己站点哪里出现过/缺失」映射笔记 |
| I2 · 数据库内核 | CMU 15-445 (Database Systems)，含 BusTree/B+Tree、buffer pool、事务两讲的 project | 完成至少 2 个课程 project 并通过其自带测试 |
| I3 · 分布式系统 | MIT 6.824 (Distributed Systems)——**labs 是主体，讲义是配菜** | Lab 2 (Raft) 与 Lab 3 (KV on Raft) 通过全部官方测试 |
| I4 · 集群与 AI infra | 6.824 之后：公开的 GPU 集群调度资料（Kubernetes 官方文档 + 各大厂公开的训练 infra 工程博客，按季巡检更新清单） | 把你的定时任务管线重构为「队列 + 幂等 worker + 失败重试 + 可观测」的正式管线，写 RFC 先行 |

**AI 协作红线（本 Pillar 特有）**：6.824/15-445 的 lab 代码**必须自己写**——这是 Ch03 SPAR 纪律在系统课的平移：AI 只许出现在（a）概念答疑（b）你代码 AC 后的 review 对比（c）设计变体讨论。让 AI 写 Raft = 烧掉整门课。

**与你现有资产的接驳**：你的 arena/sectors 数据管线就是练手场。I1 学完 replication 那章，你应该能回答「我的 push-data.sh 管线在哪些故障模式下会双写/丢写」（f2836e3 那次双跑事故就是活教材）。

### 5.2 Pillar 2 · Elite Algorithmic & Mathematical Logic（初始权重 25%）

> Ch03 的 P1–P4（800→1600）不变，仍是前置。本节在其上加两级 + 量化逻辑轨。

| 阶段 | 段位带 | 主题 | 出口标准 |
| --- | --- | --- | --- |
| P5 | 1600–1900 | 进阶 DP（区间/状压/树形）、图论（最短路/并查集/拓扑）、组合计数 | VC 稳定 3 题；Div.2 C 题 45 分钟内独立 AC |
| P6 | 1900–2100+ | 数据结构（线段树/BIT）、DP 优化、博弈论、数论 | 达到 CF Candidate Master 区间（全球前几个百分点） |

- **配速不变**：仍是每周 3 题 + 每月 1 场 VC——P5/P6 的题更重，单题投入自然涨到 60–90 分钟，总时长靠题量守恒控制（W4 红线）。SPAR 四步照旧强制。
- **量化逻辑轨（新增，每周 1 题，替换原第 3 题而非追加）**：Jane Street / Citadel 风格的概率与期望谜题——源用《Fifty Challenging Problems in Probability》(Mosteller) + MIT 18.05 习题集。出口标准：能在白板上无纸笔心算条件概率与期望值的两步推导。这条轨同时服务 Ch02 Lesson 2.3 与量化机构面试。
- **诚实上限声明**：P6 出口（2100）已是业余训练在可持续配速下的现实天花板信号，且足以通过门 B 的算法轮。2900 不在任何计划里，见 §5.0 两门论。

### 5.3 Pillar 3 · End-to-End System Ownership（初始权重 25%)

> MTS 的定义：没有 PM 给你写需求、没有 TL 给你拆任务、没有 SRE 给你兜底。这个技能可以在你自己的站点上全真训练——把 feida.au 当成你负责的生产服务运营。

- **O1 · RFC 先行制**：任何超过 1 天的改动先写一页 RFC（问题/方案/备选/风险/回滚），存 `rfcs/` 目录。你的 C5 Astro 评估（roadmap §8.4）已经是一篇合格 RFC——把这个偶发行为变成制度。
- **O2 · 生产纪律**：给站点定义 SLO（可用性、主 chunk 体积预算、移动端 LCP），每月对照一次;每次事故（如 f2836e3 双跑）写 blameless postmortem 存档——这些文档在门 B 面试里就是你的「12 年经验等价物」，是简历上写不出来的东西。
- **O3 · 季度自主项目**：每季度一个无外部规格的自命题项目，完整走 RFC → 实现 → 部署 → 复盘 → 对外写作（工程博客一篇）。对外写作不可省略：FAANG/Stripe 系工程师的公开可见度就是这么积累的。
- **O4 · 端到端边界拓展**：当前你的栈止于「静态站 + 定时任务」。按 I3/I4 进度逐季把边界推向：真实后端服务（带数据库）→ 队列化管线 → 有 SLO 的多组件系统。每一步的产物都必须真实运行在生产 URL 上。

### 5.4 MTS 基线评分卡（gap analysis 的度量标准）

> 每 4 周由自动循环（§5.6）评一次，分数写进本节历史表。评分必须引用证据，禁止印象分。

| 维度 | 度量信号 | 当前 (2026-07-12) | 门 B 水位 |
| --- | --- | --- | --- |
| Infra 深度 | 课程序列阶段 + lab 测试通过数 + 管线 RFC 质量 | I1 未开始 → **1/10** | I4 完成 + 生产管线 ≈ 8/10 |
| 算法 | CF 段位 / VC 曲线 | 未定级 → **1/10** | 稳定 1900+ ≈ 7/10 |
| 数学逻辑 | 量化谜题周正确率 + 复盘质量 | 无数据 → **–** | 心算两步期望推导 ≈ 7/10 |
| Ownership | RFC 数、postmortem 数、SLO 达标率、对外文章数 | 有雏形无制度 → **4/10** | 制度化运转 4 个季度 ≈ 8/10 |

**评分历史**：

| 日期 | Infra | 算法 | 数学 | Ownership | 下周期权重调整 |
| --- | --- | --- | --- | --- | --- |
| 2026-07-12 | 1 | 1 | – | 4 | 初始：50/25/25 |

### 5.5 与 Ch03/Ch04 的关系（必须直面的赛道分岔）

- **Ch03**：被本章吸收为 Pillar 2 的前置（P1–P4 → P5–P6 连续阶梯），SPAR 与每月 VC 完全沿用。无冲突。
- **Ch04（DA Playbook）与 Ch05（MTS Track）是两条职业赛道，在每周 ≤10 小时预算下不可并行。** 这是数据结论不是态度：Ch04 要 12 周全预算，Ch05 的 I1–I4 要 12–18 个月全预算。我的建议：以 MTS 为主赛道时，Ch04 降级为「已具备的对冲选项」——其 W1–2 业务框架和 4.3 Eval Set 方法论已被 Ch02/你的 prompts 规范覆盖大半，真需要 DA offer 时可以 12 周内快速兑现。**这个分岔由你裁决，写进下一次 §1.6 日志；~~在你裁决前，4 周循环按 Ch05 主赛道运行~~（2026-07-12 v3.0 划掉：主赛道改为「待 Ch06 定向测评后裁决」，见 §0.4——测评数据出来前不预设任何分支为默认）。**
- **时间预算重分配（Ch05 主赛道下）**：每周 ≤10 小时 = Pillar 1 约 5h + Pillar 2 约 3h（3 题含量化题）+ Pillar 3 约 2h（RFC/复盘/写作）。附录的节奏总控条款同步更新。

### 5.6 · 4 周自动评估循环（The Assessment Loop）

由定时任务 `mts-gap-analysis` 执行，机制：

1. **触发**：每 4 周（受 cron 表达力限制按月近似，与 Ch01 复盘任务错开半月形成双周自省节奏）。
2. **评估**：采集本周期 git 产出、SPAR/VC 记录、lab 测试通过数、RFC/postmortem 产出，对照 §5.4 评分卡打分（引用证据）。
3. **Gap analysis**：识别三支柱中的最弱环，检查两门论是否仍然成立。
4. **动态改写**：更新 course.md 的 §5.4 评分历史与下周期任务难度（最弱环加权重，已达标维度升难度），同步更新 course.html 的 Chapter 05 卡片要点；commit 并 push（仅限这两个文件），使 https://feida.au/course.html 保持与实际水平同步。
5. **熔断条款**：若连续两个周期评分停滞且工时记录显示超预算，循环必须下调难度而不是催促加班——课程适应人，不是人适应课程（W4 铁律）。

---

## Chapter 06 · Interactive Mentorship & Assessment Loop（v3.0 新增）

> **性质变更声明**：从 v3.0 起，Fable 在课程范围内不再是「答案供应商」，是导师。这不是语气偏好，是训练机制——W3 的成因就是「AI 代写 + 行为验收」跳过了你自己的思考回路。

### 6.1 导师制协议（即时生效）

- **双模式边界**：站点生产工程（修 bug、推送、定时任务）照旧执行模式，不受本协议影响。**凡落在 Ch00 技术树节点范围内的提问，默认导师模式**。
- **导师模式规则（SPAR-P 全局化）**：不给完整答案。第一层只指出你思路里最关键的一个漏洞或给一个反问；你说「下一层」才继续；每层 ≤2 句；三层后仍卡，给方向性伪码，仍不给成品代码。
- **豁免条款**：说「直接给答案」可豁免单次——但豁免会记入 §6.5 备注列。豁免频率本身是评估数据（频繁豁免 = 该节点难度超前，降节点而不是降纪律）。
- **反哺**：每次导师式问答后，若暴露了新弱点，在对应维度扣分理由里引用该对话，不凭印象。

### 6.2 三维评分卡（0–10，评分必须引用证据）

| 维度 | 覆盖范围 | 度量信号 |
| --- | --- | --- |
| **D1 · Programming Mastery** | 架构判断、UI/UX 实现（对接 Lesson 2.8 四维）、整洁代码 | 微测得分；R6 周架构审视记录；「AI 产出 review 时抓到的真问题数」 |
| **D2 · Math Logic & Algorithms** | 复杂度直觉、CF 式解题、量化谜题 | SPAR 记录；VC 曲线（与 §5.4 共享数据）；量化题周正确率 |
| **D3 · AI/LLM Intuition** | prompt/上下文工程、输出评估、eval 设计、Claude 上下文窗口的实际运用 | 黄金集质量；上下文预算表；微测；豁免频率（反向指标） |

### 6.3 测评节奏

- **微测**：每周 1 次，≤30 分钟，三维轮换。由互动会话出题（编码小题 / CF 式题 / 架构思想实验 / eval 设计题），结果当场评分写入 §6.5。
- **月度汇总**：并入每月 12 日 `course-ch01-monthly-review`——回顾三维曲线，识别停滞维度。
- **架构思想实验**：每月至少 1 道无代码纯裁决题（如「styles.css 7444 行，给三个重构方案和你不做哪个」），专攻 W1。
- **熔断**：连续两周微测缺席 → 下调当周其他课程负载而不是补测（W4 铁律：课程适应人）。

### 6.4 定向测评 #1（placement · 2026-07-12 已发）

三部分各对应一维，题面见当日会话记录。规则：D2 部分独立完成（25 分钟计时、无 AI，SPAR-S 纪律）；D1/D3 可查资料不可让 AI 代答；提交后按 §6.2 评分，主赛道裁决写入 §0.4。

### 6.5 评分历史

| 日期 | D1 | D2 | D3 | 事件 | 备注 |
| --- | --- | --- | --- | --- | --- |
| 2026-07-12 | – | – | – | 定向测评 #1 已发 | 待提交；基线未定 |
| 2026-07-13 | 6 | – | 7 | weekly review | R3 积压 10 项达上限 2 倍 + 夜间占比创本课新高（本周 72.7% vs 基线 40%+）——建议下周课程负载封顶而非表扬产出 |
| 2026-07-20 | 6 | – | 7 | weekly review | 夜间占比首次回落（72.7%→58.1%）+ 构建体积持平，但 Urgent.md/roadmap.md 本周删除导致 R3 实时跟踪表消失，且一条误标提交把 1776 个一次性构建产物混入 git 未清理——分数持平不是因为没变化，是收益与新失误相抵 |

---

## 附 · 课程运行机制

- **节奏总控**：~~Ch05 主赛道下按 §5.5 分配（Pillar 1 ≈5h / Pillar 2 ≈3h / Pillar 3 ≈2h）~~（2026-07-12 v3.0：主赛道待定期间按 §0.4——主干 T2/T3 + Ch06 测评，裁决后按所选分支的配比恢复）；Ch02 按课嵌在空档，每周至多 1 课；Ch06 微测每周 ≤30 分钟计入总预算。总时长预算每周 ≤10 小时——按 W4 的证据，超过这个数的计划都会以崩溃结束。~~Ch03 与 Ch04 并行~~（2026-07-12 起 Ch03 并入 Pillar 2，Ch04 状态待 §5.5 赛道裁决）。
- **复盘周期**：~~每月 12 日 `course-ch01-monthly-review` 重跑 Ch01 画像；每月 26 日 `mts-gap-analysis` 跑 Ch05 评分卡~~（2026-07-12 U20 修正：这两个任务实际从未存在——Ch01 月度画像已并入 `course-weekly-review`（每周一 20:00 周报，每月第二个周一附加画像重跑）；`mts-gap-analysis` 待 §0.4 主赛道裁决为 Branch B 后再创建）。画像必须跟着数据走，不跟着感觉走。
- **红线沿用**：不设排行榜、不搞 30 天速成、进度只和自己的历史比。
