# 来源与许可证

本包依据本次用户指定仓库的专业工作流与当前 Arena 的实际集成接口，编写新的可运行研究、行情、会计、交易模拟和网页模块。

- 研究方法与工作流参考：[FeidaWang/financial-services](https://github.com/FeidaWang/financial-services)，提交 `574ed3624aebd0418c7e96cd101262f30210ab26`。该仓库是 Anthropic financial-services 的 fork，源许可证为 Apache License 2.0。
- 完整上游根许可证保留在 `licenses/financial-services-APACHE-2.0.txt`。相关 Anthropic、S&P Global、Kensho、LSEG 及其他供应商的商标、数据与服务权限仍属于各自权利人。
- 接入宿主：[FeidaWang/Afflatus](https://github.com/FeidaWang/Afflatus)，本次审计基线 `edec43a8698d0e17ad9400728bafeeb82602a0f7`。宿主既有代码、内容、图片和商标保留原有权利与许可。本包的补丁不改变其授权。
- 包内新编写的升级代码按 Apache License 2.0 提供。没有暗示上游维护者或数据供应商认可该应用。
- React、Vite、jsdom、Neon 驱动等依赖按各自包中附带的许可证分发；依赖安装由 lockfile 固定，本 ZIP 不捆绑 node_modules。
- 商业 MCP URL 仅为审计得到的供应商配置资料。URL 存在不意味着已获得访问、抓取、公开展示、再分发或转售数据的许可。

`fixtures/` 和 `validation/demo-*.json` 内合成数据仅用于演示与测试，不能作为真实行情、财报、分析师预测或实际业绩的证据。

