# REL-000 · 修改白名单与算法替换边界

范围只限 Relationships 的计算和行为层。视觉方面另有星历仪方案，新视觉放在 `?fx=almanac` 后面；不带开关时，现版模板保持不变。

## 1. 允许的 DOM 功能性改动（现版模板，沿用现有样式类）

| 位置 | 允许的改动 | 依据 |
|---|---|---|
| `#sHour` / `#bHour` | 增加「精确时间（HH:MM）」输入，或「时段 / 精确」切换；保留「不知道」 | COMPARISON A1 |
| `#sManualWrap` / `#bManualWrap` | 城市写入 IANA 名（隐藏字段）；手动偏移与库值冲突时给出提示 | A3 |
| `#sAssumptions` / `#sResultAssumptions` | 文案改成说明区间、未知值以及哪些字段不稳定 | A2 |
| `#sScore` / `#sRing` | 值为 null 时显示「待补充」或「未核验」，不显示数字 | F2 |
| `#synPillars` | 在 REL-070 出来之前隐藏，或换成新的维度输出 | B3、B4 |
| `#pullScore`、`#synCal`、`#icsBtn` | 改名为「互动计划」，不显示分数，取消倒计时解锁；`.ics` 改为通用活动 | G1、G2 |
| `#shareTip` | 默认文案改成与实际一致：只复制页面入口 | H4 |
| `#synXiu` | 加「规则未独立核验」标签 | E2 |
| `#synZiwei` | 命无正曜时如实显示 | C2 |
| `#synForm` / `#birthForm` | 增加「保存到本机」的选择 | H1（需站主确认 Q10） |
| `horoscope.html:5` head 脚本 | 保留白名单 hash（与星历仪 M0 F7 合并为一次修改） | I1 |

不允许：改配色、字体、布局、导航、品牌、页面名（Astrology for fun / 趣味占星）、路径；整页重写；引入框架。

## 2. 算法替换边界

```text
保留并复用：bazi.js（修 A7 后）· ziping.js 关系表 · synastryBazi.js 矩阵 · astro.js / astroPlanets.ts 星历
           · xiu.js（加 unverified 标签）· latestWorkerTask.js · horoscopeSynthesis.worker.js
新增（纯函数）：src/lib/relationships/ 下的 time 适配、规则表、量表、证据、版本号
替换的调用点：horoscope.js 中的 renderSyn() / renderSynModes() / renderSynCalendar() / bestDayThisWeek()
退役：synastry().pillars 伪随机子分 · dailyPull() 作为「预测」的用途 · relationshipScores() 的 50 兜底
```

- 新内核只经由 Worker 加主线程回退调用，前端不再自己算分。
- `synastry()` 的 `base` 在新量表上线前继续存在，但要先修 B2（对称性），否则星历仪 M10 会继承这个问题。
- 「自我」页受 A7（节气按时刻切分）影响，这项修复必须带上「自我」页的回归单测。

## 3. 与星历仪路线图的接口

- M10「合盘 fig.6」改为依赖新的 REL 内核输出契约，不再直接消费 `synastry()`。
- C2、C2b 两项文案修复照常进行，属于 B5、B6 的文案部分。
- M0 F7（hash 白名单）同时满足 I1。
