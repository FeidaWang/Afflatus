# REL-000 · 初步威胁模型（Relationships）

只基于读源码。没有做网络抓包、攻击测试或线上响应头核对。

## 资产

| 资产 | 存放位置 | 敏感度 |
|---|---|---|
| 「我」的生日、时辰、时区、经纬度、性别 | `localStorage['afflatus-horo:me']`，提交即写入 | 高 |
| 对方的称呼和生日（已换算成北京时间，含时辰） | `localStorage['afflatus-horo:book']`，最多 20 条 | 高（第三方的资料） |
| 派生盘面：四柱、相位、分数 | 只在内存里；合盘卡 PNG 下载到本机 | 高 |
| 手记、每日签、测验结果 | `afflatus-horo:journal:v1` / `persona` / `logic` / `eq` / `streak` | 中 |

## 通道

| 通道 | 现状 | 风险 | 后续 |
|---|---|---|---|
| 网络 | 只有 `/transits-daily.json`（不带参数）；本页 `track()` 是空函数；webVitals 排除了 horoscope 路由 | 低。全站共用的脚本（header、i18n、audio、transition）没逐个抓包 | REL-080：用合成哨兵生日抓 HAR |
| URL | head 脚本清除 query 和 hash；复制链接只复制 pathname | 低 | 保持 |
| 同源脚本读取存储 | 生日以明文 JSON 存在 localStorage，同源任何脚本都能读 | 中（OWASP 指出的通病） | 默认临时保存可以缩小暴露面（Q10） |
| XSS | 用户输入只有 `sName`，经 `attr()` 转义后进 innerHTML；其余插入的都是内部文案 | 低 | 新内核只输出结构化数据，渲染一律用 textContent 或转义 |
| CSP | 正式头只有 base/form/frame/object；完整策略还是 Report-Only，script-src 含 `'unsafe-inline'` 和 googletagmanager | 中 | 需单独评估；head 里的内联脚本限制了收紧的空间 |
| 下载卡 / `.ics` | 卡片含双方四柱和分数（页面已告知）；`.ics` 不含生日 | 低 | 下载前预览（REL-080） |
| 删除 | 前缀清理加整页刷新 | 低 | 刷新本身就消除了旧回调写回的竞态；如果改成不刷新，需要 generation 计数 |
| Worker | 同源 module worker，不联网 | 低 | Worker 不是安全边界，不在文案里这样宣称 |
| 残留代码 | `horoscopeShareCodec` 可把生日编成 base64，页面没有调用 | 低 | 记录在案；如果以后有人启用，就会违反「URL 不含生日」 |
