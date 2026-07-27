/**
 * Novels page shared-lib load order, as a single ES module entry
 * (see homeLibs.js for why this pattern replaces individual script tags).
 * Order matches the original <script> tag order exactly.
 */
import '../lib/i18n.js';
import '../lib/nav.js';
import '../lib/transition.js';
import { mountSerialBackdrop } from '../ui/ambientBackdrops.js';
import {
  createReaderStore,
  createStorageAdapter,
} from '../lib/readerStore.js';
import {
  chapterIdEquals,
  parseReaderPath,
  readerLocale,
  readerPath,
} from '../lib/serialRoutes.js';
/* U16a: page-turn.js no longer imported — serial.html removed its edge
   arrows and opts out of prev/next turns via body[data-no-page-turn]. */

window.AfflatusSerial = Object.freeze({
  chapterIdEquals,
  createReaderStore,
  createStorageAdapter,
  parseReaderPath,
  readerLocale,
  readerPath,
});
window.dispatchEvent(new CustomEvent('afflatus-serial-ready'));

// The backdrop is decorative. Register the reader API first so a WebGL or
// render-budget failure can never prevent chapters, controls, or audio from
// initializing.
try {
  mountSerialBackdrop();
} catch {}
