# 交给 Codex 的执行说明

## 可以直接粘贴的任务

> 请接手这个 Arena FSI 升级包，将它完整集成到 `https://github.com/FeidaWang/Afflatus` 对应 `https://feida.au/arena.html` 的现有项目，完成验证、提交和部署。只依据本包和当前仓库，不用旧对话或记忆。先阅读 README、config/upstream-lock.json、docs/deployment.md 和 validation/verification-report.md。请完成所有已能完成的代码、配置与验证；只有真实凭据、供应商授权或平台访问确实缺失时再明确指出缺少哪一项，不要用演示数据代替已连接真实系统。
>
> 以现有仓库最新状态为准，在独立工作分支中工作，保留用户已有修改。优先运行本包 `scripts/install-host.mjs --target <仓库绝对路径>` 预检，再带 `--apply` 安装；随后运行 `scripts/patch-host-metadata.mjs --target <仓库绝对路径> --apply`。若入口已变化，请理解当前代码后合并同一功能，不要硬覆盖旧版本。`patches/afflatus-arena-fsi.patch` 只是锁定基线的另一种接入方式，不要与安装器重复使用。
>
> 在宿主更新 lockfile，运行新模块检查与测试、原站 build，以及仍受影响的 Arena/Vibe 测试。配置真实数据库、行情与明确的模型 ID；执行新增表迁移和 doctor。不要把 `.env`、密钥、本地 SQLite、导出私人账本或 node_modules 提交到仓库。模型 key 只在服务端，管理员 token 不进入网页构建变量。
>
> 保留原站共享导航、中文/英文路由和既有 Vibe researchPanel。保留历史 QF-01 资料为明确档案，不能混入新赛季收益。缺行情、缺日历、缺模型时页面应显示真实错误，不能暗中退回 demo。新回合先冻结事实，再分析、critic、确定性风控和纸单；保持服务端幂等、CAS、时间边界和公司行动原子处理。
>
> 凭据和平台权限齐备时，将已验证改动提交到工作分支并推送到对应远端；按仓库现有 PR/保护分支流程集成。发布前关联现有 feida.au 的 Vercel 项目，检查目标 org/project，不另建无关站点。优先运行本包 `scripts/release-host.mjs --target <仓库绝对路径> --deploy`，先生成不切域名的 production deployment，经过 health/真实公共 status/页面资源/未鉴权写入拒绝检查后才 promote。若部署保护阻止只读验收，按平台支持的 bypass 方式完成验收再 promote，不绕过平台访问控制。
>
> 最后报告具体提交 SHA、部署 URL、生产 URL、验证结果和仍未满足的真实服务条件。当前包没有真实密钥和远程部署结果，不能将本地测试通过说成生产联调通过。浏览器可用时补做桌面/移动端、语言切换、demo→live、临时令牌、挂单和错误状态验收；上线演示测试使用隔离 demo 账本，任何真实模式账户变更都要有明确操作目的。

## 包内脚本入口

```bash
# 在解压目录验证包本身
npm ci
npm run verify

# 检查并集成到现有仓库
node scripts/install-host.mjs --target /absolute/path/Afflatus
node scripts/install-host.mjs --target /absolute/path/Afflatus --apply
node scripts/patch-host-metadata.mjs --target /absolute/path/Afflatus --apply

# 切换到 Afflatus 根目录以后
npm install
npm run arena:fsi:check
npm run arena:fsi:test
npm run build

# 已在该环境配置真实服务端变量以后
npm run arena:fsi:migrate
npm run arena:fsi:doctor

# 仅验证；不会发布
node integrations/arena-fsi/scripts/release-host.mjs --target .

# 在已提交、已关联正确 Vercel 项目且有发布权限时执行
node integrations/arena-fsi/scripts/release-host.mjs --target . --deploy
```

`git diff` 和具体文件范围由 Codex 审核。不要使用包含无关文件的盲目 `git add -A`。仓库原有课程生成器会产生未跟踪的 `public/en/course/` 与 `public/zh/course/` 页面；它们属于构建产物，不属于本次 Arena 源码变更。严格部署脚本如报告未提交文件，应核对并处理这些可重建输出，不能因此顺带提交其他工作。

## 接手时应确认的事实

| 事项 | 本包已经完成 | Codex 部署环境要完成 |
| --- | --- | --- |
| 现网/上游结构 | 固定 SHA 审计、读 API 返回值、真实宿主安装与构建 | 核对最新主分支变化 |
| 账户与并发 | 实际 SQLite、多连接并发、幂等、财务和 hash 验证 | 真实 Neon 加表与连接测试 |
| 模型与行情 | 实际 HTTP 契约、时间/质量/拒绝行为与模拟供应商回归 | 授权凭据、模型 ID、行情 entitlement 的认证联调 |
| 页面 | React 编译、SSR、关键交互契约与产物检查 | 在支持的浏览器中验收真实布局和网络行为 |
| 上线 | 可运行 stage/probe/promote 发布脚本 | 正确平台关联、提交/推送/发布权限和最终验收 |

