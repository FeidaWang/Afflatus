/**
 * Stats page shared-lib load order, as a single ES module entry
 * (see homeLibs.js for why this pattern replaces individual script tags).
 * Navigation and transition behaviour share this ordered entry point.
 */
import '../lib/i18n.js';
import '../lib/nav.js';
import '../lib/transition.js';
