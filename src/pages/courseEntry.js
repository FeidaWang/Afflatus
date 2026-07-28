/**
 * Course page entry — single ES module import chain (one explicit entry per
 * page; Vite silently drops code from multiple independent module scripts —
 * see homeLibs.js / horoscopeEntry.js for the same note). nav.js MUST run
 * before page-turn.js (the latter reads body.dataset prev/next at module
 * top-level).
 */
import './course.js';
import '../lib/i18n.js';
import '../lib/nav.js';
import '../lib/audio.js';
import '../lib/transition.js';
import '../lib/page-turn.js';

/* v1.7 H2：header 品牌块的滚动微交互（完整标志 ⇄ 字母标）。
   模块内部自带守卫——页面没有 .site-brand 就直接返回，不建 observer。 */
import { mountBrandScroll } from '../lib/brandScroll.js';

mountBrandScroll();
