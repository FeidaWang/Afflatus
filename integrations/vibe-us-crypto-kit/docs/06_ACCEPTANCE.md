# 验收清单与测试分层

## 本包离线测试

```bash
python -m pip install -r requirements-test.txt
python -m pytest -q tests
node --test tests/proxy.test.mjs
```

测试使用明确的合成固定 fixtures，不是市场观测；fixture不在生产数据路径中。验证市场/日期/schema、OHLC 数值、来源匹配、鉴权、默认关闭、写操作拒绝、提取器解析、非破坏性复制与前后端 instrument 注册一致。

## 必须由 Codex 本地补齐的集成测试

1. 锁定 commit + blob 能成功下载与验证；依赖在洁净虚拟环境安装，生成完整依赖锁/许可证清单。
2. 用真实 US 与 Crypto spot 请求检查 upstream loader 的 `name`、records 日期字段与 provenance；不匹配修适配器并加回归，而不是移除检查。
3. 运行 upstream 对选定 loader/引擎/因子的 tests；运行时工具清单与静态 inventory 无未处理差项；手工审查 skill 支持。
4. 宿主所有原有门禁：typecheck、unit、build、site/header/css/i18n/data/OG；浏览器桌面/移动端和键盘流；现有 ticker/导航不受影响。
5. 无密钥、错误密钥、源失败、429、超时、重复参数、非 JSON、大体积响应、坏 OHLC、不支持市场均有真实错误态。
6. P3之后再验证回测/账本/年化/时区/费用/期权/资金费及多租户/任务边界。

## 阶段验收不是全部完成

“桥接单测通过”不等于“Vibe-Trading全部功能可用”；“有工具定义”不等于“有授权实时数据”；“React/Vite语法检查通过”不等于“线上已验证60fps”；“有paper接口”不等于“允许实盘”。

最终必须出具 `IMPLEMENTATION_STATUS.md`：每个功能ID、源码来源、修改文件、测试、数据权限、是否上线、阻塞。对于尚未实现功能不显示像真功能一样的可点击空壳按钮。

## 可选组件浏览器检查

```bash
python -m pip install -r requirements-browser-test.txt
python tests/browser_smoke.py
```

需要本地 Chromium（或设置 CHROMIUM_EXECUTABLE）。这是无网络的内存DOM harness，不是宿主Vite构建；测试移除import/export并注入相同CSS，不修改生产源文件。具体结果及限制见 `validation/TEST_REPORT.md`。
