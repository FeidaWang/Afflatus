/**
 * Signal page shared-lib load order, as a single ES module entry
 * (see homeLibs.js for why this pattern replaces individual script tags).
 * Mount the policy research collection and the existing live yield monitor.
 */
import '../lib/i18n.js';
import '../lib/nav.js';
import '../lib/audio.js';
import '../lib/transition.js';
import { mountTreasuryYieldMonitor } from '../lib/treasuryYieldMonitor.js';
import { mountPolicyIndex } from './signalIndex.js';

mountPolicyIndex();
mountTreasuryYieldMonitor();
