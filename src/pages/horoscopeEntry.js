/**
 * Horoscope page entry — single ES module import chain (one explicit entry
 * per page, never multiple independent `<script type="module">` tags; Vite 8
 * silently drops code otherwise — see homeLibs.js). nav.js MUST run before
 * page-turn.js (the latter reads body.dataset prev/next at module top-level).
 */
import './horoscope.js';
import '../lib/i18n.js';
import '../lib/nav.js';
import '../lib/audio.js';
import '../lib/transition.js';
import '../lib/page-turn.js';
