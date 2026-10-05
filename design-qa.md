# AI Observatory · Design QA

**Final result: passed**

没有剩余的可操作 P0/P1/P2 视觉问题。此结论针对本次 sectors 页面改版的设计和交互验收；全仓库测试仍有 93 项既有失败，见下方验证记录。

## 对照对象与证据

- 参考页面：[Anthropic · What 81,000 people want from AI](https://www.anthropic.com/features/81k-interviews)。实际打开页面、检查控件并捕获桌面和手机状态。
- 实现：[中文](http://127.0.0.1:4174/zh/sectors.html)、[English](http://127.0.0.1:4174/en/sectors.html)，由最终 `npm run build` 的 `dist` 提供。
- 参考内容是访谈调查；实现内容是 AI 行业观察。用户明确要求抛弃调查原文，因此比较的是视觉语言和交互模式，文字、品牌、条目数量、数据含义属于有意改动。
- 截图为页面内容，不包含浏览器外框。CSS 视口与输出像素一致，均按 1× 比较，未将高密度截图与低密度截图直接比较。拼图上额外增加了 30–32 px 的说明带。

| 状态 | CSS 视口；单张像素 | 参考原图 | 实现原图 | 同一图像输入中的并排比较 |
| --- | --- | --- | --- | --- |
| 桌面首屏，默认第一场景，英文 | 1280 × 720 | `docs/sectors-observatory-evidence/reference-hero-1440.jpg`，实际尺寸为 1280 × 720，旧文件名保留 | `docs/sectors-observatory-evidence/implementation-hero-1280-en-v5.jpg` | `docs/sectors-observatory-evidence/comparison-desktop-hero-final.jpg`，2560 × 752 |
| 手机首屏，默认场景，英文 | 390 × 844 | `docs/sectors-observatory-evidence/reference-hero-390-v2.jpg` | `docs/sectors-observatory-evidence/implementation-hero-390-en-v5.jpg` | `docs/sectors-observatory-evidence/comparison-mobile-hero-final.jpg`，780 × 876 |
| 桌面目录弹窗，默认分组，空搜索 | 1440 × 900 | `docs/sectors-observatory-evidence/reference-wall-1440.jpg` | `docs/sectors-observatory-evidence/implementation-directory-1440-zh.jpg` | `docs/sectors-observatory-evidence/comparison-directory-final.jpg`，2880 × 932 |
| 桌面交互条形图，默认能力排序 | 1440 × 900 | `docs/sectors-observatory-evidence/reference-bars-1440.jpg` | `docs/sectors-observatory-evidence/implementation-models-1440-zh.jpg` | `docs/sectors-observatory-evidence/comparison-bars-final.jpg`，2880 × 932 |

以上四张拼图均作为单一图像输入进行实际检查。首屏采用全视图检查构图；目录与图表另外检查实际截图裁切组成的 `comparison-directory-focused-final.jpg` 和 `comparison-bars-focused-final.jpg`，以读清搜索、筛选、条形图、名称、数值和卡片排版。裁切没有重画或替换 UI。

中文最终首屏另见 `implementation-hero-1280-zh-v6.jpg`、`implementation-hero-390-zh-v6.jpg`。其他关键状态见 `implementation-models-390-zh-v2.jpg`、`implementation-directory-320-en.jpg`、`implementation-directory-390-zh.jpg`、`implementation-rivalry-390-zh-v2.jpg`、`implementation-agi-detail-1280-zh.jpg`。

## Findings · 已修复问题与比较历史

1. **[P2] 首屏引言偏离中心。**
   - 位置：`.ob-hero-lede`。
   - 初始证据：`comparison-desktop-hero-v1.jpg`、`comparison-mobile-hero-v1.jpg`。参考页引言与中心文字区对齐，实现的段落被更高优先级的全局 `p` 规则覆盖自动边距，偏到文字容器左侧。
   - 影响：首屏构图和阅读顺序失衡。
   - 修复：使用 `.observatory .ob-hero-lede` 设置 `margin: 0 auto`，手机规则保持同等优先级。
   - 复查：桌面和手机 final 首屏拼图，引言区已居中，段内保持左对齐。

2. **[P2] 目录滚动使标题和关闭操作离开可视范围。**
   - 位置：`#ob-directory`、`.ob-dialog-content`。
   - 初始证据：`implementation-directory-1280-zh.jpg`。
   - 影响：用户浏览大量公司后难以定位搜索和关闭。
   - 修复：弹窗改为纵向 flex，标题和搜索区不收缩，结果区独立滚动，分类栏 sticky；保留原生 dialog 的 Escape、焦点约束和恢复行为。
   - 复查：`implementation-directory-1280-zh-v2.jpg`、`comparison-directory-final.jpg`、320/390 手机目录截图。标题、搜索和关闭按钮保持可达，内部无横向溢出。

3. **[P2] 手机地球尺寸过小。**
   - 位置：`createGlobe` 的手机首屏半径。
   - 初始证据：`comparison-mobile-hero-v1.jpg`。参考地球直径约 310 px，实现约 250 px。
   - 影响：改变首屏主要区域的占比，削弱参考设计的地理叙事。
   - 修复：手机半径系数设为视口宽度的 0.4；桌面保持原比例。使用真实 Natural Earth 地理数据绘制陆地、海岸和机构总部标记。
   - 复查：`comparison-mobile-hero-final.jpg`，390 px 视口内地球约 312 px，标题和交互保持可读。

4. **[P2] 新增中文字符没有全部进入本地字体子集。**
   - 位置：`public/assets/fonts/noto-serif-sc-subset.woff2` 与字体生成输入。
   - 证据：初次字形覆盖检查有 140 个新字符缺失，可能回退成另一种字体。
   - 影响：中文显示字体和字重不一致。
   - 修复：从 Google Fonts 官方 Noto Serif SC 源文件生成静态 600 字重子集；保留原有字符，并纳入新数据、HTML、控制器和保留清单。提交 OFL 许可证和来源说明。
   - 复查：最终保留 984 个码位；对当前中文文案的字体检查缺失为 0。中文桌面和手机 v6 首屏未见替代方框或突兀字形。

5. **[P2] 手机章节导航标签收缩并相互覆盖。**
   - 位置：`.ob-chapter-nav a`。
   - 初始证据：`implementation-model-detail-390-zh.jpg`、`implementation-rivalry-390-zh.jpg`。
   - 影响：持久导航难以辨认和点击。
   - 修复：链接 `flex-shrink: 0`，手机点击高度 44 px，容器横向滚动。
   - 复查：`implementation-models-390-zh-v2.jpg`、`implementation-rivalry-390-zh-v2.jpg`；标签保持完整宽度，整页无横向溢出。

6. **[P2] 标题换行与参考首屏的主要区域比例不一致。**
   - 位置：双语 hero 标题及 `.ob-hero-copy`。
   - 证据：前期英文短标题容易落成单行，中文断行不稳定。
   - 修复：中英文各定义有意义的两行标题，`white-space: pre-line`，调整桌面和手机标题区顶部位置。
   - 复查：两张 final 首屏拼图及中文 v6；标题、引言、地球和底部场景构成稳定层级。

另外在最终中文首屏发现一个 P3 断行细节：引言末行只剩单字“业”。对 `.ob-hero-lede` 先增加 pretty 断行（v4），复查后使用 balance 平衡两行长度（v5），最终为中文补充居中和语义断行（v6），英文保留 v5。没有修改事实或数据。重新构建并捕获最终截图；字体加载完成，中文两行围绕标题中心对齐，没有孤字行。中文 v6 与英文参考的并排图为 `comparison-desktop-hero-zh-final.jpg` 和 `comparison-mobile-hero-zh-final.jpg`；原参考没有中文版本，比较的是本地化后的构图、状态与视觉语言，不能声称中文字体/字数完全相同。手机源图是在原站逐字动画中捕获，原访谈正文未用作本页内容对齐目标。

各 P2 问题修复前的比较结果为 blocked；上述修复后的证据复查通过。构建成功没有被当作视觉修复的替代证据。

## 五个必要的视觉检查面

| 检查面 | 最终判断与有意差异 |
| --- | --- |
| 字体与排版 | 英文 Newsreader 显示字体与 Hanken Grotesk UI，中文本地 Noto Serif SC 子集与系统 UI 字体。保持参考的衬线标题、长文窄栏、紧凑无衬线控件、两行首屏层级。采用现有可用字体而非复制参考站专属字体；中文静态字重与已有字体声明一致。模型名称更小，以容纳 18 个可比较项目。 |
| 间距与布局 | 首屏地理舞台、640 px 长文栏、1056 px 交互宽栏、浅边框卡片、居中章节开篇、桌面双栏详情和手机纵向结构成立。目录采用均匀公司卡片，替代原访谈的大小引言卡片，这是内容类型造成的有意差异。 |
| 颜色与状态 | 使用纸色 `#faf9f5`、舞台色 `#e8e6dc`、墨色 `#141413`、次要文字 `#615f57`、浅绿条形图和深绿选中态；当前按钮有明确底色，focus-visible 为蓝色轮廓。国别图使用蓝/褐区分，全部数值同时用文字表达。 |
| 图像与资产 | 地球是实际地理数据驱动的图表，不是手画装饰球体；机构点与近似总部相对应。沿用本地已核查的机构标识，文字名称在没有图片时仍可识别。自己的站点品牌替代参考站品牌；未复制原访谈照片、头像或调查数据。截图无明显压缩、透明边缘或占位图问题。 |
| 内容与文案 | 双语重新研究和编写，章节说明、空状态、控件名、ARIA 文案、方法和来源齐全。排名显示配置和口径，缺失数据保留 `—`；财务时期及报道状态可辨。AGI 的能力关卡不标虚构完成率。页面没有“克隆参考页”等实现说明泄漏。 |

## 主要交互与响应式验证

浏览器实际验证：

- 3 个首屏场景按钮更新文案和地球视角；滚动切换场景；开始阅读与章节锚点。
- 产业筛选、国家选择、结果数量、地图放大/重置和鼠标拖动旋转。
- 公司目录搜索（命中/无结果）、行业/地区分组、分类过滤、独立结果滚动；关闭按钮、Escape、Tab 焦点约束和返回触发器。
- 模型四种排序口径、US/CN 来源筛选、仅开放权重；正确空状态；悬停/焦点/点击更新详情；散点图键盘 Enter 更新同一选中模型。手机点选后的详情滚动可见。
- 中美对照指标的选择和前后切换；两个地区下拉和四个箭头；连线图的焦点联动。
- 时间轴年份筛选、展开收起、前后事件切换。
- AGI 四个关卡和来源、方法说明；当前基准成绩单独标注测试名、日期和厂商报告性质。
- 来源类型筛选、复制引用、实际下载 JSON。最终下载重新执行并比对最终 `dist` 快照。
- 中英文固定路由互换；手机站点导航展开/关闭。

视口检查：320 × 740（英文）、390 × 844（中英文）、768 × 1024（中文）、1280 × 720（中英文）、1440 × 900（中文）。以上检查整页无横向溢出；320 px 目录关闭/搜索仍可操作，390 px 章节导航保持完整标签。

可访问性：原生按钮/select/details/dialog，双语标签、pressed/current/status 状态、可见键盘焦点、图表旁文本数值和目录文本替代。降低动态偏好对应的 CSS/JS 分支经过代码检查；没有模拟操作系统偏好，因此不声称完成该偏好的浏览器实测。没有声称完成自动化 WCAG 审计或屏幕阅读器审计。

控制台检查：常规页面和核心操作没有新应用异常。响应式验证期间有一次浏览器原生跨文档 View Transition 被视口调整中断的 `InvalidStateError`；源头为现有 `page-turn.css` 的原生页面导航转场，正常导航可完成，不影响页面操作。该测试环境事件保留记录，未把它伪报成应用日志全空。

## 构建与回归

- `npx vitest run tests/sectors*.test.js tests/routeSeo.test.js tests/siteManifest.test.js tests/bilingualContent.test.js`：28 文件，342 项通过。
- `npm run build`：通过；包括快照生成一致性、数据、站点/i18n 和最终 SEO 检查。
- `git diff --check`：通过。
- 完整测试对比：干净 HEAD 基线为 1889 通过 / 94 失败；实现为 1903 通过 / 93 失败；失败集合无新增，减少的是被改版替代的 sectors 旧界面断言。失败文件列表和机器可读计数见 `docs/sectors-observatory-evidence/verification.json`。
- 原有 dossier/archive 的测试保留，通过种子标记 fixture 测试历史生成器；新 live 页面采用独立数据和生成契约。SEO 检查仍要求单个 HTML 标题，仅排除 SVG 点位自带的可访问性 `<title>`。
- 最后的标题换行和 AGI 说明文案修改之后重新运行相关测试和生产构建；随后调整首屏平衡断行和中文引言的语义换行，再次运行相关 342 项测试、生产构建和浏览器视觉复查，均通过。完整基线比较发生在这些最终文案/断行调整之前。

## Open Questions

无影响交付的未决设计问题。部署没有执行；本地预览与线上旧页面是两个状态。

## Implementation Checklist

- [x] 真实参考页面与实现截图同图输入比较，包含桌面/手机及局部控件。
- [x] 修复并复查全部发现的 P2 问题。
- [x] 覆盖五个必要视觉面与双语排版。
- [x] 验证主要交互、空状态、手机布局和下载。
- [x] 相关测试、生产构建与现有失败基线对比。
- [x] 保存研究/控件清单、快照、截图和验收记录。

## Follow-up Polish

无需要阻止交付的 P3 项。残余验证范围为降低动态偏好的真实设备实测、屏幕阅读器实测和完整站点的既有测试失败；这些未被宣称已完成。

final result: passed
