/**
 * Games page entry - single ES module import chain replacing 7 separate
 * `<script type="module" src>` tags (see homeLibs.js for why).
 * The locale engine mounts before dynamic archive rendering so a restored
 * Chinese preference cannot produce an English first data frame.
 */
import '../lib/clock.js';
import '../lib/i18n.js';
import './games.js';
import '../lib/nav.js';
import '../lib/audio.js';
import '../lib/transition.js';
import '../lib/page-turn.js';
