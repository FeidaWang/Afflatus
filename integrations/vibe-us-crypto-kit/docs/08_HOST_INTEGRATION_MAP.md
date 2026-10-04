# Afflatus 当前接入点

以下来自本轮实际仓库读取，不以旧工程记忆为准。Codex开工时仍需复核当前工作区。

|已确认路径|观察|集成动作|
|---|---|---|
|`package.json`|Vite `^8.0.14`、React `^19.2.0`，MPA构建、Vitest、Playwright、大量站点/数据质量门禁|保持栈；不迁入Next.js；不全量升级依赖|
|`vite.config.js`|`appType: mpa`；输入来自 `BUILD_ROUTES`；静态404；CSS/data bridge 内联|不改成SPA；新增组件走已有入口，必要时 lazy chunk|
|`src/config/siteManifest.js`|路由/SEO/构建统一清单；Arena QF-01、technical analysis、model ledgers|目标候选为 Arena，不猜 `stocks.html` 路径；无需另加顶栏|
|`arena.html`|根目录存在的市场情报页面|最终挂载位置需读取全页及脚本链后确定|
|`api/quote.js`|Finnhub proxy；当日公开allowlist；x-arena-key 配额门；私有no-store；源验证/短缓存|保持现有即时报价链路；不把新日线close替代成live quote|
|`api/history.js`|已确认现有文件|Codex读取实现后决定共用DTO，不直接覆盖|
|`api/treasury-yields.js`|已确认现有文件|保持现有宏观接口|
|`public/lib/data-bridge.js`|Vite配置实际引用|先审阅数据发布与缓存行为，再接新模块；不直接往静态JSON写私人数据|
|`THIRD_PARTY_NOTICES.md`、`LICENSE`|根目录存在|新增上游归属；不变更宿主整体许可|

来源：
https://github.com/FeidaWang/Afflatus/blob/main/package.json
https://github.com/FeidaWang/Afflatus/blob/main/vite.config.js
https://github.com/FeidaWang/Afflatus/blob/main/src/config/siteManifest.js
https://github.com/FeidaWang/Afflatus/blob/main/api/quote.js

没有证明当前线上部署与 main 完全一致；本轮没有访问生产部署后台、没有执行线上修改。不要写“已验证生产兼容”，应写“按当前源码结构准备，待集成门禁验证”。
