/**
 * Stats page shared-lib load order, as a single ES module entry
 * (see homeLibs.js for why this pattern replaces individual script tags).
 * nav.js MUST run before page-turn.js (the latter reads body.dataset
 * prev/next synchronously at module top-level).
 */
import '../lib/i18n.js';
import '../lib/nav.js';
import '../lib/transition.js';
import '../lib/page-turn.js';
