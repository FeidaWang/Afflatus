/**
 * Novels page shared-lib load order, as a single ES module entry
 * (see homeLibs.js for why this pattern replaces individual script tags).
 * Order matches the original <script> tag order exactly.
 */
import '../lib/i18n.js';
import '../lib/nav.js';
import '../lib/transition.js';
import '../lib/page-turn.js';
