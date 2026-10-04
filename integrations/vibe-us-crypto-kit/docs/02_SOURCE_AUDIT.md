# 源码审计记录与来源

审阅日期：2026-10-05（Australia/Melbourne）。固定提交：`251b094320c1f97d1486626d3618113526914d4c`。

## 已直接核对的关键文件

|路径|核对内容|
|---|---|
|`agent/api_server.py`|FastAPI assembler；sessions/runs/attribution/settings/uploads/channels/swarm/live/portfolio/connection 等路由分开注册。不能整体转发到公网。|
|`agent/src/market_data.py`|`fetch_market_data` 参数；明确市场识别；多数据源链；`max_rows` 抽样；`include_provenance`；来源/单位/复权元数据。|
|`agent/backtest/loaders/base.py`|OHLCV 校验、数据源错误、交易币种和归一化辅助。|
|`agent/backtest/engines/global_equity.py`|US/HK/CA/UK 共用引擎；美股 0 commission、分数股四舍五入、简化滑点等模型假设。|
|`agent/backtest/engines/crypto.py`|永续合约定位；maker/taker、资金费、保证金模式；strict 模式校验、风险数据及证据事件。|
|`agent/SKILL.md`|工具表、研究/回测/因子/Shadow/Swarm/交易连接器功能目录；技能内容不是运行能力证明。|
|`LICENSE`、`NOTICE`|MIT 顶层许可；Qlib Apache-2.0 等子组件归属；字体单独许可。|
|目录树 `agent/src/`、`agent/backtest/`|工具、量化、组合、策略、交易、会话、风控、治理、定时等路径存在性。|

对未完整逐行审阅的工具，矩阵使用“工具文档声明/路径存在性”，不标成“已验证实现”。没有在此环境运行上游回测、交易接口、市场网络请求或整站 build。

## 可复核源码 URL

基础路径：`https://github.com/HKUDS/Vibe-Trading/blob/251b094320c1f97d1486626d3618113526914d4c/`

将表中的相对路径附于该 URL 即可查看固定版本。锁文件保存五个关键文件的 Git blob SHA，下载时校验。**发现 commit 或 blob 不匹配应停止，不能默默改成 main 或套用旧路径。**

本包没有嵌入完整上游代码：容器无法直接从 GitHub 下载完整 checkout；本次通过 GitHub 连接器审阅源文件和目录。开工脚本在 Codex 所在的可联网环境抓取同一 SHA，或验证你已有的干净 checkout，再输出源码审阅切片和清单。该限制不影响本包原创桥接代码的离线测试，但意味着不能声称已验证完整上游安装。

## 第一阶段真实调用契约

```python
from src.market_data import fetch_market_data
fetch_market_data(
    codes=["AAPL.US"], start_date="2026-01-01", end_date="2026-02-01",
    source="yahoo", interval="1D", max_rows=0,
    include_provenance=True,
    max_fallback_attempts=1,
    loader_resolver=strict_resolver,
    fallback_chain_provider=lambda source: [source],
)
```

`max_rows=0` 是避免上游均匀抽样破坏 K 线连续性的关键；服务端仍限制区间≤366日和输出≤400根。桥接层按数据源名称和标的来源严格核对；上游解析器自动换供应商会被拒绝，而不是悄悄把不同交易所、复权方式或计价币混合。

## 不应包装成产品承诺的内容

美股引擎允许同日交易不是证券结算周期合规实现；源码的“零佣金”不等于真实完整交易成本。CryptoEngine 的固定资金费默认值是回测假设，不能当作历史观测。股票财务因子、GTJA191 的市场限制需要逐个看元数据。Skill 中的清算热力图、解锁、DeFi 收益等不代表已经有完整可用的数据接口。
