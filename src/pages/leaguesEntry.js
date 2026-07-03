/**
 * Leagues page entry - single ES module import chain (see homeLibs.js for
 * why: one explicit entry file per page, never multiple independent
 * `<script type="module">` tags — Vite 8 will silently drop code from the
 * bundle for some pages otherwise). Order matches games.html's pattern:
 * nav.js MUST run before page-turn.js (the latter reads body.dataset
 * prev/next synchronously at module top-level).
 */
import '../lib/clock.js';
import './leagues.js';
import '../lib/i18n.js';
import '../lib/nav.js';
import '../lib/audio.js';
import '../lib/transition.js';
import '../lib/page-turn.js';
