# Vibe-Trading → Afflatus：US Stock + Crypto 开工包

**交付形态：固定版本源码提取器 + 功能迁移矩阵 + 可测试接入骨架 + 按优先级实施指令。**

已经提供：US股票/ETF及OKX Crypto现货的受限日线桥、Vite挂载组件、服务端代理、默认关闭/权限/来源校验、离线测试、固定源码校验与自动盘点脚本。

没有声称完成：全部高级能力迁移、完整上游源码嵌入、真实行情网络测试、宿主整站构建、生产部署。完整源码由Codex在联网环境按SHA拉取；无网络时脚本停止。`docs/01_FEATURE_MATRIX.md`覆盖已识别功能，开工盘点会继续发现和拦截未分类项。

## 直接开工

把本目录放到 `Afflatus/integrations/vibe-us-crypto-kit/`，将 `CODEX_PROMPT.txt` 全文交给Codex。它应读取你的实际代码再合并，不要手工覆盖根 package.json/AGENTS.md 或任何现有页面。

## 读哪些文件

|文件|用途|
|---|---|
|`CODEX_PROMPT.txt`|可直接发送的工程执行指令|
|`docs/01_FEATURE_MATRIX.md`|逐项功能、市场、证据级别与验收边界|
|`docs/02_SOURCE_AUDIT.md`|真实源文件、固定提交和本次审阅限制|
|`docs/03_ARCHITECTURE.md`|保留现有Vite站点的接入方式|
|`docs/04_PRIORITIZED_ROADMAP.md`|P0–P6模块顺序与验收|
|`docs/05_SECURITY_AND_DATA_RIGHTS.md`|公开数据权限、交易/Agent隔离、费用|
|`docs/06_ACCEPTANCE.md`|测试层级和完成判定|
|`docs/07_RUNBOOK.md`|本地提取、复制、安装、挂载、回滚|
|`docs/08_HOST_INTEGRATION_MAP.md`|已核对的Afflatus接入路径|
|`validation/TEST_REPORT.md`|本包实际执行的验收结果|

## 三条不能弄错的事实

当前宿主实际依赖是 **Vite 8 / React19.2**，不要沿用旧 Next.js 架构假设。上游 **CryptoEngine 是永续合约模型**，不是现货账本。上游 MIT **代码许可不等于财经数据公开再分发许可**。

本包不含任何个人余额、持仓、凭据或原站机密，不启用实盘、不新建云资源、不自动发布。
