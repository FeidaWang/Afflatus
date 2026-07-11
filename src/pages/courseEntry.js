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
