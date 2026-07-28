/**
 * Sectors page shared-lib load order, as a single ES module entry
 * (see homeLibs.js for why this pattern replaces individual script tags).
 * Order matches the original <script> tag order exactly.
 */
import '../lib/i18n.js';
import '../lib/nav.js';
import '../lib/audio.js';
import '../lib/transition.js';
import '../lib/page-turn.js';

/* v1.7 H2：header 品牌块的滚动微交互（完整标志 ⇄ 字母标）。
   模块内部自带守卫——页面没有 .site-brand 就直接返回，不建 observer。 */
import { mountBrandScroll } from '../lib/brandScroll.js';

mountBrandScroll();
