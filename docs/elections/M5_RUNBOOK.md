# Elections 采集运行手册

现状：生产**没有**接任何来源，`ELECTION_FEED_BASE` 是 `null`，所有真实来源 `enabled: false`。下面的步骤只在本机运行。没有部署，也不要把存储目录放到 `public/` 或 `dist/`（采集器会拒绝）。

## 本机演示（VEC 公开样例，虚构数据）

1. 从 [VEC 2026 feed 页](https://www.vec.vic.gov.au/about-us/media/2026-results-data-feed) 下载 `Sample XML files - SE26.zip`（755 KB），解压到仓库外的空目录。文件不要放进仓库。
2. 录制快照：

```bash
node scripts/elections/collect.mjs --source vec-sample --dir "<解压目录>/website samples and summary (complete set)" --store /tmp/el-store --series
```

3. 构建并打开：

```bash
npm run build && node scripts/elections/serve-local.mjs --store /tmp/el-store
```

打开 `http://127.0.0.1:4180/en/elections.html?event=vic-2026`。状态带必须显示 `Synthetic test data`。

## 启用 VEC 真实 feed 之前必须做完

| # | 事项 | 由谁 | 时间 |
|---|---|---|---|
| 1 | 填 [feed 页](https://www.vec.vic.gov.au/about-us/media/2026-results-data-feed)上的 Access request form，并把签字的条款发到 resultsdatafeed@vec.vic.gov.au | 站主 | 尽快。批准后才有 token 和技术手册 |
| 2 | 书面询问 VEC：条款 1.2 是否允许在 feida.au 公开显示规范化后的结果。feed 页写明问题发 communication@vec.vic.gov.au | 站主 | 与上一条一起 |
| 3 | 用技术手册写真实传输层：列目录、取最新文件、token 走环境变量。现在只有 `directoryTransport` 和通用的 `urlTransport` | 开发 | 拿到手册后 |
| 4 | 11-10 用零文件确认 `EventName`，填进 `vec-2026.expectedEventName`；用官方政党文件核对 `PARTY_RULES` | 开发 | 11-10 起 |
| 5 | 选定运行环境和存储（见下），需要站主授权 | 站主 | 11-25 前 |
| 6 | 11-25 试运行：在**私有存储**里跑通一次，核对时间和字段。条款 5 禁止就试运行数据对外作任何表述，不得公开 | 开发 | 11-25 |
| 7 | 只有第 2 条得到肯定答复后，才把 `publicRedistributionAllowed` 和 `enabled` 改为 true 并设置 `ELECTION_FEED_BASE` | 站主决定 | 11-28 前 |
| 8 | 接任何美国来源前：按比赛校验（一场不合规不能拖垮全部）、决选和延后大选的日期、参议院留任席位来源。见 `M7.md` H4、M14–M16 | 开发 | 接美国来源前 |

### 运行环境（尚未选定）

| 方案 | 频率 | 费用与限制 | 留意 |
|---|---|---|---|
| Vercel Cron | Hobby 一天一次，Pro 每分钟 | Hobby 不够。套餐我没能从 API 读到 | 函数的时间限制需核对 |
| GitHub Actions 定时 | 最短 5 分钟，可能延迟 | 公开仓库免费 | 不能靠 git 提交发布数据，要配外部存储 |
| 这台 Mac 上的定时任务 | 随意 | 免费 | 选举夜不能关机或断网；仍要外部存储才能公开 |
| 存储：Vercel Blob | — | Hobby 免费额度 2000 次上传/月，超额停用 30 天 | 每 5 分钟一次，选举周末约 576 次。需新建 store 和 token |

单次运行不会重叠（`.lock`，10 分钟后视为残留）。

## 日常操作

每次运行输出一行 JSON：

| outcome | 含义 | 处理 |
|---|---|---|
| `published` | 新快照已发布 | 无 |
| `unchanged` | 没有新内容，只更新 `lastCheckedAt` | 无 |
| `partial` | 一院更新成功，另一院失败 | 看 `private/quarantine/` |
| `failed` | 全部失败，上一快照仍在线 | 看 `private/quarantine/`，按 `backoffUntil` 退避 |
| `backoff` | 还在退避期 | 等待 |
| `locked` | 上一次还在运行 | 持续出现就检查是否卡住 |

`kinds` 的值：`timeout`、`rate_limited`、`gone`、`malformed`、`schema_drift`、`wrong_identity`、`too_large`、`host_blocked`、`http_error`、`network`。出现 `schema_drift` 或 `wrong_identity` 时**不要绕过**，先核对 VEC 是否发了 schema 变更通知。

## 存储目录

```text
<store>/<event>/latest.json              指针，最后写入（原子）
<store>/<event>/snapshots/<id>.json      不可变快照，回放只读这些
<store>/<event>/private/                 采集状态和隔离记录，不对外
```

原始文件默认不保留，只存 SHA-256（`storeRaw: false`）。

## 回滚

把 `ELECTION_FEED_BASE` 改回 `null` 并重新部署，页面回到无结果的预览。把来源的 `enabled` 或 `publicRedistributionAllowed` 改回 false，已发布的快照也不会再被页面接受。
