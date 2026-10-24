# 趣味占星页 CSP 评估（REL-080，只写说明，未改 `vercel.json`）

2026-10-24。依据：`vercel.json` 第 770–771 行的现行响应头、`horoscope.html` 源码，以及本分支 `npx vite build` 产出的 `dist/horoscope.html`。**没有**核对线上真实响应头，也没有在生产环境试运行任何策略。

## 现状

| 头 | 内容 | 对本页的作用 |
|---|---|---|
| `Content-Security-Policy`（强制） | `base-uri 'self'; form-action 'self'; frame-ancestors 'self'; object-src 'none'` | 只防 base 劫持、表单外发、被嵌套和插件；不限制脚本和网络 |
| `Content-Security-Policy-Report-Only` | `default-src 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com; …; connect-src 'self' https://www.google-analytics.com …; worker-src 'self' blob:` | 只报告不拦截；且全站共用，含 GA 域名 |

## 本页实际需要的来源

| 类别 | 本页用到的 | 说明 |
|---|---|---|
| 脚本 | 同源 module 脚本；`<head>` 与 `<body>` 里 **4 段内联脚本**（hash 白名单与 `?fx` 开关、语言、字体加载、日夜主题） | 内联脚本是收紧 `script-src` 的主要障碍 |
| Worker | 同源 module Worker `/assets/horoscopeSynthesis.worker-*.js` | 不需要 `blob:` |
| 网络 | 同源 `/transits-daily.json` | 本页 `track()` 是空函数，不加载 GA；合盘计算不联网 |
| 样式 | 同源 CSS、Google Fonts CSS、9 处 `style=""` 属性，以及脚本写入的行内宽度 | 需要 `'unsafe-inline'`（或 `style-src-attr`） |
| 字体 | `fonts.gstatic.com` | |
| 图片 | 同源、`data:`、`blob:`（分享卡 PNG 与 `.ics` 下载用 blob URL） | |

## 建议的本页策略（先 Report-Only，限定 `/horoscope.html` 与 `/(en|zh)/horoscope.html`）

```text
default-src 'self';
script-src 'self' 'sha256-<内联脚本 1>' … 'sha256-<内联脚本 4>';
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com;
img-src 'self' data: blob:;
connect-src 'self';
worker-src 'self';
frame-src 'none'; object-src 'none';
base-uri 'self'; form-action 'self'; frame-ancestors 'self'
```

- `connect-src 'self'` 是对出生资料最直接的纵深防护：即使将来有人误加第三方请求，浏览器也会拦截（同源接口仍可达，所以它不能代替「不外发」的代码约束和哨兵测试）。
- 内联脚本的 hash 必须在构建时算，不要手抄进配置：M0 刚改过 hash 白名单脚本，下次改动 hash 就会失效。过渡期可以先保留 `'unsafe-inline'`，同时去掉 GA 域名。
- Worker 的策略来自 Worker 脚本自己的响应头。`vercel.json` 的 `/(.*)` 规则也覆盖 `/assets/*`，所以 Worker 会拿到同一套头；上线前要确认 Worker 响应确实带了 `connect-src 'self'`。

## 上线步骤（需要站主授权，本分支未做）

1. 只给本页加 `Content-Security-Policy-Report-Only`，在 Chromium、WebKit、Firefox 各走一遍立盘、合盘、分享卡、`.ics` 下载、删除，看控制台的违规报告。
2. 违规清零后改为强制头；保留旧的全站 Report-Only 头不动。
3. 在 e2e 里加一条：强制头下页面无 CSP 违规（`securitypolicyviolation` 事件计数为 0）。

## 边界

- CSP 不能阻止同源脚本读取 `localStorage`；生日以明文 JSON 保存在本机（只在用户勾选「保存到本机」后），这一点在页面文案里没有承诺「绝对安全」。
- XSS 仍是主要风险：本页用户输入只有称呼，进 innerHTML 前经 `attr()` 转义；新内核只输出结构化数据，文案来自内部表。
- Worker 不是安全边界，文案里不这样宣称。
