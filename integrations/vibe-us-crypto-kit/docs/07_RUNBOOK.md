# 本地开工与运行

## 1. 解压位置

将整个目录放到 Afflatus 工作区的 `integrations/vibe-us-crypto-kit/`。不要把本包 AGENTS.md 覆盖到宿主根目录。直接把 `CODEX_PROMPT.txt` 给 Codex，并让它从 P0 开始。

## 2. 获取并盘点源码（需联网）

```bash
python scripts/doctor.py
python scripts/bootstrap_upstream.py
python scripts/inventory_upstream.py --strict
```

已有干净源码可用 `--dest /path/to/checkout --verify-only`，并向 inventory 传同一个 `--upstream`。不存在指定 SHA、关键 blob 不符或源目录有改动时会停止。修复网络后使用新的空目录重跑；不要把失败后的部分 checkout 当成功。

`extracted/source-review/` 是保守审阅切片，不是完整可单独构建的纯 US/Crypto fork。`vendor/vibe-trading` 保存可验证原版供适配运行，目标功能在 bridge/工具 registry 的边界上限制；后续有测试证明依赖独立后才物理移除混合市场代码。

## 3. 新文件复制（默认 dry run）

```bash
python scripts/apply_overlay.py --target /absolute/path/to/Afflatus
python scripts/apply_overlay.py --target /absolute/path/to/Afflatus --apply
```

遇到同名文件立即拒绝，不覆盖 package.json、站点路由、现有页面或现有 API。`--apply`只执行本地新文件复制，不 git commit/push/deploy。回执 `.vibe-overlay-receipt.json` 记录复制文件哈希；中途失败按回执检查，不盲目清目录。

## 4. Python 服务安装（本地集成验证步骤，不是本包已实测结果）

用 Python3.12 虚拟环境安装固定 checkout 和 bridge。优先核对上游 `requirements-lock.txt` 和安装说明，生产依赖要锁定；不要把未验证的范围依赖称为可复现生产镜像。

```bash
python3.12 -m venv .venv-vibe
. .venv-vibe/bin/activate
python -m pip install -e /absolute/path/to/kit/vendor/vibe-trading
python -m pip install -e /absolute/path/to/Afflatus/services/vibe-bridge
export VIBE_UPSTREAM_AGENT=/absolute/path/to/kit/vendor/vibe-trading/agent
# Generate a secret locally. Do not paste it into chat, source, or public output.
export VIBE_BRIDGE_TOKEN="$(python -c 'import secrets; print(secrets.token_urlsafe(32))')"
python -m uvicorn bridge.app:app --host 127.0.0.1 --port 8765 --workers 1
```

服务端开关应在同一受信环境设置。worker只继承允许的环境变量，不依赖订阅套餐、交易账户或LLM密钥。

## 5. 宿主 BFF 环境变量

```dotenv
VIBE_FEATURE_ENABLED=true
VIBE_BRIDGE_URL=http://127.0.0.1:8765
VIBE_BRIDGE_TOKEN=<same-server-secret>
ARENA_ADMIN_KEY=<existing-private-quota-key-at-least-32-characters>
VIBE_ENABLE_PUBLIC_MARKET_DATA=false
VIBE_PUBLIC_DATA_RIGHTS_ACK=
VIBE_PUBLIC_INSTRUMENTS=
```

生产 `VIBE_BRIDGE_URL` 必须 HTTPS。Vite普通 dev server不执行 `api/*.js`；本地需现有 serverless dev 方案或专门代理到经过相同校验的 BFF，**不能误认为 `npm run dev` 自动提供这些 API**。先以服务 curl 验证，再按宿主当前开发方式接入。不得将 bridge token 传给浏览器。

## 6. 页面挂载（Codex按实际入口合并，不是自动覆盖）

```js
// Inside the existing Arena entry, after the feature flag is enabled.
const root = document.querySelector('[data-vibe-markets]');
if (root) {
  const { mountVibeMarkets } = await import('./src/features/vibe-markets/index.js');
  const dispose = mountVibeMarkets(root, { locale: document.documentElement.lang.startsWith('zh') ? 'zh' : 'en' });
  // Use the host page's cleanup lifecycle when it has one.
}
```

import相对路径要由实际入口位置调整。新增 `<section data-vibe-markets></section>` 应在现有金融页内，不创建第二套页面导航。默认不开匿名数据的情况下，组件显示私人研究限制是预期状态，不可为了截图而把限制删掉。

## 7. 发布与回滚

第一版先私人/staging，确认数据公开权限再扩大访问。此包没有发布站点、配置云服务或提交GitHub。

回滚顺序：将 `VIBE_FEATURE_ENABLED=false`；停止新页面挂载；停止bridge；检查回执后只移除尚未修改的新增文件。保留既有 api/quote/api/history 和站点文件。后续个人研究数据独立持久存储时不得随代码回滚删除数据。

## 宿主适配后的本地命令

已审阅固定源码后，在本工作区使用 `python3 scripts/vibe-local.py`（工作区根目录）。它复核 pin、启动独立 bridge 与宿主 Vite，生成临时服务端凭据并仅绑定 loopback；`VIBE_LOCAL_RESEARCH` 的注入仅发生在本地受限 BFF，浏览器不接收凭据。该脚本不部署、不改变匿名访问范围。部署时不使用这个本地授权机制。

真实网络契约：`integrations/vibe-us-crypto-kit/.venv/bin/python integrations/vibe-us-crypto-kit/scripts/verify_live_loaders.py`。只保存 provenance/count/status，不发布原始行情。离线源测试和完整宿主失败详情见 validation/IMPLEMENTATION_TEST_REPORT.md。
