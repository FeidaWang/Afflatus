# 实际集成验收 — 2026-10-05 Melbourne

本报告区分原包离线测试、固定源码离线测试、本地实网链路和宿主门禁。没有生产部署或线上验收。

本文件保留 P0/P1 验收历史；2026-10-05 继续实现的 P2 状态、105/366/51/16 项测试及最新门禁对照见 [P2_TEST_REPORT.md](P2_TEST_REPORT.md)。SEC 实网仍缺真实联系人，P4/P5 按用户本轮范围保持阻塞。

|层级|结果|证据|
|---|---|---|
|Bootstrap SHA / blobs|PASS，固定 251b094320c1f97d1486626d3618113526914d4c，原 5 blob 校验；runtime 再校验 loader/指标 blob|runtime-summary.log；bridge/upstream-lock.json|
|静态/运行时清单差集|PASS：142 静态候选，109 本地工具，76 MCP，102 API，90 技能，16 frontend routes；未知 0、导入/注册失败 0|static-summary.log；runtime-summary.log；../manifests/coverage.json|
|原包 Python|82 passed / 8 host-only skipped|overlay-kit-python.log|
|宿主 bridge Python|87 passed / 3 pinned-only skipped|host-kit-python.log|
|固定模块 + 宿主 Python|90 passed|pinned-host-python.log|
|原包 / 宿主 Node|各 51 passed|overlay-kit-node.log；host-kit-node.log|
|固定源码适用测试|175 passed，--disable-socket；离线，不是行情实网|upstream-applicable.log|
|新增宿主 Vitest|7 passed|host/new-unit.log|
|真实 loader|AAPL / SPY / BTC-USDT 均 PASS，无 mock|live-loaders.json；修复前失败保留 live-loaders-before-fix.json / live-diagnostics.log|
|真实本地 HTTP 链路|三标的均 200；真实日线 + 同源/asOf/完整输入的技术指标|live-http-p1.json；live-http.json|
|新模块浏览器|Chromium 英/中、1440×1000 / 440×956；真实源、键盘、无横溢、单一 Add Stock、断网清图表、flag 关闭|browser-*.log；../../../output/playwright/vibe/|
|凭据边界|浏览器 market 请求没有 Authorization / x-arena-key；秘密仅在本地服务端。未挂载账户/订单/文件/MCP路由|browser-request-headers.log；Node/Python 权限测试|
|宿主 typecheck/build|PASS，包括所有 prebuild/data/site/header/css/i18n/combat/OG/SEO 检查|host/final-typecheck.log；host/final-build.log|
|宿主 unit|FAIL：19 文件 / 96 项，与前基线相同；1848 passed（含新增 7 项）|host/baseline-unit.log；host/final-unit.json|
|宿主 browser-quality-gates|FAIL：54 failed / 2 passed / 16 skipped；集成前原 Arena entry/App 重建对照，失败集合一致，无新增|host/browser-quality-gates.log；host/baseline-browser-quality-gates.log；host/browser-comparison.json|

浏览器移动验收为视口模拟，不是真机/WebKit新功能验收。宿主原门禁有失败，不声称全部通过。首次实网揭示 trade_date 契约缺陷，已修正；OKX UTC+8 完成时间另加回归，未知 volume_unit 保持 unknown。技术指标不重新抓另一份价格、不启用 fallback、不将日线当 quote。原版测试仍保留；固定计数检查改为原始 ID/name 集合必须保留，新增能力不能通过删除来通过。

Kit 自带 validation/TEST_REPORT.md 与旧图片是导入前原包证据，不是本次宿主结果。P2整阶段及后续阶段未完成，见根 IMPLEMENTATION_STATUS.md。

技能分类基于固定源码加载出的元数据/说明及可见工具能力；conditional 项的完整支持脚本、市场分支与数据要求仍须在对应迁移阶段逐项验证。清单差集为零不表示这些模板已经通过功能验收。日志只去除了行末空白以满足 diff 检查，测试结果没有改写。
