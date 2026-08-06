/**
 * Course page entry — single ES module import chain (one explicit entry per
 * page; Vite silently drops code from multiple independent module scripts —
 * see homeLibs.js / horoscopeEntry.js for the same note). nav.js MUST run
 * before the shared transition layer.
 */
import './course.js';
import '../lib/i18n.js';
import '../lib/nav.js';
import '../lib/audio.js';
import '../lib/transition.js';
