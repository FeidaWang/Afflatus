# Marathon 式视觉/动效语言的 Web 实现路线（技术库 + 参考代码）

> 调研日期：2026-11-02。来源标注说明：
> - 〔已抓取〕= 本次直接抓取并核对了页面/文件内容（本会话网络仅允许 github.com / raw.githubusercontent.com / registry.npmjs.org；其余域名如 tympanus.net、gsap.com、developer.mozilla.org、awwwards.com、codepen.io、threejs.org、motion.dev、web.dev、shadertoy.com 均被会话网络策略拒绝）。
> - 〔仅搜索摘要〕= 仅来自搜索引擎结果页摘要，URL 真实存在于结果中，但正文未能打开核对；引用时请二次确认。
> - 〔本地实测〕= 从 npm registry 下载 tarball 后用 `gzip -9` 实测的体积，非官方数字。
> - 搜索预算在第二轮后耗尽（本轮全部 agent 共享 200 次上限），因此第 (1)、(4) 节覆盖面受限，详见各节 Gaps。

---

## 关键问题 1：现存的、明确受 Marathon 启发的网页/CodePen/GitHub/Dribbble 作品有哪些？

### Takeaway
公开可查的"Marathon 风格网页实现"极少：只找到 1 个 Dribbble 网页概念、1 个 The Rookies 的 FUI 粉丝概念（Figma 制作）、1 个 Behance 插画；没有找到任何 CodePen 或 GitHub 仓库以 Marathon 为名实现 HUD/glitch 效果。媒体对该游戏 UI 的描述（高饱和撞色、glitch 细节、"暗色模式平面设计作品集"、"fontslop"字体堆叠）是目前最可靠的"风格定义"来源。

### Cited Findings
- Dribbble 用户 Bircch 发布了名为 "Marathon by Bungie - Game Pre-Order" 的游戏官网首页概念（tags: bungie, concept, gaming homepage, marathon game ui, video game website）——这是唯一找到的网页维度概念图。〔仅搜索摘要〕 — [Dribbble/Bircch](https://dribbble.com/Bircch)
- The Rookies 参赛作品 #49939 "Marathon Tablet FUI | Fan Art Concept | UI for Cinematics"：以 Figma 加 3D/合成工具制作的平板 FUI 概念，自述灵感来自游戏内 UI 与过场动画。〔仅搜索摘要〕 — [The Rookies](https://www.therookies.co/entries/49939)
- Creative Bloq 报道：玩家对 Marathon "vibrant colours and glitchy UI art style" 看法两极。〔仅搜索摘要〕 — [Creative Bloq](https://www.creativebloq.com/3d/video-game-design/fans-are-torn-over-the-vibrant-colours-and-glitchy-ui-art-style-of-bungies-new-marathon-game)
- PC Gamer：Marathon UI 设计师 Elliott Gray 自称 "fontslop merchant"，并承诺 Bungie "never remove the sauce from the UI"；"fontslop"是玩家对其多字体堆叠、信息密度极高界面的戏称。〔仅搜索摘要〕 — [PC Gamer](https://www.pcgamer.com/games/fps/marathon-ui-designer-declares-himself-the-fontslop-merchant-and-promises-bungie-will-never-remove-the-sauce-from-the-ui); 同主题 — [GamingBolt](https://gamingbolt.com/dont-think-for-a-second-were-gonna-remove-the-sauce-says-marathon-ui-designer-about-its-look)
- GamesRadar 把该 UI 描述为 "looks more like a graphic design portfolio in dark mode than a truly useful interface"。〔仅搜索摘要〕 — [GamesRadar](https://www.gamesradar.com/games/fps/the-first-ever-fontslop-game-marathon-players-are-already-sick-of-looking-at-the-upcoming-bungie-shooters-eye-sore-ui)
- Bungie 在 Server Slam 后承认 UI 在库存管理、导航、信息密度上需改进，并称之为设计缺陷而非 bug。〔仅搜索摘要〕 — [FinalBoss](https://finalboss.io/bungie-admits-marathons-ui-needs-work-promises-fixes); [Game Informer](https://gameinformer.com/2026/03/02/marathon-heres-what-we-learned-from-bungies-post-server-slam-feedback)
- PC Gamer 另文称 Bungie 的 Marathon ARG "gorgeous, extensive"（ARG 网站本身可作为官方网页视觉参考，但本次未能抓取）。〔仅搜索摘要〕 — [PC Gamer ARG](https://pcgamer.com/bungies-marathon-arg-is-gorgeous-extensive-and-how-the-hell-do-people-work-this-stuff-out-anyway)
- 粉丝站 marathon.bungie.org 维护着新闻/故事页，可作为"原版 90 年代 Marathon"美学的参考来源。〔仅搜索摘要〕 — [marathon.bungie.org](https://marathon.bungie.org/story/newjuly25.html)
- 搜索 "marathon hud react github" 只命中无关项目：`lexogrine/cs2-react-hud`（CS2 直播 HUD，React）可作为"游戏 HUD 的 React 组件组织方式"的旁证参考。〔仅搜索摘要〕 — [cs2-react-hud](https://www.github.com/lexogrine/cs2-react-hud)
- 21st.dev 社区有 "hud" 组件标签页（React/Tailwind 组件集合，非 Marathon 专属）。〔仅搜索摘要〕 — [21st.dev HUD components](https://21st.dev/community/components/s/hud.md)
- Y2K 风格实现资料：daisyUI 的 Y2K 趋势页给出配色（silver / ice blue / hot pink / lime）与展示字体 Audiowide 建议及可运行主题。〔仅搜索摘要〕 — [daisyUI Y2K](https://trends.daisyui.com/trend/y2k/)；The Plus Addons 的 Y2K 网页教程给出 chrome 文字（`background-clip: text` + 50% 处硬高光带）、`clip-path: polygon()` 星芒、`image-rendering: pixelated` 像素字体三种 CSS 技法。〔仅搜索摘要〕 — [theplusaddons Y2K](https://theplusaddons.com/blog/y2k-web-design/)

### Inferences
- 既然没有现成"Marathon 风格"开源实现，路线应是：以第 2 节的通用技法（glitch/scramble/scanline/warning stripe/ticker）组合复现，而不是寻找一个可直接 fork 的仓库。
- 媒体描述反推出的风格关键词可直接映射到技法：高饱和平涂撞色 → CSS 变量色板 + `mix-blend-mode`；glitch 细节 → clip-path 切片 + RGB 偏移；"fontslop" → 多字体/可变字体混排 + 文字 scramble；信息密度 → ticker/标签系统。

### Gaps
- 未能打开 Dribbble/Rookies/Behance 页面核对作品细节（域名被拒）。
- 没找到任何 CodePen 或 GitHub 仓库以 "Marathon" 命名实现 HUD/glitch 效果（两组关键词搜索均无命中）。
- 官方站 marathonthegame.com 通过代理抓取被 403 拒绝，无法确认其使用的前端库（GSAP/Three/OGL 等）。

---

## 关键问题 2：2025–2026 年这类美学最常用的库、体积与许可证（GSAP 是否已免费？Lenis、OGL、Three.js、Motion、Theatre.js）

### Takeaway
GSAP 自 2025-04-30 起连同全部原 Club 插件（SplitText、ScrambleText、MorphSVG、ScrollSmoother 等）100% 免费商用（Webflow 收购后的 "Standard no-charge" 许可，非 OSI 许可）；Lenis(MIT, ~5.4kB gz)、OGL(Unlicense, 官方 29kB minzipped 全量)、Three.js(MIT, 官方 CI 全量 WebGL ESM ≈86kB gz / 最小 tree-shaken ≈121kB gz)、Motion(MIT, 官方称 mini 2.5kB / hybrid ≈17–18kB)、Theatre.js(core Apache-2.0, studio AGPL-3.0, 开发暂移私有仓库) 为该赛道主流。

### Cited Findings
**GSAP**
- Webflow 官方公告：所有人（含非 Webflow 用户）可免费使用 GSAP 全部工具，包括此前付费的 Club 插件。〔仅搜索摘要〕 — [webflow.com/blog/gsap-becomes-free](https://webflow.com/blog/gsap-becomes-free)
- GSAP GitHub README："Thanks to Webflow, GSAP is now 100% FREE including ALL of the bonus plugins like SplitText, MorphSVG… even for commercial use"；许可为 "GreenSock's standard 'no charge' license"。〔已抓取〕 — [greensock/GSAP README](https://github.com/greensock/GSAP)
- npm `gsap@3.15.0` 的 `license` 字段为 "Standard 'no charge' license: https://gsap.com/standard-license"；tarball 内 `dist/` 已含 ScrambleTextPlugin、SplitText、MorphSVGPlugin、ScrollSmoother、DrawSVGPlugin、Physics2DPlugin、InertiaPlugin、CustomEase 等全部插件文件。〔已抓取 + 本地实测〕 — [registry.npmjs.org/gsap](https://registry.npmjs.org/gsap/latest)
- 〔本地实测, gzip -9〕gsap.min.js 72.9kB → 28.3kB gz；ScrollTrigger.min.js 18.0kB gz；SplitText.min.js 3.7kB gz；ScrambleTextPlugin.min.js 4.0kB gz；ScrollSmoother.min.js 5.5kB gz。
- 许可注意：Webflow 保留 GSAP 全部知识产权，并可在违约时终止许可（第三方许可库转录）。〔仅搜索摘要〕 — [ScanCode LicenseDB: gsap-standard-no-charge-2025](https://scancode-licensedb.aboutcode.org/gsap-standard-no-charge-2025.html)
- Motion 官方对比页称 GSAP core ≈23kB 且不可 tree-shake。〔仅搜索摘要〕 — [motion.dev/docs/gsap-vs-motion](https://motion.dev/docs/gsap-vs-motion)

**Lenis**
- MIT；当前 1.3.27；README 自述 "a few KB"、零依赖；包装原生滚动，`position: sticky`、锚点、无障碍行为保留；与 GSAP 集成代码：`lenis.on('scroll', ScrollTrigger.update); gsap.ticker.add(t => lenis.raf(t*1000)); gsap.ticker.lagSmoothing(0)`；限制：不支持 CSS scroll-snap（需 `lenis/snap`）、Safari 上限 60fps/低电量 30fps、iframe 内失效。〔已抓取〕 — [darkroomengineering/lenis](https://github.com/darkroomengineering/lenis)
- React 包 `lenis/react`：`<ReactLenis root options={...}>` + `useLenis(callback, deps, priority)`；`autoRaf:false` 时可由 GSAP ticker 或 Motion `frame.update` 驱动。〔已抓取〕 — [lenis/packages/react/README.md](https://github.com/darkroomengineering/lenis/blob/main/packages/react/README.md)
- 〔本地实测〕lenis.min.js 18.8kB → 5.4kB gz；lenis.mjs 8.2kB gz。

**OGL**
- Unlicense（公有领域）；README：core 8kB + math 6kB + extras 15kB = 29kB minzipped，tree-shake 后更小；示例目录含 `post-bloom.html`、`post-fluid-distortion.html`、`post-fxaa.html`、`msdf-text.html`、`load-gltf.html`、`gltf-ktx2-basis-draco.html`、`mouse-flowmap.html`、`gpgpu-particles.html`、`flat-shading-matcap.html`、`wireframe-shader.html`。〔已抓取〕 — [oframe/ogl](https://github.com/oframe/ogl)；[examples 目录](https://github.com/oframe/ogl/tree/master/examples)；在线示例 — [oframe.github.io/ogl/examples](https://oframe.github.io/ogl/examples)
- `extras/Post.js` 的 API：`post.addPass({ vertex, fragment, uniforms, textureUniform='tMap', enabled })`，内部 FBO ping-pong，`post.render({ scene, camera, texture, target })`。〔已抓取〕 — [ogl/src/extras/Post.js](https://github.com/oframe/ogl/blob/master/src/extras/Post.js)
- npm `ogl@1.0.11`，license 字段 Unlicense。〔已抓取〕 — [registry.npmjs.org/ogl](https://registry.npmjs.org/ogl/latest)
- Codrops 2026-05 文章案例：作者作品集 WebGL 层先用 Three.js 后改写为 OGL，GSAP 以 timeline 每帧 tween shader uniform 驱动。〔仅搜索摘要〕 — [Codrops: From Shader Uniforms to Clip-Path Wipes](https://tympanus.net/codrops/2026/05/06/from-shader-uniforms-to-clip-path-wipes-how-gsap-drives-my-portfolio/)

**Three.js**
- MIT；npm 最新 0.187.0。〔已抓取〕 — [registry.npmjs.org/three](https://registry.npmjs.org/three/latest)
- 官方 CI 体积报告（PR #32154, 2025-10）：WebGL 全量 ESM 355kB min / **86.3kB gz**；最小 tree-shaken（renderer+camera+空 scene）487kB min / **121kB gz**；WebGPU 对应 171kB / 186kB gz。〔已抓取〕 — [three.js PR 32154](https://github.com/mrdoob/three.js/pull/32154)
- 社区解释：tree-shaking 无法去掉 GLSL 着色器字符串，所以最小体积地板偏高。〔仅搜索摘要〕 — [three.js Discourse: Tree Shaking](https://discourse.threejs.org/t/tree-shaking-three-js/1349?page=3)

**Motion（原 Framer Motion）**
- MIT；`npm install motion`；React 从 `motion/react` 导入；"tree-shakable, tiny footprint"。〔已抓取〕 — [motiondivision/motion](https://github.com/motiondivision/motion)
- 官方对比页数字：Motion mini `animate()` ≈2.5–2.6kB，hybrid ≈17–18kB；GSAP ≈23kB。〔仅搜索摘要〕 — [motion.dev feature comparison](https://motion.dev/guides/feature-comparison)
- npm 最新 14.9.0，exports 含 `./mini`、`./react`、`./three`。〔已抓取〕 — [registry.npmjs.org/motion](https://registry.npmjs.org/motion/latest)
- 〔本地实测〕UMD 全量 `dist/motion.js` 179kB → 59.4kB gz（未 tree-shake 的上限，供对照）。
- Motion+ 付费的 React Ticker 组件声称自带 reduced-motion 与键盘焦点处理。〔仅搜索摘要〕 — [motion.dev/docs/react-ticker](https://motion.dev/docs/react-ticker)

**Theatre.js**
- core `@theatre/core` Apache-2.0；`@theatre/studio` AGPL-3.0（仅开发期使用，最终 bundle 只含 core）；README 声明开发"暂时"移至私有仓库以做 1.0；12.8k stars。〔已抓取〕 — [theatre-js/theatre](https://github.com/theatre-js/theatre)
- npm `@theatre/core@0.7.2`，license Apache-2.0。〔已抓取〕 — [registry.npmjs.org/@theatre/core](https://registry.npmjs.org/@theatre/core/latest)

**其他相关库**
- anime.js v4：MIT；npm 4.5.0；ESM min 118.7kB → 40.8kB gz〔本地实测〕；bundle 内含 `ScrollObserver`、`TextSplitter`、`scramble` 符号（即内建滚动观察与文字拆分/乱码）。〔已抓取〕 — [juliangarnier/anime](https://github.com/juliangarnier/anime); [registry](https://registry.npmjs.org/animejs/latest)
- pmndrs/postprocessing：Zlib 许可；`EffectPass` 自动把多个 Effect 合并进一个 shader pass；全屏用单三角形；npm 6.39.6；min 331kB → 115kB gz〔本地实测，不含 three〕。〔已抓取〕 — [pmndrs/postprocessing](https://github.com/pmndrs/postprocessing)
- `@google/model-viewer` 4.4.0：Apache-2.0；`model-viewer.min.js`（内置 three）1.07MB → 288.6kB gz；`model-viewer-module.min.js`（three 作为 peer）475kB → 143kB gz。〔已抓取 + 本地实测〕 — [google/model-viewer](https://github.com/google/model-viewer); [registry](https://registry.npmjs.org/@google/model-viewer/latest)
- darkroom.engineering 的 Next.js 起手模板 Satūs（MIT）展示了该圈层典型技术栈：Lenis + Tempus + GSAP + Theatre.js + 可选 React Three Fiber WebGL 模块，Next.js 16 / React 19 / Tailwind v4。〔已抓取〕 — [darkroomengineering/satus](https://github.com/darkroomengineering/satus)
- pixi-filters 6.1.5 MIT。〔已抓取〕 — [registry](https://registry.npmjs.org/pixi-filters/latest)

### Inferences
- 对一个 Vite 静态站：GSAP(28kB)+ScrollTrigger(18kB)+SplitText/ScrambleText(各 ~4kB) ≈ 54kB gz 即可覆盖绝大多数 2D 动效；若只需少量 2D 动效，Motion mini(≈2.5kB) 或纯 CSS 更省。
- WebGL 层若只做后处理/平面 shader，OGL(≤29kB) 比 Three.js(≥86–121kB) 省 60–90kB gz；需要 glTF/后处理生态时才上 Three.js + postprocessing。
- GSAP 的"免费"是 Webflow 的专有许可而非 OSI 开源，若项目有严格开源合规要求需法务确认。

### Gaps
- gsap.com、motion.dev、lenis 官网均无法打开，官方体积数字只能引用搜索摘要；本地实测的是 UMD/min 文件 gzip，并非 bundler tree-shake 后结果。
- Theatre.js 的当前维护状态（最后提交日期）无法从抓取页面确认。

---

## 关键问题 3：各视觉/动效技法的"最简 CSS 版"与"WebGL 版"及参考代码

### Takeaway
几乎每个效果都存在"CSS/Canvas 零依赖版"与"Three.js/OGL/Pixi 后处理版"两条路径：文字 scramble（Windle 的 `TextScramble` 类 vs GSAP ScrambleTextPlugin/anime.js v4）、glitch（Codrops `clip-path` 切片 CSS vs three.js `GlitchPass`/pmndrs `GlitchEffect`/Pixi `GlitchFilter`）、CRT/scanline（`repeating-linear-gradient` 叠层 vs Lottes 公有领域 CRT shader / pmndrs `ScanlineEffect`）、ASCII/dither（Canvas 2D 回退 vs Codrops Efecto / Bayer 4×4 GLSL）、页面转场（View Transitions API vs Codrops interlude 的 TSL shader 覆盖）、滚动（CSS `animation-timeline: scroll()/view()` vs GSAP ScrollTrigger + Lenis）。下面逐项给出 ≥2 个链接。

### Cited Findings

#### 3.1 文字 scramble / decode
- 零依赖经典实现：Justin Windle (@soulwire) 的 "Text Scramble Effect"——`TextScramble` 类，`chars = '!<>-_\\/[]{}—=+*^?#________'`，`setText()` 返回 Promise，`update()` 用 `requestAnimationFrame` 逐字随机起止帧，乱码字包 `<span class="dud">`（约 28% 帧重掷）。〔已抓取 gist〕 — [gist 副本](https://gist.github.com/Marty-f13/b1fdcf9d9f92600ce0c6903c57fd1971)；原 Pen — [codepen.io/soulwire/pen/mErPAK](https://codepen.io/soulwire/pen/mErPAK)
- 变体：Decotii 的"从左到右 scramble→descramble、仅用目标字符"Pen；Jason Davis 的 anime.js v4 内建 scramble 示例。〔仅搜索摘要〕 — [codepen.io/decotii/pen/vEKvwaQ](https://codepen.io/decotii/pen/vEKvwaQ); [codepen.io/jasondavis/pen/jEVvvNp](https://codepen.io/jasondavis/pen/jEVvvNp)
- 库方案：GSAP ScrambleTextPlugin（现已免费，npm 包内含 `ScrambleTextPlugin.min.js` 4.0kB gz）。〔已抓取 npm〕 — 文档 [gsap.com/docs/v3/Plugins/ScrambleTextPlugin](https://gsap.com/docs/v3/Plugins/ScrambleTextPlugin/)〔仅搜索摘要〕；anime.js v4 bundle 内含 `scramble`/`TextSplitter`。〔已抓取〕 — [juliangarnier/anime](https://github.com/juliangarnier/anime)
- Vue 封装 `text-scrambler`（npm）直接搬运 Windle 代码。〔仅搜索摘要〕 — [npm text-scrambler](https://www.npmjs.com/package/text-scrambler)

#### 3.2 Glitch / RGB-split / datamosh（hover 与页面转场）
- **CSS-only glitch（切片）**：Codrops "CSS Glitch Effect"——"powered by CSS animations and the clip-path property"，灵感来自 404 conference speakers 页；配套 GlitchSlideshow 用同技法做幻灯转场。许可：可商用但不得原样转售。〔已抓取〕 — [codrops/CSSGlitchEffect](https://github.com/codrops/CSSGlitchEffect)（Demo: tympanus.net/Tutorials/CSSGlitchEffect/）；[codrops/GlitchSlideshow](https://github.com/codrops/GlitchSlideshow)；像素化 + glitch hover — [codrops/GlitchPerspective](https://github.com/codrops/GlitchPerspective)(MIT)；网格 glitch 幻灯 — [codrops/GlitchyGrid](https://github.com/codrops/GlitchyGrid)
- **CSS RGB split**：kaleidawave 的 rgb-split-text "Created using the css mix-blend-mode"，有在线生成器。〔已抓取〕 — [kaleidawave/rgb-split-text](https://github.com/kaleidawave/rgb-split-text)（demo: kaleidawave.github.io/rgb-split-text/）；Jonathan MH 的 RGB/CMYK 通道分离 keyframe 教程（附 CodePen）。〔仅搜索摘要〕 — [jonathanmh.com](https://jonathanmh.com/p/css-rgb-cmyk-channel-splitting)；Alvaro Trigo 的 CSS glitch 生成器（hover 触发、可调强度/速度/通道）。〔仅搜索摘要〕 — [alvarotrigo.com/fullPage/css-glitch-effect](https://alvarotrigo.com/fullPage/css-glitch-effect/)
- MDN `mix-blend-mode` 支持 `screen / multiply / difference / overlay / hard-light` 等值（RGB split 常用 `screen`/`difference`）。〔已抓取 MDN 源文件〕 — [MDN mix-blend-mode](https://developer.mozilla.org/en-US/docs/Web/CSS/mix-blend-mode)
- **WebGL glitch（Three.js 内建）**：`GlitchPass(dt_size=64)`，内部 `DigitalGlitch` shader：随机 `tDisp` 位移贴图（RedFormat/FloatType）、`byp` 旁路、`amount/angle/seed/seed_x/seed_y/distortion_x/distortion_y` uniforms；片元中按 `angle` 做 RGB 三通道偏移采样 `vec4(cr.r, cga.g, cb.b, cga.a)` 并叠加噪点；每 120–240 帧触发一次"大故障"，`goWild=true` 持续故障。〔已抓取〕 — [GlitchPass.js](https://github.com/mrdoob/three.js/blob/dev/examples/jsm/postprocessing/GlitchPass.js); [DigitalGlitch.js](https://github.com/mrdoob/three.js/blob/dev/examples/jsm/shaders/DigitalGlitch.js); 官方示例 RenderPass→GlitchPass→OutputPass — [webgl_postprocessing_glitch.html](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_postprocessing_glitch.html)
- **WebGL glitch（pmndrs）**：`src/effects/` 含 `GlitchEffect.js`、`ChromaticAberrationEffect.js`、`NoiseEffect.js`、`ScanlineEffect.js`、`PixelationEffect.js`、`DotScreenEffect.js`、`GridEffect.js`、`ASCIIEffect.js`、`LensDistortionEffect.js`、`VignetteEffect.js`。〔已抓取〕 — [postprocessing/src/effects](https://github.com/pmndrs/postprocessing/tree/main/src/effects)；在线 demo — [pmndrs.github.io/postprocessing/public/demo](https://pmndrs.github.io/postprocessing/public/demo)；React 封装 — [pmndrs/react-postprocessing](https://github.com/pmndrs/react-postprocessing)
- **2D Canvas/WebGL（Pixi）**：pixi-filters 提供 `GlitchFilter`、`RGBSplitFilter`、`CRTFilter`、`AsciiFilter`、`DotFilter`、`OldFilmFilter`、`PixelateFilter`、`ShockwaveFilter`（MIT），各有在线 demo。〔已抓取〕 — [pixijs/filters](https://github.com/pixijs/filters)（demo 例：filters.pixijs.download/main/examples/index.html?enabled=GlitchFilter）
- **Bad TV（滚动条纹/撕裂）**：felixturner/bad-tv-shader（MIT）——`time/distortion/distortion2/speed/rollSpeed` uniforms，作为 Three.js ShaderPass 使用。〔已抓取〕 — [felixturner/bad-tv-shader](https://github.com/felixturner/bad-tv-shader)（demo: felixturner.github.io/bad-tv-shader/example/）
- **图像间 glitch 转场**：gl-transitions 收录 100+ GLSL 转场（MIT，含 `GlitchMemories`），有 `gl-transition`/`react-gl-transition` 包，shader 只需实现 `transition(vec2 uv)`。〔已抓取〕 — [gl-transitions/gl-transitions](https://github.com/gl-transitions/gl-transitions)（gallery: gl-transitions.com/gallery）；Codrops 的 WebGL Image Transitions（three.js + gl-transitions）。〔已抓取〕 — [akella/webGLImageTransitions](https://github.com/akella/webGLImageTransitions)（demo: tympanus.net/Development/webGLImageTransitions/）
- **Hover 位移扭曲**：Codrops "WebGL Distortion Hover Effects"（three.js，displacement 贴图驱动）；评论指出每帧为每张图重渲染场景导致性能问题。〔仅搜索摘要〕 — [Codrops 2018](https://tympanus.net/codrops/2018/04/10/webgl-distortion-hover-effects/)
- 真正的 **datamosh**（运动矢量/帧间误差）Web 实现：本次未搜到可靠开源项目（见 Gaps）。

#### 3.3 Scanlines / CRT / dither 后处理
- **CSS-only**：scanline 叠层通用做法是 `repeating-linear-gradient` 半透明横纹覆盖层——MDN 文档（函数本身）。〔仅搜索摘要〕 — [MDN repeating-linear-gradient](https://developer.mozilla.org/en-US/docs/Web/CSS/repeating-linear-gradient()); 本次未找到一个可核对的 CSS-only CRT CodePen（见 Gaps）。
- **GLSL CRT 参考（公有领域）**：Timothy Lottes CRT shader——头注 "PUBLIC DOMAIN CRT STYLED SCAN-LINE SHADER… Please take and use, change, or whatever"；参数 `hardScan(-8)`, `hardPix(-3)`, `warpX/warpY(0.031/0.041)`, `maskDark/maskLight(0.5/1.5)`, `shadowMask(3)`；算法：高斯横向滤波 + 三条相邻扫描线混合 + bloom + 桶形畸变 + shadow mask。〔已抓取〕 — [libretro/glsl-shaders crt-lottes.glsl](https://github.com/libretro/glsl-shaders/blob/master/crt/shaders/crt-lottes.glsl)；同目录还有 crt-geom、crt-easymode、crt-royale、crt-hyllian、zfast-crt 等数十种预设。〔已抓取〕 — [glsl-shaders/crt](https://github.com/libretro/glsl-shaders/tree/master/crt)
- Shadertoy 对应：Lottes 原版 `shadertoy.com/view/MsjXzh`（Godot 移植页标注 public domain）；`view/Ms23DR` 基于 Inigo Quilez 后处理，CC BY-NC-SA 3.0（**非商用**，慎用）；`view/Ms3XWH`（扫描线+噪点+色差）。〔仅搜索摘要，Shadertoy 被拒无法核对〕 — [godotshaders CRT with realistic blurring](https://godotshaders.com/shader/crt-shader-with-realistic-blurring/); [godotshaders CRT Shader](https://godotshaders.com/shader/crt-shader-2/); [Shadertoy→Matchbox 博文](https://trout-decagon-lrxt.squarespace.com/blog/tag/CRT)
- **库方案**：pmndrs `ScanlineEffect`/`ChromaticAberrationEffect`/`NoiseEffect`/`DotScreenEffect`〔已抓取〕 — [postprocessing/src/effects](https://github.com/pmndrs/postprocessing/tree/main/src/effects)；Pixi `CRTFilter`/`OldFilmFilter`〔已抓取〕 — [pixijs/filters](https://github.com/pixijs/filters)
- **Dither**：Codrops "Building a Real-Time Dithering Shader"（2025-06）——Three.js + postprocessing 库，4×4 Bayer 矩阵有序抖动，`pixelSize` 与灰度选项。〔仅搜索摘要〕 — [Codrops dithering shader](https://tympanus.net/codrops/2025/06/04/building-a-real-time-dithering-shader/)
- OGL 后处理骨架：`post-bloom.html` / `post-fluid-distortion.html` / `post-fxaa.html` 示例 + `Post.addPass({fragment, uniforms})`。〔已抓取〕 — [ogl examples](https://github.com/oframe/ogl/tree/master/examples)

#### 3.4 ASCII / dither 图像效果
- Codrops "Efecto: Building Real-Time ASCII and Dithering Effects with WebGL Shaders"（2026-01-04）：Three.js + postprocessing，8 种 ASCII 风格，GLSL 内程序化生成字形（非位图字体），按格子中心亮度选字符；附 CRT 色差/bloom；WebGPU 不可用（如 Firefox）时回退 Canvas 2D。〔仅搜索摘要〕 — [Codrops Efecto](https://tympanus.net/codrops/2026/01/04/efecto-building-real-time-ascii-and-dithering-effects-with-webgl-shaders)
- Codrops 标签页 "dithering" 收录 "Dither / ASCII Effect Pro"（Sabo Sugi, 2026-01-14, tags ASCII/Canvas/Dithering）。〔仅搜索摘要〕 — [Codrops tag: dithering](https://tympanus.net/codrops/hub/tag/dithering/)
- 库方案：pmndrs `ASCIIEffect.js`〔已抓取〕 — [postprocessing/src/effects](https://github.com/pmndrs/postprocessing/tree/main/src/effects)；Pixi `AsciiFilter`、`DotFilter`〔已抓取〕 — [pixijs/filters](https://github.com/pixijs/filters)
- React 组件：21st.dev `shader-dither`。〔仅搜索摘要〕 — [21st.dev shader-dither](https://21st.dev/@eduardoamaral.ux/components/shader-dither.md)

#### 3.5 Holographic / iridescent 渐变
- CodePen：Simey "Refract button"（`.iridescent` 类，叠层渐变+复杂阴影+blend modes）；Open Home Foundation "Holographic Ticket"（多层彩虹渐变）；Christian Hej "Holographic Masks"（渐变 specular 叠在 mask 图像上）。〔仅搜索摘要〕 — [codepen.io/simeydotme/pen/jEbYwRa](https://codepen.io/simeydotme/pen/jEbYwRa); [codepen.io/openhomefoundation/pen/ogLpqXJ](https://codepen.io/openhomefoundation/pen/ogLpqXJ); [codepen.io/HejChristian/pen/YPzLbYX](https://codepen.io/HejChristian/pen/YPzLbYX)
- 教程：OpenReplay——堆叠多层渐变，建议 OKLCH 插值更平滑，`background-position` 位移做 shimmer。〔仅搜索摘要〕 — [blog.openreplay.com holographic](https://blog.openreplay.com/creating-holographic-effects-css/)
- 组件：21st.dev "Iridescent Foil"。〔仅搜索摘要〕 — [21st.dev iridescent-foil](https://21st.dev/@dqnamo/components/iridescent-foil)

#### 3.6 警示条纹（warning stripes）与标签系统
- 核心函数 `repeating-linear-gradient(45deg, #000 0 10px, #ffd400 10px 20px)`：MDN 说明只需定义一个周期浏览器自动平铺。〔仅搜索摘要〕 — [MDN repeating-linear-gradient](https://developer.mozilla.org/en-US/docs/Web/CSS/repeating-linear-gradient())
- alexwlchan "under construction" TIL：用 `repeating-linear-gradient` 做 hazard-tape 边框，并指出 `border-image` 与 `border-radius` 不兼容（改用背景渐变 + 内层元素）。〔仅搜索摘要〕 — [alexwlchan.net under-construction](https://alexwlchan.net/til/2024/under-construction/)
- 以 CSS 变量参数化条纹宽度/角度的做法。〔仅搜索摘要〕 — [dev.to stripes with CSS variables](https://dev.to/alebarbaja/stripes-with-css-variables-580l)
- 商业参考（Framer 组件 "Warning Tape Band"）。〔仅搜索摘要〕 — [framer.com warningtapeband](https://www.framer.com/marketplace/components/warningtapeband/)
- 标签/切角：`clip-path: polygon()`（MDN）可用于标签切角与 HUD 括角。〔已抓取 MDN 源文件〕 — [MDN clip-path](https://developer.mozilla.org/en-US/docs/Web/CSS/clip-path)

#### 3.7 硬切 "snap" 转场 vs 缓动（GSAP / Motion / View Transitions / CSS steps）
- CSS `steps(n, jump-start|jump-end|jump-none|jump-both)`：把时长切成等长区间瞬跳；`steps(1, start)`/`step-start` 即"硬切"。〔已抓取 MDN 源文件〕 — [MDN steps()](https://developer.mozilla.org/en-US/docs/Web/CSS/easing-function/steps)
- GSAP `SteppedEase`：`ease: "steps(5)"`；论坛指出 `steps(1)` 默认在中点跳变，`steps(1, true)` 可立即跳（社区称"未文档化"），或用零时长 `set()`。〔仅搜索摘要〕 — [gsap.com SteppedEase](https://gsap.com/docs/v3/Eases/SteppedEase); [GSAP 论坛 stepped curve](https://gsap.com/community/forums/topic/39407-my-dream-perfect-simple-stepped-curve/)
- **View Transitions API**：SPA 用 `document.startViewTransition(cb)`，MPA 在两端文档声明 `@view-transition { navigation: auto }`（同源）；伪元素树 `::view-transition → ::view-transition-group(root) → ::view-transition-image-pair(root) → ::view-transition-old(root)/::view-transition-new(root)`；默认 cross-fade，可用普通 CSS `animation` 覆盖 old/new（例：`::view-transition-old(root), ::view-transition-new(root){animation-duration:.5s}`，硬切即设为 `steps(1)` 或 `animation: none`）；页面 `hidden` 时转场被跳过。〔已抓取 MDN 源文件〕 — [MDN Using the View Transition API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API/Using); [MDN View Transition API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API); 官方示例仓库（spa/mpa/transition-types）— [mdn/dom-examples/view-transitions](https://github.com/mdn/dom-examples/tree/main/view-transitions)
- 浏览器支持（web-features 生成数据）：view-transitions **Baseline low 2025-10-14**：Chrome/Edge 111, Firefox 144, Safari 18。〔已抓取〕 — [web-features view-transitions.yml.dist](https://github.com/web-platform-dx/web-features/blob/main/features/view-transitions.yml.dist)；跨文档版 caniuse：Chrome/Edge 126+, Safari 18.2+, Firefox 不支持。〔仅搜索摘要〕 — [caniuse cross-document-view-transitions](https://caniuse.com/cross-document-view-transitions)
- **GSAP + WebGL 页面转场起手（2026）**：Codrops interlude——Astro `<ClientRouter/>` + `transition:animate="none"` 关闭原生动画，GSAP 遮盖→换 DOM→揭示；WebGL 转场用 three.js TSL shader（`shaderCover()`），Lenis 可选；MIT，自述不活跃维护。〔已抓取〕 — [codrops/interlude](https://github.com/codrops/interlude)（demo: interlude.crnacura.workers.dev）
- 其他 Codrops 转场集：PixelTransition（像素块转场，GSAP）、KineticTypePageTransition、UnrevealEffects（clip-path 覆盖）、LayersAnimation、PageTransitions。〔已抓取仓库列表〕 — [codrops/PixelTransition](https://github.com/codrops/PixelTransition); [codrops/KineticTypePageTransition](https://github.com/codrops/KineticTypePageTransition); [codrops/UnrevealEffects](https://github.com/codrops/UnrevealEffects); [codrops/LayersAnimation](https://github.com/codrops/LayersAnimation)

#### 3.8 滚动驱动动画（CSS scroll-timeline / GSAP ScrollTrigger / Lenis）
- CSS：`animation-timeline: scroll(nearest inline)` / `view()`、命名 `scroll-timeline: --name` / `view-timeline-name`、`animation-range: entry 10% exit 90%`；必须先写 `animation` 再写 `animation-timeline`；`animation-duration` 无效；可用 `@supports not (scroll-timeline: --x)` 提示降级。〔已抓取 MDN 源文件〕 — [MDN CSS scroll-driven animations](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_scroll-driven_animations); [MDN Timelines 指南](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_scroll-driven_animations/Timelines); [MDN animation-range](https://developer.mozilla.org/en-US/docs/Web/CSS/animation-range)
- 支持度：scroll-driven-animations **baseline: false**，Chrome/Edge 115+，Safari/iOS 26+，Firefox 无（截至数据生成）。〔已抓取〕 — [web-features scroll-driven-animations.yml.dist](https://github.com/web-platform-dx/web-features/blob/main/features/scroll-driven-animations.yml.dist); WebKit 官方指南 — [webkit.org/blog/17101](https://webkit.org/blog/17101/a-guide-to-scroll-driven-animations-with-just-css/)〔仅搜索摘要〕
- GSAP 侧：README 称 ScrollTrigger 是滚动动画"标准"，配套 ScrollSmoother。〔已抓取〕 — [greensock/GSAP](https://github.com/greensock/GSAP)；Lenis+ScrollTrigger 同步代码见关键问题 2。〔已抓取〕 — [lenis README](https://github.com/darkroomengineering/lenis)
- Codrops 滚动案例仓库（GSAP ScrollTrigger/Flip、Lenis）：ScrollBasedLayoutAnimations、OneElementScroll、OnScrollFilter（SVG filter）、ScrollTextMotion、LoopScrolling（GSAP+Lenis 无限循环）、SeamTransitions（2026-10，11 种 hero 接缝转场，GSAP 3.15 + ScrollTrigger/ScrollSmoother/SplitText/Physics2D + WebGL/canvas，字体 Kode Mono）。〔已抓取〕 — [codrops/ScrollBasedLayoutAnimations](https://github.com/codrops/ScrollBasedLayoutAnimations); [codrops/OnScrollFilter](https://github.com/codrops/OnScrollFilter); [codrops/LoopScrolling](https://github.com/codrops/LoopScrolling); [codrops/SeamTransitions](https://github.com/codrops/SeamTransitions)

#### 3.9 自定义光标与磁性按钮
- Codrops Magnetic Buttons（MIT，2020，灵感 Cuberto）。〔已抓取〕 — [codrops/MagneticButtons](https://github.com/codrops/MagneticButtons)（demo: tympanus.net/Development/MagneticButtons/）
- HUD 感最强的光标参考：Codrops **CrosshairDistortion**——全屏 SVG 十字准星光标 + hover 扭曲（MIT）。〔已抓取〕 — [codrops/CrosshairDistortion](https://github.com/codrops/CrosshairDistortion)（demo: tympanus.net/Tutorials/CrosshairDistortion/）
- 其他：AnimatedCustomCursor（SVG filter 扭曲）、GooeyCursor（SVG filter + blend）。〔已抓取〕 — [codrops/AnimatedCustomCursor](https://github.com/codrops/AnimatedCustomCursor); [codrops/GooeyCursor](https://github.com/codrops/GooeyCursor)
- tholman/cursor-effects（MIT，12 种复古光标，自动在 `prefers-reduced-motion` 下不显示）。〔已抓取〕 — [tholman/cursor-effects](https://github.com/tholman/cursor-effects)
- 21st.dev 多个 Magnetic Button React 组件。〔仅搜索摘要〕 — [21st.dev magnetic-button](https://21st.dev/@21st/components/magnetic-button)

#### 3.10 Ticker / marquee 数据条
- Codrops CSSMarqueeMenu（MIT，纯 CSS，hover 播放）。〔已抓取〕 — [codrops/CSSMarqueeMenu](https://github.com/codrops/CSSMarqueeMenu)（demo: tympanus.net/Development/CSSMarqueeMenu/）；JS 版 MarqueeMenu（K72/Locomotive 复刻）。〔已抓取〕 — [codrops/MarqueeMenu](https://github.com/codrops/MarqueeMenu)
- CodePen：hexagoncircle "CSS Marquee Examples"（reduced-motion 暂停、启停开关、复制内容 `aria-hidden`、hover 暂停）；jamesneufeld "Smooth Infinite CSS-Only Marquee"（内容复制 + linear infinite）。〔仅搜索摘要〕 — [codepen.io/hexagoncircle/pen/eYMrGwW](https://codepen.io/hexagoncircle/pen/eYMrGwW); [codepen.io/jamesneufeld/pen/myVZJRq](https://codepen.io/jamesneufeld/pen/myVZJRq)
- 无障碍 marquee 教程（Tailwind `motion-safe`/`motion-reduce`）。〔仅搜索摘要〕 — [dev.to olpeh](https://dev.to/olpeh/modern-and-accessible-marquee-clone-with-tailwindcss-5abb)

#### 3.11 音频可视化（Web Audio AnalyserNode）
- MDN `getByteFrequencyData()`：填充 `Uint8Array(frequencyBinCount)`，值 0–255，`fftSize=256` 示例在 rAF 循环中画 canvas 柱状图；Baseline 自 2015-07。〔仅搜索摘要〕 — [MDN getByteFrequencyData](https://developer.mozilla.org/en-US/docs/web/api/analysernode/getbytefrequencydata)
- Codrops 教程：Audio Reactive Shaders with Three.js and Shader Park（2023）；Coding a 3D Audio Visualizer with Three.js, GSAP & Web Audio API（2025，GLSL 球体 + 频率驱动形变）；AudioVisualizers（p5.js/p5.sound 线条可视化）。〔前两条仅搜索摘要；第三条已抓取〕 — [Codrops Shader Park](https://tympanus.net/codrops/2023/02/07/audio-reactive-shaders-with-three-js-and-shader-park/); [Codrops 3D Audio Visualizer](https://tympanus.net/codrops/?p=95714); [codrops/AudioVisualizers](https://github.com/codrops/AudioVisualizers)

#### 3.12 3D Runner / 模型查看器（model-viewer / Three.js GLTF）
- `<model-viewer>`：Apache-2.0；CDN `<script type="module" src="https://ajax.googleapis.com/ajax/libs/model-viewer/{version}/model-viewer.min.js">`；支持最近 2 个大版本的常青浏览器；three 为 peer 依赖且建议锁定版本。〔已抓取〕 — [model-viewer README](https://github.com/google/model-viewer/blob/master/packages/model-viewer/README.md); 文档 — [modelviewer.dev](https://modelviewer.dev)
- 体积〔本地实测〕：内置 three 版 288.6kB gz；module 版 143kB gz（three 另算）。第三方给出的 ~170KB/~280KB 口径不一。〔仅搜索摘要〕 — [svilenkovic model-viewer tutorial](https://svilenkovic.com/3d/model-viewer-google-tutorial)
- Three.js 官方 glTF 示例：`GLTFLoader` from `three/addons/loaders/GLTFLoader.js`，环境用 `UltraHDRLoader` 加载 `.hdr.jpg`，`renderer.compileAsync()` 后再加入场景，`AnimationMixer` 播放动画。〔已抓取〕 — [webgl_loader_gltf.html](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_loader_gltf.html)
- OGL 轻量替代：`load-gltf.html`、`gltf-ktx2-basis-draco.html`、`gltf-draco-webp.html`。〔已抓取〕 — [ogl examples](https://github.com/oframe/ogl/tree/master/examples)

#### 3.13 视频背景（WebM/AV1 + reduced-motion 回退）
- cleverage/responsive-video-background（MIT）：仅在用户未要求减少动态时播放视频；`webm`/`mp4` 属性、`breakpoint`（窄屏显示图片）、`poster`（建议首帧渐进 JPEG）、`fallback` 图片。〔已抓取〕 — [cleverage/responsive-video-background](https://github.com/cleverage/responsive-video-background)
- web.dev：对 `<source media="(prefers-reduced-motion: no-preference)">` 提供动图/视频、静态 `<img>` 回退；背景/自动播放视频属于应被削减的装饰性动效。〔已抓取 web.dev 源文件〕 — [web.dev prefers-reduced-motion](https://web.dev/articles/prefers-reduced-motion)
- 编码顺序：源之间顺序决定优先级，WebM/AV1 在前、H.264 MP4 兜底；iOS 低电量模式会禁用自动播放，poster 必须独立成立。〔仅搜索摘要〕 — [swarmify autoplay background video](https://swarmify.com/blog/how-to-make-an-autoplaying-background-video/); [profiletree background videos](https://profiletree.com/background-videos/)

#### 3.14 可变字体动效
- `font-variation-settings` 可 transition/animate；标准轴 `wght/wdth` 小写、自定义轴大写；用 wakamaifondue.com 查轴范围；逐字 span + delay 做错落。〔仅搜索摘要〕 — [24ways: Interactivity and Animation with Variable Fonts](https://24ways.org/2019/interactivity-and-animation-with-variable-fonts/); [valhead: Animating variable fonts with CSS](https://valhead.com/2020/11/15/animating-variable-fonts-with-css/); [CSS IRL: Variable Font Animation with CSS and Splitting JS](https://css-irl.info/variable-font-animation-with-css-and-splitting-js/)

#### 3.15 噪点/颗粒（SVG feTurbulence vs canvas）
- MDN `<feTurbulence>`：属性 `baseFrequency`、`numOctaves`、`seed`、`stitchTiles`、`type`（示例 `type="turbulence" baseFrequency="0.05" numOctaves="2"` 配合 `feDisplacementMap`）。〔已抓取 MDN 源文件〕 — [MDN feTurbulence](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feTurbulence)
- 教程：feTurbulence 零带宽生成颗粒，需 `feColorMatrix` 去饱和成单色；`numOctaves` 主导 CPU 成本，建议 ≤3–4；叠层用 `mix-blend-mode: overlay`。〔仅搜索摘要〕 — [habr: SVG grain](https://habr.com/en/articles/780840); [loke.dev svg-grain-textures-performance](https://loke-dev-lokedevs-projects.vercel.app/blog/svg-grain-textures-performance)
- 反对意见：Reddit 评论认为这些实时滤镜会拖垮低端移动设备，建议把颗粒烘进贴图。〔仅搜索摘要〕 — [r/css noise effect](https://reddit.birdcat.cafe/r/css/comments/1jiyvwd/how_to_add_a_noise_effect)
- WebGL 侧：pmndrs `NoiseEffect`、Three.js `DigitalGlitch` 中的 `snow` 噪点项。〔已抓取〕 — [postprocessing/src/effects](https://github.com/pmndrs/postprocessing/tree/main/src/effects)

#### 3.16 低多边形平涂 3D（MeshToonMaterial / gradientMap）与描边
- 官方 toon 示例：用 `Uint8Array(alphaIndex+2)` 均匀填值 → `new THREE.DataTexture(colors, colors.length, 1, THREE.RedFormat)` 作为 `MeshToonMaterial({ gradientMap })`，阶数即色带数。〔已抓取〕 — [webgl_materials_toon.html](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_materials_toon.html)
- 文档注意：gradientMap 贴图需 `minFilter/magFilter = NearestFilter` 才有硬边色带；MeshToonMaterial 不再支持 `flatShading`（低多边形硬边需非索引几何 + 每面法线）。〔仅搜索摘要〕 — [sbcode MeshToonMaterial](https://sbcode.net/threejs/meshtoonmaterial/); [threejs.org MeshToonMaterial](https://threejs.org/docs/pages/MeshToonMaterial.html)
- OGL 平涂参考：`flat-shading-matcap.html`。〔已抓取〕 — [ogl examples](https://github.com/oframe/ogl/tree/master/examples)
- **描边 A（后处理）**：Three.js `OutlinePass`——深度遮罩→选择遮罩→降采样→边缘检测→两次高斯模糊（`edgeThickness`、`edgeGlow`）→叠加；参数 `edgeStrength(3)`, `visibleEdgeColor`, `hiddenEdgeColor`, `pulsePeriod`；官方示例用 raycast hover 设置 `selectedObjects`，链尾 OutputPass + FXAA。〔已抓取〕 — [OutlinePass.js](https://github.com/mrdoob/three.js/blob/dev/examples/jsm/postprocessing/OutlinePass.js); [webgl_postprocessing_outline.html](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_postprocessing_outline.html)；pmndrs `OutlineEffect.js`。〔已抓取〕 — [postprocessing/src/effects](https://github.com/pmndrs/postprocessing/tree/main/src/effects)
- **描边 B（inverted hull）**：drei `<Outlines color thickness={0.05} screenspace angle opacity />` 取父 mesh 几何绘制反向外壳，支持 mesh/skinnedMesh/instancedMesh。〔已抓取〕 — [drei docs/abstractions/outlines.mdx](https://github.com/pmndrs/drei/blob/master/docs/abstractions/outlines.mdx)

### Inferences
- "最简 CSS 版 → WebGL 版"的升级路径可按页面预算分级：首屏只用 CSS（clip-path glitch、repeating-gradient scanline/stripes、steps() 硬切、scroll() 时间线），仅在 hero/模型区按需加载 OGL/Three 后处理。
- Three.js 内建 `GlitchPass` 的 RGB 偏移 + 位移块 + 噪点，正是 Marathon 式"数字故障"的最小 GLSL 配方；可直接移植到 OGL `Post.addPass` 的 fragment 里以省体积。
- Codrops 2026 年的 interlude 与 SeamTransitions 代表当前"GSAP + WebGL + Astro/Lenis"转场主流做法，可作为 Vite 站的架构范本（去掉 Astro 路由后逻辑相同）。

### Gaps
- 真正的 **datamosh**（基于运动矢量/帧间残差）Web 开源实现未找到（搜索预算耗尽前未命中），现有"glitch"均为位移块 + RGB split 近似。
- 未找到可核对的 **CSS-only CRT/scanline CodePen**；仅能给出 `repeating-linear-gradient` 原理与 MDN 链接。
- Codrops 文章正文（Efecto、dithering、Distortion Hover、magnetic/cursor 教程）与所有 CodePen 均无法打开，细节以搜索摘要为准。
- 自定义 HUD 括角/标签系统没有找到成体系的开源 CSS 设计系统，只有 `clip-path`/`repeating-linear-gradient` 原语。

---

## 关键问题 4：性能与无障碍护栏（prefers-reduced-motion、滤镜 GPU 成本、Lighthouse、WebGL 懒加载、库体积）

### Takeaway
行业共识是"默认静态、在 `(prefers-reduced-motion: no-preference)` 下渐进加动效"，JS 动画须用 `matchMedia` 运行时判断（GSAP 提供 `gsap.matchMedia()`）；`backdrop-filter`/大面积 `filter` 会使渲染成本翻倍且在移动 GPU 上尤其糟；WebGL 应 IntersectionObserver + `import()` 懒加载并在离屏时暂停/释放；库体积预算见关键问题 2。

### Cited Findings
- web.dev：用 `@media (prefers-reduced-motion: reduce)` 移除装饰动效，或仅在 `no-preference` 下添加；JS 用 `window.matchMedia('(prefers-reduced-motion: reduce)')` 并监听变化（Web Animations API 需手动停/启）；应削减的类型：parallax、动画渐变、背景视频、自动播放视频、reveal 动画；大型动画样式表可用 `<link media="(prefers-reduced-motion: no-preference)">` 条件加载，或用 `Sec-CH-Prefers-Reduced-Motion` 客户端提示在服务端内联。〔已抓取 web.dev 源文件〕 — [web.dev prefers-reduced-motion](https://web.dev/articles/prefers-reduced-motion)
- GSAP 官方 a11y 页建议 `gsap.matchMedia()` 把装饰动效包进 `(prefers-reduced-motion: no-preference)` 条件，偏好变化时自动 revert。〔仅搜索摘要〕 — [gsap.com/resources/a11y](https://www.gsap.com/resources/a11y/)
- WCAG 2.3.3 Animation from Interactions：标准机制即 reduced-motion 媒体查询，JS 库需运行时检查。〔仅搜索摘要〕 — [WCAG 2.3.3 说明](https://www.disabilityworld.org/toolkit/standards/wcag/2-3-3-animation-from-interactions/)
- 库内建支持：tholman/cursor-effects 在 reduced-motion 下不渲染〔已抓取〕 — [tholman/cursor-effects](https://github.com/tholman/cursor-effects)；cleverage 视频背景组件只在未请求减少动效时播放〔已抓取〕 — [responsive-video-background](https://github.com/cleverage/responsive-video-background)；hexagoncircle marquee 在 reduced-motion 下暂停并提供开关〔仅搜索摘要〕 — [codepen hexagoncircle](https://codepen.io/hexagoncircle/pen/eYMrGwW)
- `backdrop-filter` 成本：CSS Filter Effects Level 2 草案指出它会"roughly double the required rendering time"并可能需要两倍内存/GPU 带宽存放中间纹理。〔仅搜索摘要〕 — [drafts.csswg.org/filter-effects-2](https://drafts.csswg.org/filter-effects-2/)
- Mozilla bug：Nexus 5 (Adreno 330) 上 backdrop-filter 需多个大 render target，GPU 吃紧，从"不可用"到"勉强可接受"靠 tiled rendering 扩展。〔仅搜索摘要〕 — [bugzilla 1828248](https://bugzilla.mozilla.org/show_bug.cgi?id=1828248); 另一 bug 记录 backdrop-filter 动画 GPU 占用是 Chrome 的 2 倍 — [bugzilla 1769944](https://bugzilla.mozilla.org/show_bug.cgi?id=1769944)
- 缓解手段（博客级证据）：限制模糊面积、把小图模糊后 `transform: scale()` 放大（作者称省 ~75% GPU）、`will-change: transform` 让 iOS 提升合成层。〔仅搜索摘要〕 — [loke.dev css-filter-blur-performance-bottlenecks](https://loke-dev-lokedevs-projects.vercel.app/blog/css-filter-blur-performance-bottlenecks); [besthub iOS backdrop-filter](https://besthub.dev/articles/why-one-css-property-slowed-down-ios-and-how-a-single-line-fixed-it-20c33877cc48)
- SVG feTurbulence：`numOctaves` 主导 CPU 成本（建议 ≤3–4）；低端移动设备风险。〔仅搜索摘要〕 — [habr SVG grain](https://habr.com/en/articles/780840); [r/css](https://reddit.birdcat.cafe/r/css/comments/1jiyvwd/how_to_add_a_noise_effect)
- WebGL 懒加载：canvas 容器接近视口时 IntersectionObserver 触发 `import()` 场景模块并淡入，不要在页面加载时初始化 Three.js；多场景页面对离屏 canvas 暂停渲染循环；Three.js 不自动回收内存，需 `dispose()` geometry/texture/material；组件卸载时 `observer.disconnect()`。〔仅搜索摘要〕 — [svilenkovic how-to-lazy-load-3d-scene](https://svilenkovic.com/3d/how-to-lazy-load-3d-scene); [dev.to Optimizing Three.js: 4 key techniques](https://dev.to/didof/optimizing-threejs-4-key-techniques-4lad); 封装库 — [HunterAkeriano/lazy-viewport-loader](https://github.com/HunterAkeriano/lazy-viewport-loader)
- 后处理性能：pmndrs postprocessing 把多个 Effect 合并为单个 EffectPass、全屏单三角形以减少 draw call 与对角线冗余片元。〔已抓取〕 — [pmndrs/postprocessing](https://github.com/pmndrs/postprocessing)；第三方提醒 three/addons 的 EffectComposer 与 pmndrs 的不可混用（缓冲格式不兼容）。〔仅搜索摘要〕 — [skillselion threejs post-processing](https://skillselion.com/skills/openaec-foundation/three.js-claude-skill-package/threejs-impl-post-processing)
- 旧版 Codrops WebGL hover 效果评论区反映"为每张图每帧重渲染场景"导致 Chrome 卡顿——单 renderer 多 texture 比多 scene 更可取。〔仅搜索摘要〕 — [Codrops WebGL Distortion Hover](https://tympanus.net/codrops/2018/04/10/webgl-distortion-hover-effects/)
- Lenis 限制：Safari 60fps 上限、低电量 30fps；iframe 不转发 wheel 事件。〔已抓取〕 — [lenis README](https://github.com/darkroomengineering/lenis)
- 体积基线（gz, 本地实测/官方 CI）：GSAP core 28.3kB + ScrollTrigger 18.0kB；Lenis 5.4kB；Motion mini ≈2.5kB（官方）；OGL ≤29kB（官方）；Three.js 86–121kB；postprocessing 115kB；model-viewer 143–289kB；anime.js 40.8kB。来源见关键问题 2。

### Inferences
- 对本项目最稳妥的分层：Level 0 纯 CSS（变量色板、stripes、steps() 硬切、clip-path glitch、scroll()）全局可用；Level 1 GSAP+Lenis 仅在 `no-preference` 下初始化；Level 2 WebGL（OGL/Three）用 IntersectionObserver 懒加载，并在 reduced-motion 或 `navigator.hardwareConcurrency`/电量低时直接不加载、用 poster 图替代。
- 全屏 `backdrop-filter`/`filter: blur()` 的 HUD 玻璃面板在移动端应降级为半透明纯色；颗粒用小尺寸 `feTurbulence` 预渲染成平铺 PNG/WebP 或在 WebGL pass 内生成。
- Lighthouse 层面：以上措施主要影响 TBT/INP（主线程初始化 Three/GSAP）与 LCP（hero 视频/WebGL 延后），但本次未找到带具体数字的 Lighthouse 对比报告。

### Gaps
- 未找到任何给出 Lighthouse/INP 具体分数变化的"重动效站点"案例研究（搜索预算耗尽，web.dev 其他文章无法访问）。
- `prefers-reduced-motion` 用户占比统计：web.dev 文章未给出；本次未找到可靠数据。
- GPU 成本结论多来自博客与浏览器 bug 单，缺少系统化 benchmark。

---

## 关键问题 5：值得研究的同类美学获奖站点（Awwwards / FWA / CSSDA / Godly / Minimal Gallery）

### Takeaway
在本次可达范围内只锁定了少量明确"glitch + brutalist + 游戏/HUD"气质的获奖或精选站点：eloyb.design（Awwwards HM 2025-07）、Basement Chronicles（Awwwards SOTD 2023，像素点击冒险）、Awwwards 多个 glitch/brutalist 灵感条目，以及 Codrops 2026 示例所引用的 mosaic.flabbergast.agency；Godly/Minimal Gallery/CSSDA/FWA 的具体条目因站点被拒访问且搜索预算耗尽而未能核对。

### Cited Findings
- **eloyb.design**：Awwwards Honorable Mention 2025-07-04，描述为 "unapologetically glitchy web experience with a brutalist and maximalist aesthetic… broken pixels, ASCII art, and extreme animations"。〔仅搜索摘要〕 — [awwwards.com/sites/eloyb-design](https://www.awwwards.com/sites/eloyb-design)
- **Basement Chronicles: The Internet Needs You**（basement.studio）：像素风点击冒险，Awwwards Site of the Day（2023）。〔仅搜索摘要〕 — [basement.studio showcase](https://basement.studio/showcase/basement-chronicles-the-internet-needs-you.md)
- Awwwards 灵感库相关条目（交互片段级）：Glitchy interactive music video；Crazy and glitchy animation (Leavingstone)；Legislator hover state (Overwatch)；Artifact 404 – "artifact design engineered"；Brutalist design with mini games (Toggl)；Basilico brutalist menu hover；Brutalist fullscreen menu。〔仅搜索摘要〕 — [glitchy-interactive-music-video](https://www.awwwards.com/inspiration/glitchy-interactive-music-video); [crazy-and-glitchy-animation-leavingstone](https://www.awwwards.com/inspiration/crazy-and-glitchy-animation-leavingstone); [legislator-hover-state-overwatch](https://www.awwwards.com/inspiration/legislator-hover-state-overwatch); [artifact-404](https://www.awwwards.com/inspiration/artifact-404-artifact-design-engineered-1); [brutalist-design-with-mini-games-toggl](https://www.awwwards.com/inspiration/brutalist-design-with-mini-games-toggl); [basilico-brutalist-menu-hover](https://www.awwwards.com/inspiration/basilico-brutalist-menu-hover); [brutalist-fullscreen-menu](https://www.awwwards.com/inspiration/brutalist-fullscreen-menu)
- Rethink 的 "Reimagining Reality" 获 Awwwards Site of the Week（2025-10），风格未知。〔仅搜索摘要〕 — [weima.com 新闻](https://weima.com/us/amazing-news-amazing-feedback-site-of-the-day-and-developers-award/)
- Codrops SeamTransitions（2026）列出的灵感站：**mosaic.flabbergast.agency**、PaperDrops demo、Codrops "Designing in Paper as a Developer"。〔已抓取〕 — [codrops/SeamTransitions](https://github.com/codrops/SeamTransitions)；[mosaic.flabbergast.agency](https://mosaic.flabbergast.agency/)
- Codrops 2026 转场起手 interlude 的在线 demo（Astro + GSAP + three.js TSL）。〔已抓取〕 — [interlude.crnacura.workers.dev](https://interlude.crnacura.workers.dev/)
- 可直接当"参考站"用的 Codrops 在线 demo：CrosshairDistortion、CSSGlitchEffect、GlitchSlideshow、PixelTransition、LoopScrolling、SeamTransitions（URL 见第 3 节）。〔已抓取仓库 README〕
- Godly 自述："founded by and curated by Rejiggle in July 2021… highly curated"。〔仅搜索摘要〕 — [godly.website/info](https://godly.website/info)
- CSSDA vs FWA 定位对比：FWA 更适合 "experimental and interactive work, motion-heavy launches, WebGL and immersive sites"。〔仅搜索摘要〕 — [webdesignawards.io compare](https://www.webdesignawards.io/compare/cssda-vs-fwa)
- Dribbble 上的 Marathon 官网概念（见关键问题 1）。〔仅搜索摘要〕 — [dribbble.com/Bircch](https://dribbble.com/Bircch)

### Inferences
- eloyb.design 与 Basement Chronicles 最贴近"平涂 + 硬边 + glitch HUD"，其余 Awwwards 条目是局部交互参考；Marathon 的高饱和平涂撞色在获奖站中更接近 brutalist/maximalist 分支，而非常见的暗色极简 3D 分支。

### Gaps
- Awwwards、FWA、CSSDA、Godly、Minimal Gallery 域名全部被会话网络策略拒绝，且搜索预算在相关查询前耗尽，因此无法给出按年份筛选的 2025–2026 SOTD 清单，也无法核对 Godly/Minimal Gallery 中的具体站点。
- 无法确认 Marathon 官网/ARG 站是否获奖或使用了哪些库。
