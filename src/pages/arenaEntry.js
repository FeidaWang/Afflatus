/**
 * Arena page entry - single ES module import chain replacing 8 separate
 * `<script type="module" src>` tags (see homeLibs.js for why: Vite 8's
 * per-HTML multi-script chunking silently dropped some of them).
 * Order matches the original <script> tag order exactly.
 */
import './arena-bg.js';
import '../lib/audio.js';
import '../lib/transition.js';
import '../lib/i18n.js';
import '../lib/nav.js';
import '../lib/page-turn.js';
import '../lib/clock.js';
import './arena.js';
import './arenaTech.js';
import './arenaAutopilot.js';
