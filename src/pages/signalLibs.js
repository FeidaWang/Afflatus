/**
 * Signal page shared-lib load order, as a single ES module entry
 * (see homeLibs.js for why this pattern replaces individual script tags).
 * Order matches the original <script> tag order exactly.
 */
import '../lib/i18n.js';
import '../lib/nav.js';
import '../lib/audio.js';
import '../lib/transition.js';
import { mountSignalBackdrop } from '../ui/ambientBackdrops.js';
import { mountTreasuryYieldMonitor } from '../lib/treasuryYieldMonitor.js';

mountSignalBackdrop();
mountTreasuryYieldMonitor();
