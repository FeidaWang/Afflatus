# 机器学习全栈学习路线图

版本：2026-08-08

定位：基于指定机器学习笔记库的全部目录、讲义主题与更新状态，重组为一条“数学基础 → 经典机器学习 → 概率推断 → 深度学习 → 生成模型与强化学习 → ML 系统与 FDE 交付”的可验收路线。

## 1. 为谁定制

这条路线不是按大学课程编号平铺，也不是要求从第一份 PDF 顺序读到最后一份。它适合已经接触过编程，希望同时获得三种能力的人：

- 能推导：知道目标函数、估计量、泛化界和近似推断从哪里来。
- 能实现：不用框架黑箱也能实现核心算法，并能用框架扩展到真实数据。
- 能交付：能建立基线、评测、监控、权限、回滚和业务结果证据。

推荐主线为 72 周，每周 10–12 小时。已有数学或工程证据的模块可以跳过，但必须通过该模块的证据闸门。

## 2. 笔记库内容审计

指定资料库包含约 70 份 PDF、2 份 PPTX、1 份 Jupyter Notebook，覆盖以下知识群：

1. **基础机器学习**：模型评估、决策树、朴素贝叶斯、回归、神经网络、无监督学习。
2. **数学与概率**：概率估计、统计性质、优化、对偶、共轭梯度、随机矩阵。
3. **概率推断**：EM、MCMC、变分推断、状态空间模型、粒子滤波。
4. **学习理论**：集中不等式、Rademacher 复杂度、PAC-Bayes、JL 引理、NTK/NNGP。
5. **深度学习专题**：CNN、NLP、Transformer、图神经网络、推荐系统。
6. **生成模型**：VAE、IWAE、GAN、Normalizing Flow、扩散、SDE、Flow Matching。
7. **强化学习**：DQN、MCTS、策略梯度、TRPO、PPO。
8. **高级概率模型**：贝叶斯非参数、DP/HDP、IBP、完全随机测度、DPP、Copula。
9. **3D 视觉**：相机模型、对极几何、重建、深度估计、3D 姿态与深度结构。

资料的优势是数学脉络完整，并保留了从经典概率模型到 2026 年 Transformer、生成模型和策略梯度的演进。主要缺口有四个：

- 缺少统一的软件工程作业与自动化测试标准。
- 旧版课件和新版技术报告存在主题重复，不能按文件数量当作学习进度。
- 部分“近期研究”材料的时间点较早，需要把耐用数学与易变模型结论分开。
- 缺少数据治理、分布漂移、训练/推理基础设施、模型服务、安全与客户部署主线。

因此路线采用“知识主线 + 实现实验 + 故障注入 + 证据闸门”四件套。

## 3. 开始前诊断（第 0 周）

在进入主线前完成四个闭卷诊断：

- 数学：求一个二次函数的梯度/Hessian，解释特征值与条件数。
- 概率：从 Bayes 定理推导一个 Beta-Binomial 后验和后验预测。
- 编程：用 NumPy 实现线性回归梯度下降，不调用现成 estimator。
- 评测：面对 1:100 的类别不平衡，说明为什么 accuracy 会误导并设计指标。

若任一项不能独立完成，先执行“预备段”；否则直接进入第一阶段。

## 4. 预备段：数学、Python 与实验纪律（4–8 周）

### 必修主题

- 线性代数：向量空间、投影、特征分解、SVD、正定矩阵、矩阵微分。
- 微积分：多元链式法则、Taylor 展开、Jacobian、Hessian。
- 概率统计：随机变量、常见分布、期望方差、条件概率、MLE/MAP、置信区间。
- Python：NumPy 广播、向量化、随机数种子、类型、测试、性能分析。
- 实验纪律：训练/验证/测试隔离、数据版本、配置、随机性和可复现报告。

### 对应资料

- `probability.pdf`
- `statistics.pdf`
- `bayesian.pdf`
- `optimization.pdf`
- `AI_and_machine_learning.pdf`
- `industry_master_class.ipynb`

### 作品与闸门

建立 `ml-foundations` 仓库，实现线性回归、逻辑回归、PCA 和 K-means。每个模型必须有：公式推导、NumPy 实现、单元测试、复杂度说明、与 sklearn 的结果对照、失败案例。陌生人能在全新环境中一条命令复现实验才通过。

## 5. 第一阶段：经典监督学习与评测（第 1–8 周）

### 第 1–2 周：评测先行

资料：`foundation_model_evaluation.pdf`。

必修：混淆矩阵、precision/recall、ROC/AUC、PR 曲线、bootstrap、阈值选择、校准、置信区间、类别不平衡。

实验：为医疗筛查和欺诈检测分别选择指标。用相同 AUC 构造两组业务成本完全不同的模型。

闸门：报告阈值、错误成本、置信区间和数据切分；不得只给单一总分。

### 第 3–4 周：回归

资料：`foundation_regression.pdf`、`regression.pdf`。

必修：线性/多项式回归、最小二乘、正则化、偏差-方差、残差诊断、异方差、共线性。

实验：同时用闭式解、梯度下降和正规方程实现；在病态矩阵上比较稳定性。

### 第 5–6 周：概率分类与决策树

资料：`foundation_simple_bayes.pdf`、`foundation_decision_tree.pdf`。

必修：朴素 Bayes、条件独立、熵、信息增益、剪枝、卡方检验、概率校准。

实验：构造违反朴素独立假设的数据；观察概率错误与分类正确可以同时发生。

### 第 7–8 周：无监督学习

资料：`foundation_unsupervised.pdf`、`dimension_reduction.pdf`。

必修：K-means、层次聚类、PCA、主题模型、Word2Vec 基础。

闸门：能解释聚类“看起来漂亮”为什么不等于有业务意义，并用稳定性或下游任务验证。

## 6. 第二阶段：优化与神经网络基础（第 9–16 周）

### 优化主线

资料：`gradient_desend.pdf`、`dual.pdf`、`conjugate.pdf`、`optimization.pdf`。

必修：凸性、光滑性、强凸、学习率、SGD 收敛、隐式偏置、Lagrange 对偶、KKT、共轭梯度。

实验：在不同条件数的二次问题上比较 GD、动量、Adam、共轭梯度；画出收敛而非只报最终损失。

### 神经网络主线

资料：`foundation_neural_network.pdf`、`neural_networks.pdf`、`cnn_beyond.pdf`。

必修：反向传播、初始化、激活、归一化、卷积、残差网络、分类/度量学习损失。

实验：手写两层网络自动微分检查；故意破坏初始化、学习率和归一化，建立训练失败图谱。

闸门：不用“模型没收敛”概括失败，必须定位到梯度、数值、数据、目标或容量中的一类。

## 7. 第三阶段：概率建模与近似推断（第 17–28 周）

### 第 17–19 周：EM 与潜变量

资料：`intermediate_em.pdf` 为主，`em.pdf` 作补充。

必修：Jensen 不等式、ELBO、E/M 两步、GMM、局部最优、标签交换。

实验：实现 GMM-EM；用坏初始化和过多分量制造退化协方差。

### 第 20–22 周：Monte Carlo 与 MCMC

资料：`introduction_monte_carlo.pdf`、`intermediate_mcmc.pdf`、`markov_chain_monte_carlo.pdf`。

必修：逆 CDF、拒绝采样、重要性采样、MH、Gibbs、详细平衡、自相关、有效样本数。

实验：在多峰分布上展示链不混合；不能只凭轨迹“看起来稳定”宣布收敛。

### 第 23–25 周：变分推断

资料：`intermediate_vb.pdf` 为主，`variational.pdf`、`vb_nf.pdf` 作专题补充。

必修：KL 方向、ELBO、坐标上升、重参数化、均值场限制、Normalizing Flow。

实验：同一后验用 MCMC 与 VI 估计，比较方差低估和计算成本。

### 第 26–28 周：时序状态估计

资料：`intermediate_ssm.pdf`、`particle_filter.pdf`，旧版 `dynamic_model.pdf` 作参考。

必修：Kalman Filter、HMM、滤波/平滑、粒子退化、重采样。

闸门：在观测缺失、噪声错设和非线性情况下解释模型何时失效。

## 8. 第四阶段：学习理论（第 29–36 周）

按以下顺序学习，不建议一开始就进入 NTK：

1. `1.introduction.pdf`：经验风险、泛化与光滑优化热身。
2. `2.concentration_inequality.pdf`：Hoeffding、Bernstein 等集中界。
3. `3.rademarcher.pdf`：函数类复杂度与数据依赖泛化界。
4. `5.pac_bayes.pdf`：先验、后验与概率泛化保证。
5. `j_l_lemma.pdf`：随机投影与距离保持。
6. `4.ntk.pdf`、`ntk_init_nngp.pdf`、`gp_nn.pdf`：无限宽网络、NNGP 与 NTK。

证据闸门：

- 为一个有限假设类推导样本复杂度。
- 数值验证一条集中不等式，说明界的松紧。
- 比较参数量、范数、Rademacher/PAC-Bayes 复杂度的不同含义。
- 明确 NTK 是一种极限分析工具，不把它当作所有有限深网训练行为的完整解释。

## 9. 第五阶段：现代 NLP 与 Transformer（第 37–44 周）

### 经典 NLP 过桥

资料：`word_vector.pdf`、`intermediate_nlp.pdf`；旧版 `deep_nlp.pdf`/`deep_nlp2.pdf` 只作历史对照。

必修：负采样、GloVe/FastText、RNN/LSTM、Seq2Seq、attention、beam search、pointer network。

### Transformer 主线

资料：`transformer.pdf`（2026-06-22 版本）。

必修：scaled dot-product attention、causal mask、KV cache、RoPE、GQA/MQA、DeepSeek MLA、预填充与解码成本。

实验：

- 从零实现一个小型 decoder-only Transformer。
- 分别测量无缓存、有 KV cache、MQA/GQA 的内存与延迟。
- 构造长上下文“信息存在但无法使用”的任务，区分窗口长度与有效检索能力。

闸门：给出精确张量形状、FLOPs、显存模型与 profiler 证据，不接受只画架构图。

## 10. 第六阶段：生成模型（第 45–54 周）

建议以新版 `generative_models.pdf` 为总纲，再按问题回看专题：

- VAE/ELBO：`vae.pdf`、`reparameterization.pdf`
- GAN：`gan.pdf`，不重复学习旧版大小写冲突文件
- 方差降低：`variance_reduction.pdf`
- Softmax/Gumbel：`softmax.pdf`、`deecamp_2019.pdf`
- Neural ODE：`neuralODE_Adjoint.pdf`
- Bayesian + Deep Learning：`bayesian_inference_deep_learning.pdf`

必修顺序：MLE → ELBO → VAE/IWAE → Normalizing Flow → GAN → diffusion/SDE → flow matching。

实验：在同一二维数据上实现 VAE、GAN、flow matching，比较覆盖率、样本质量、训练稳定性与似然可用性。

闸门：不能把 FID 或几张好图当作完整评测；至少报告多样性、覆盖、重复试验和失败模式。

## 11. 第七阶段：强化学习（第 55–62 周）

资料顺序：

1. `dqn.pdf`：MDP、Bellman、Q-learning、DQN。
2. `mcts.pdf`：搜索树、探索/利用、AlphaGo 结构。
3. `intermediate_policy_gradient.pdf`：Policy Gradient、TRPO、自然梯度、PPO、共轭梯度。
4. `policy_gradient.pdf` 作旧版对照。

实验：同一控制任务比较 DQN 与 PPO；至少运行 10 个随机种子，报告均值、方差、崩溃率与样本效率。

故障注入：奖励缩放错误、终止状态处理错误、经验回放污染和评估环境泄漏。

闸门：训练曲线不能只挑最佳种子；策略必须在未见扰动下复测。

## 12. 第八阶段：专项分支（第 63–68 周，可选择两条）

### A. 3D 计算机视觉

资料：`cv_3d_foundation.pdf` → `intermediate_cv_3d.pdf` → `cv_3d_research.pdf`。

作品：相机标定、两视图重建、深度估计或多视图姿态；报告几何退化与尺度歧义。

### B. 贝叶斯非参数

资料：`non_parametrics.pdf` → `non_parametrics_extensions.pdf` → `random_measure.pdf` → `copula_dp.pdf`。

作品：DP mixture 或 HDP-HMM，实现采样与后验诊断。

### C. DPP 与多样性

资料：`dpp_new.pdf` 为主，`dpp.pdf` 作时变扩展。

作品：把 DPP 用于推荐重排，与仅按相关性排序比较覆盖和用户效用。

### D. 图与推荐

资料：`graph_cnn.pdf`、`recommendation.pdf`。

作品：构建图推荐或协同过滤基线，特别检查时间泄漏、冷启动和流行度偏差。

## 13. 第九阶段：ML 系统、Agent Harness 与 FDE（第 69–72 周）

原笔记库在这里结束，本路线必须补上真实交付层。

### 必修

- 数据版本、特征/标签定义、训练/服务偏差、漂移监控。
- 批处理与在线推理、队列、缓存、并发、成本和延迟 SLO。
- 模型注册、灰度、特征开关、回滚、事故响应。
- 身份、租户隔离、最小权限、审计和敏感数据边界。
- Agent 的工具契约、状态恢复、提示注入、任务评测与人工升级。
- 工作流基线、采用率、人工改写率、每个完成结果成本与能力交接。

### 毕业项目

选择一个真实但窄的业务工作流，为 5–10 位用户交付：

1. 先完成影子观察与问题简报。
2. 定义反事实、失败成本和停止条件。
3. 用真实、隐私安全的数据构建最小可行部署。
4. 建立 60 个任务的评测集和权限负向测试。
5. 先只读灰度，再开放一个可逆动作。
6. 演练模型退化、数据漂移、提供商故障、权限拒绝和回滚。
7. 交付代码、模型卡、数据卡、威胁模型、运行手册、事故复盘和客户交接包。

毕业闸门不是“模型精度达到某个数”，而是客户能独立运行系统，并能用证据说明哪个工作结果发生了改变。

## 14. 统一每周模板

每周固定四块，不允许只看讲义：

- 25% 理论：推导一个核心结论。
- 35% 构建：不用高级黑箱实现核心方法。
- 20% 故障：主动破坏一个假设。
- 20% 证据：测试、图表、决策记录和反思。

每周复盘回答：

1. 我原来的假设是什么？
2. 哪个实验推翻或支持了它？
3. 结果对数据、模型、系统还是业务决策有什么影响？
4. 下周删除什么，而不是继续叠加什么？

## 15. 评分规则

| 维度 | 权重 | 最高分证据 |
|---|---:|---|
| 数学理解 | 20 | 独立推导、假设清楚、能解释边界 |
| 实现正确性 | 20 | 测试、数值检查、与基线一致 |
| 实验设计 | 20 | 对照、重复、置信区间、无泄漏 |
| 故障诊断 | 15 | 主动注入并定位失败，不靠猜测 |
| 系统与安全 | 15 | 性能、恢复、权限、监控、回滚 |
| 沟通与反思 | 10 | 决策记录、被推翻观点与明确下一步 |

没有代码、测试、推导、数据或运行记录支撑的自评分，单项最高 4/10。

## 16. 未来线上教程分页面

建议把线上课程拆成以下页面，而不是做一个无限长目录：

- `/course/ml-foundations`：数学、概率、Python、评测。
- `/course/classical-ml`：回归、树、Bayes、无监督。
- `/course/probabilistic-inference`：EM、MCMC、VI、SSM。
- `/course/learning-theory`：集中界、复杂度、PAC-Bayes、NTK。
- `/course/deep-learning`：网络、CNN、NLP、Transformer。
- `/course/generative-models`：VAE、GAN、Flow、Diffusion。
- `/course/reinforcement-learning`：DQN、MCTS、PG、PPO。
- `/course/specialisations`：3D、BNP、DPP、图与推荐。
- `/course/ml-systems`：部署、可靠性、安全、评测与成本。
- `/course/agent-harness`：工具、状态、恢复、权限与长期任务。
- `/course/capstone`：真实工作流、最小部署与结果证据。

每个页面统一包含：先修诊断、概念图、必读材料、从零实现、故障注入、自动测验、项目模板、证据闸门与下一页解锁条件。
