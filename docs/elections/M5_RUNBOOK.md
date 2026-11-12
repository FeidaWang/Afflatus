# 维州 2026 开票运行手册

投票于 **2026 年 11 月 28 日 18:00 AEDT**（07:00 UTC）结束。VEC 公布的选举夜演练为 **11 月 25 日**。选举周末通常每五分钟生成一批结果，后续频率会随计票放缓。 [VEC 选举日程](https://www.vec.vic.gov.au/2026-state-election) · [VEC 数据源与演练](https://www.vec.vic.gov.au/about-us/media/2026-results-data-feed)

```text
VEC Azure results 容器或 SharePoint 手动 ZIP
  → Verbose V2 XML → 身份、时间与计票校验 → 本机私有快照
  → 站方私有 afflatus-elections 容器 → 同源只读 API → 选举页面
```

两个议院分别采集。下议院保留第一优先票、2CP、投票点进度及 VEC 宣布状态。上议院按大区显示票数和宣布状态。分组票不用于推断分配给个人的席位。公开 API 默认关闭，投票结束后还需要显式配置。没有可用结果时，页面保留选区地图、搜索和 VEC 官方入口。

## 选举日前验证

1. 从 [VEC 数据源页](https://www.vec.vic.gov.au/about-us/media/2026-results-data-feed) 下载公开的 2026 样本并解压到工作树外。Node.js 需支持 `node:zlib` 的 `crc32`（22.22+ 或 24）。
2. 运行回放并检查桌面和手机。样本只由回环地址提供，页面必须显示合成测试数据。

```bash
node scripts/elections/collect.mjs --source vec-sample \
  --dir "$VEC_SAMPLE_DIR" --store "$VEC_SAMPLE_STORE" --series
npm run build
node scripts/elections/serve-local.mjs --store "$VEC_SAMPLE_STORE"
```

本机页面为 [Assembly 本机预览](http://127.0.0.1:4180/en/elections.html?event=vic-2026&office=assembly)。

3. 用批准的 VEC SharePoint 会话下载 11 月 10 日的两个 **Verbose V2** 零值 ZIP，或从 VEC 安全提供的 SAS 读取。把正式零值文件单独放在一个目录。SharePoint 中另外有 Candidates、Lite、LitePP 和 Test 文件。正式结果采集按文件名筛选两份 Verbose V2，候选人、票数和宣布状态都从该格式读取。
4. 读取零值文件头并验证结构。确认两份文件的 `eventId`、`eventName` 一致、`verbose` 为 true、`validationErrors` 为 0，分别覆盖 88 个下议院选区与 8 个上议院大区。把身份值配置到正式采集环境。VEC 公布的 4、5、8、9 号党籍 ID 分别用于绿党、工党、自由党及国家党，后两者在页面合计为联盟党。

```bash
node scripts/elections/collect.mjs --source vec-2026 --dir "$VEC_ZERO_DIR" --inspect
node scripts/elections/collect.mjs --source vec-2026 --azure --inspect
```

5. 11 月 25 日在单独的私有目录运行演练。先用 `--source vec-trial --azure --inspect` 确认演练文件身份。若 Azure 中的演练 ZIP 使用 `TestState2026` 前缀，设置 `VEC_BLOB_PREFIX=TestState2026mediafileverbose`。演练可通过 `--dir` 使用 SharePoint 下载。演练的身份值和目录与正式采集分开配置。

```bash
node scripts/elections/collect.mjs --source vec-trial --azure --store "$VEC_TRIAL_STORE"
```

用本机预览核对选区与候选人、第一优先票、选区进度及时间。演练没有 2CP 数据，不能把缺失当成零。VEC 的演练结果不应对外展示。

## 运行环境

采集器用持久磁盘保存状态。可以由现有调度器每五分钟执行一次，或使用 `--watch` 在能持续联网的受监督进程中运行。部署前确保采集、重启恢复和手动接管使用同一个正式工作目录。Vercel 部署包含只读函数，采集器在独立的运行环境中运行。

| 变量 | 位置 | 用途 |
| --- | --- | --- |
| `VEC_AZURE_SAS_URL` | 私有采集器 | VEC 提供的 `results` 容器 SAS URL，使用 read/list 权限 |
| `VEC_EVENT_NAME`、`VEC_EVENT_ID` | 私有采集器 | 从同一场选举的 VEC 零值 ZIP 核验的 EMS 身份 |
| `VEC_BLOB_PREFIX` | 私有采集器，可选 | Azure 区分大小写的前缀，默认为 `State2026mediafileverbose`。若 ZIP 在子目录，前缀包含该路径 |
| `ELECTION_SNAPSHOT_WRITER_URL` | 私有采集器 | 站方另建私有 Azure 容器 `afflatus-elections` 的 SAS，使用 read/create/write 权限 |
| `ELECTION_SNAPSHOT_READER_URL` | Vercel 服务器环境 | 同一个站方容器的只读 SAS |
| `VEC_PUBLIC_RESULTS=1` | 私有采集器与 Vercel 生产环境 | 确认公开展示授权后启用发布和读取 |

SAS 通过私有密钥管理器注入运行环境。部署的前端只读取本站 JSON API，访问者拿不到 SAS。生产只读 SAS 与采集器写入 SAS 独立。站方 Azure 容器应关闭匿名访问，且只存放经过发布校验的标准化 JSON。

VEC 已批准读取 SharePoint 与允许公开展示是两件事。启用公开发布前，核对批准的用途是否明确覆盖在 feida.au 显示标准化计票结果。VEC 的现行条款第 1.2 条涉及原始及修改后数据的披露。若批准文件对此没有明确说明，先取得 VEC 确认。 [VEC 数据源条款](https://www.vec.vic.gov.au/-/media/b7e4b56d7c3c4829b8c121e41ae0ae9f.pdf)

## 11 月 28 日开票

1. 核对 VEC SAS 的有效期和正式目录，先以私有模式确认采集正常。投票结束前返回 `waiting_for_polls_to_close`。开票之后核对第一份结果的来源时间、样本隔离、已报票选区以及 2CP 与 VEC 官方页面一致。
2. 具备公开展示授权并配置站方存储后，在同一个正式目录运行带 `--publish` 的采集器。使用调度器时移除 `--watch`。写入经过校验的快照，再用 ETag 条件更新指针，失败的发布可安全重试。

```bash
node scripts/elections/collect.mjs --source vec-2026 --azure \
  --store "$VEC_LIVE_STORE" --watch --publish
```

3. 验证 [下议院页面](https://feida.au/en/elections.html?event=vic-2026&office=assembly) 显示 VEC 文件时间、已报票选区和宣布结果。随第一份结果核对 `/elections-feed/vic-2026/latest.json` 与它指向的快照都返回 200。前台页面约每分钟检查一次，后台约每五分钟检查一次。
4. 若 Azure 来源故障，可从已登录的 SharePoint 下载两份最新的正式 Verbose V2 ZIP。把完整的 ZIP 移入导入目录，停掉自动采集，然后用同一正式存储接管。

```bash
node scripts/elections/collect.mjs --source vec-2026 --dir "$VEC_MANUAL_DIR" \
  --store "$VEC_LIVE_STORE" --force --publish
```

如果只做私有验证，省略 `--publish`。公开存储不可用时，仍可继续私有采集并保留历史。恢复后下次发布会补传指针历史中待发布的快照。

## 状态与回滚

| 采集状态 | 含义与处理 |
| --- | --- |
| `published` / `unchanged` | 已生成新快照，或只更新检查时间。另看 `publication` 确认公开指针写入 |
| `partial` | 一个议院或个别选区有错误。有效结果继续更新，受影响的结果保留上一份并标明过时 |
| `failed` / `backoff` | 没有新的有效数据或在退避。查看私有 `quarantine/`，复核身份和 VEC 变更通知 |
| `locked` | 同一目录的另一轮采集正在运行 |
| `waiting_for_polls_to_close` | 正式采集尚未开始 |

每个采集目录有一份指针、不可变快照和私有状态。使用工作树之外的路径。原始 ZIP 留在操作者的下载目录或 VEC 容器，采集器记录摘要和标准化结果。

```text
<store>/vic-2026/latest.json
<store>/vic-2026/snapshots/<id>.json
<store>/vic-2026/private/
```

停止发布时先停掉发布进程，再撤下 Vercel 环境中的 `VEC_PUBLIC_RESULTS` 并重新部署。只读 API 的 CDN TTL 最长两分钟，之后新访问回到预览和 VEC 官方链接。已打开页面保留上次有效数据并显示更新异常。确认计票结束后停止轮询，按批准的用途处理持久存储。
