# Afflatus 发布指南（GitHub + Vercel）

托管架构：**GitHub 仓库（FeidaWang/Afflatus）是唯一源头，Vercel 监听仓库自动构建部署**。你永远不需要手动上传 dist——只要 push，Vercel 一两分钟内自动上线。

## 一、日常更新流程（每次都一样的四步）

```bash
cd /Users/feida/Documents/Codex/2026-05-26/html-javascript-logo-ytd-fill-in

# 1. 本地预览确认效果
npm run dev          # 打开 http://127.0.0.1:5173/ 检查

# 2. 提交
git add -A
git commit -m "描述这次改了什么"

# 3. 推送（这一步触发 Vercel 自动部署）
git push origin main

# 4. 验证：打开 vercel.com → 你的项目 → Deployments
#    最新一条变成 Ready（约 1 分钟）后，刷新线上网址即可
```

线上验证时务必**强制刷新**（Cmd+Shift+R），否则可能看到浏览器缓存的旧版。

## 二、Vercel 首次/核对配置

vercel.com → 项目 → Settings → Build & Development Settings，确认：

| 项 | 值 |
|---|---|
| Framework Preset | Vite |
| Install Command | `npm install` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| 环境变量 | 不需要设置任何变量（**不要**设 VITE_BASE，Vercel 是根域名托管） |

如果项目还没接入：vercel.com → Add New → Project → Import `FeidaWang/Afflatus` → 上表配置 → Deploy。

## 三、push 被拒绝怎么办（最常见故障）

如果 `git push` 报 `rejected / non-fast-forward`，说明 GitHub 上有你本地没有的提交（比如在网页上直接编辑过文件）：

```bash
git pull --rebase origin main   # 先把远端拉下来叠在本地提交之下
# 若有冲突：git status 查看冲突文件，手动改好后
#   git add <文件> && git rebase --continue
git push origin main
```

**绝对不要**再用 GitHub 网页的 "Add files via upload" 上传文件——上次的版本混乱就是它和本地历史打架造成的。所有修改一律走本地 commit + push。

## 四、回滚

线上出问题想立即回到上一个好版本，两种方式任选：

1. **Vercel 一键回滚（最快）**：Deployments 列表 → 找到上一个 Ready 的部署 → 右侧 ⋯ → Promote to Production。
2. **git 回滚**：`git revert <坏提交哈希>` 然后 push（生成一个反向提交，历史干净）。

## 五、常见问题

页面空白：浏览器 Console 看红字；多半是 build 失败，Vercel Deployments 里点开看构建日志。
样式/图片 404：确认没有设置 VITE_BASE；本项目所有路径已做根域名/子路径双兼容。
本地 `npm run preview` 看旧内容：preview 只是预览 `dist/`，先 `npm run build` 再 preview。
全屏模糊：已在代码中修复（背景画布改为「硬性显存预算」，详见 TECHNICAL_GUIDE.md → Troubleshooting → Fullscreen blur）。三张全屏画布的 backing store 固定在每张 ≤3.6MP，全屏到 4K 合计稳定约 41MB，避免 Chrome 因显存触顶把整页（含文字）降分辨率重栅格化。若改后仍模糊：先 `chrome://gpu` 确认硬件加速开启；再用 DevTools → Rendering → Frame Rendering Stats 看 GPU memory 是否仍触顶；若没触顶但文字仍糊，多半是显示器分数缩放（非整数 devicePixelRatio）所致，与本项目无关。
