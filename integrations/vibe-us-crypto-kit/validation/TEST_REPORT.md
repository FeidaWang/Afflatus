# 实际验证报告

交付日期：2026-10-05。测试均在隔离工作容器执行，不是用户的 Afflatus 工作区或生产环境。

|验证层|实际结果|能够证明什么|
|---|---|---|
|Python pytest|82 passed|请求/市场边界、数据归一化、鉴权、错误态、缓存、请求体上限、静态盘点、源码校验、非破坏性复制；含合成 upstream 子进程契约与凭据不继承检查|
|Node 内置测试|51 passed|代理默认关闭、私有/公开授权门、固定目标、限额、响应体积/格式、来源/计价币/时间与 OHLC 校验、注册表一致性|
|Chromium 内存 DOM 冒烟|10 项检查通过；0 page errors|英/中文、US/Crypto切换、USD/USDT、日线非实时报价标签、30行数据表、390px无整页横向溢出、键盘焦点、403错误态、unmount|
|Python 语法|15 个文件通过 AST parse|源码语法正确，不等于真实 upstream 全依赖运行成功|
|JavaScript 语法|5 个文件通过 Node module syntax check|源码语法正确，不等于宿主 bundler 已构建|

环境版本在 `environment-and-syntax.json`；原始日志为 `pytest.txt`、`node-tests.txt`、`browser-tests.txt`。截图 `browser-desktop.png` / `browser-mobile.png` 顶部明确标为合成数据，不是行情截图或最终站点设计。

## 浏览器验证的具体限制

容器的 Chromium 禁止浏览器访问本地 HTTP 地址；未修改或绕过该策略。最终验证改用不发起网络请求的内存 DOM harness。仅在测试中移除模块 import/export，并将原 stylesheet 注入测试文档；组件和 client 函数主体保持原样。

因此该测试验证组件 DOM/交互，不验证 ES module 解析、Vite build、serverless BFF 路由、实际网络、跨源、宿主CSS或生产性能。测试时发现并修复 select 的明确无障碍标签问题。

## 本次没有完成、不能据此宣称通过

- 完整上游 checkout 下载：容器网络/DNS不可用；已通过 GitHub 连接器审阅并记录固定 SHA、关键文件内容和 blob，联网提取脚本仍待 Codex 执行。
- 全部高级功能移植、真实运行时 tool registry 全量枚举、上游测试集。
- 真实 Yahoo / OKX / 其他提供商请求、密钥或数据分发许可验证。
- Afflatus 整站 typecheck / build / 原有质量门禁和线上浏览器回归。
- WebSocket、盘中实时行情、期权、回测、Agent、账户、paper 或实盘执行。
- GitHub 写入、云服务创建、生产部署或访问范围变更。

**结论：可交付的 Codex 开工包与已离线验证的首段接入实现，不是已全部迁移并部署的 Vibe-Trading 分叉。**
