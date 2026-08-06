/**
 * Leagues page entry - single ES module import chain (see homeLibs.js for
 * why: one explicit entry file per page, never multiple independent
 * `<script type="module">` tags — Vite 8 will silently drop code from the
 * bundle for some pages otherwise). The locale engine mounts before dynamic
 * archive rendering and the shared navigation mounts afterward.
 */
import '../lib/clock.js';
import '../lib/i18n.js';
import './league.js';
import '../lib/nav.js';
import '../lib/audio.js';
import '../lib/transition.js';
