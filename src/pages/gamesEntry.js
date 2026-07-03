/**
 * Games page entry - single ES module import chain replacing 7 separate
 * `<script type="module" src>` tags (see homeLibs.js for why).
 * Order matches the original <script> tag order exactly.
 */
import '../lib/clock.js';
import './games.js';
import '../lib/i18n.js';
import '../lib/nav.js';
import '../lib/audio.js';
import '../lib/transition.js';
import '../lib/page-turn.js';
