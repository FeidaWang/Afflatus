# 安全、数据权限与成本边界

## 顶层许可不是数据再分发许可

Vibe-Trading 顶层 MIT 允许按许可条件使用/修改/分发代码，需保留版权与许可。NOTICE 明确 Qlib 特征定义另带 Apache-2.0 等归属；迁移因子时保留子目录 LICENSE/NOTICE，不只复制一个根 LICENSE。使用宿主项目原有许可证策略，不擅自把整个 Afflatus 重新许可成 MIT。

Yahoo/yfinance 可免 key 读取，不表示可把原始数据免费向公众或商业再分发。yfinance 官方明确其研究/教育用途以及 Yahoo 数据的 personal-use 条款提示。公开看板需逐供应商核对真实授权和再分发限制。本包默认关闭新数据桥的匿名访问；`VIBE_PUBLIC_DATA_RIGHTS_ACK=APPROVED` 只是运营配置，不是许可证本身。你现有获授权的行情接口保持不变。

参考：
https://github.com/ranaroussi/yfinance
https://github.com/HKUDS/Vibe-Trading/blob/251b094320c1f97d1486626d3618113526914d4c/LICENSE
https://github.com/HKUDS/Vibe-Trading/blob/251b094320c1f97d1486626d3618113526914d4c/NOTICE

字体不随本包分发。复用宿主字体，不上传/复制容器字体文件。

## 已实现的防护与未实现的边界

已实现：固定 instruments、固定数据源、固定日线操作、市场禁止项、日期/行数/数值/OHLC 校验、服务端 token、仅GET的BFF、无任意URL/路由代理、no-store、输出体积/超时限制、worker 不继承 LLM/交易所密钥、请求合并及小缓存、短进程超时终止。

未实现：分布式用户配额、真正的用户登录系统、个人数据多租户库、隔离执行不可信策略的沙箱、完整供应商限流与重试策略、部署平台验证、实盘风控。本包没有暴露需要这些能力的 API。短进程和过滤环境变量不等于沙箱。

`ARENA_ADMIN_KEY` 在当前宿主只是共享配额门禁，不是个人身份。本包沿用它**仅用于只读市场研究 endpoint**；不要把账户/持仓/会话/订单复用此鉴权方式。客户端密钥不得写源码、VITE_*、localStorage 或 public JSON；私人浏览器使用应通过将来的所有者会话代理注入授权，或在受信本地开发请求中测试。

## 严禁开放

- 通配 `/api/vibe/[...path]` 到整个 `api_server.py`。
- 任意命令、Python 代码、文件路径、MCP server、外部 URL 由匿名用户直传执行。
- 账户/私有研究/CDN共享缓存或生成在 `public/`。
- 下单工具与行情工具共享不可分割的 server API key。
- LLM 自动开启计费源、扩大预算、修改工具白名单、执行提款。

## 生产增强门禁

入口网关限制请求体，TLS、可信代理和真正限流；服务部署为非 root，只读根文件系统/固定 upstream mount，可写临时目录设配额。Bridge单进程适用于首版；多副本前需共享全局预算。不要把代码里的“每暖实例30次/分钟”误报为全账号总上限。

私有研究用 ownerId + 对象权限；敏感上传限制类型/体积、扫描和隔离；HTML报告默认下载/沙箱显示，避免持久XSS。只读账户密钥最小权限且禁提款，日志只输出错误码/请求ID，不记录 token 和原始账户报文。

## 成本

没有价格承诺。行情不调用 LLM；AI研究另计模型 API 成本，Codex订阅不会自动成为服务器无限 API 配额。来源回退必须在已批准供应商集合内；不得为“保证成功”悄悄启用付费源。本包不会安装云资源或新建付费服务。
