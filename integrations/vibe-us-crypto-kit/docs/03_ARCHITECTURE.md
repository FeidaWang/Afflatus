# 最小侵入式接入架构

## 推荐结构

```text
现有 Afflatus / feida.au（Vite MPA + React islands）
  arena.html / 现有双语入口、导航、QF-01
  ├─ 现有 /api/quote、/api/history             保持不变
  └─ 新增 lazy-loaded 市场研究组件
       └─ /api/vibe-market                   狭窄 BFF；只认固定 instrumentId
            └─ 私有 Vibe market bridge      token 鉴权 + 数据校验 + 有界缓存
                 └─ 固定版本 Vibe data loader

后续私人 Research 区域
  独立用户会话 → 有界 job queue → 隔离 research worker
  私有会话/回测/交易日志存储；公共发布只使用脱敏输出
  账户连接器与实时订单不与公开看板共用权限或进程密钥
```

不要把整个 Vibe 前端、路由器或 Electron 移进 Afflatus，不引入 Next.js，不新建第二套顶栏，也不在浏览器装 Python。先迁移功能和 DTO，再吸收确实有价值的图表交互。

初始部署只需现有站点 + 一个私有 Python 服务，不需要先上 Kubernetes、Redis、向量库、多 Agent 或多数据库。行情读操作有两进程并发、8 个 inflight 上限、128 项短期缓存；短进程用于清理生命周期，**它不是可运行任意生成代码的安全沙箱**。

## 已交付接入代码

`overlay/api/vibe-market.js` 与 `overlay/src/lib/vibeBridgeProxy.mjs`：新端点、固定参数、部署 allowlist、密钥只在服务器、禁通配转发、上游超时/重定向/体积约束、结构校验、no-store。

`overlay/services/vibe-bridge/bridge/`：FastAPI 只注册 health/instruments/bars；market_data 适配、校验、输出来源和时间信息；无订单/会话/文件/设置/任意代码入口。

`overlay/src/features/vibe-markets/`：原生 ES module 挂载组件，不需要新增 React 依赖；美股/Crypto 切换、日线、来源标记、最近30根数据表、双语、错误态、请求取消。初始图表是日线收盘线，**不是完整上游 K 线工作台**；蜡烛图/绘图/指标叠加归 P2。

## 数据身份

美股示例 `US:AAPL`；加密货币示例 `CRYPTO:OKX:BTC-USDT:SPOT`。使用市场、交易所、品种类型、计价币四层身份，不能只用 `BTC` 或 `MU` 推断全部上下文。合约另设 `crypto_perpetual` 和标记价格、交易价格、结算币种字段。

日线日期是供应商 bar/session 标签，不应当作 UTC 午夜成交时间；本包 API 暂不支持盘中，因此不会虚构盘前/盘后状态。后续盘中模型使用 UTC 时间戳 + 交易所 sessionDate，显示可转 Australia/Melbourne；US 用交易日历，Crypto 用24/7；不要把365和252混用。

## Vercel 边界

Python 重回测、浏览器渲染、定时任务、长期会话推荐独立 worker，原因是资源隔离、持久任务、超时恢复和密钥边界，不是声称 Vercel 完全不能运行 Python 或 WebSocket。Vercel 在2026-06-22公告了 Functions WebSocket public beta；具体账号能力/时长/计费在部署时复核。

官方参考：
https://vercel.com/changelog/websocket-support-is-now-in-public-beta
https://vercel.com/docs/functions/configuring-functions/duration

此包不要求开通任何新付费服务，也没有执行部署命令。
