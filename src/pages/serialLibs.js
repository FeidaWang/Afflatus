/**
 * Novels page entry: shared site libs, then the reader controller
 * (see homeLibs.js for why this pattern replaces individual script tags).
 */
import '../lib/nav.js';
import '../lib/transition.js';
import { mountSerialReader } from './serialReader.js';
/* U16a: page-turn.js no longer imported — serial.html removed its edge
   arrows and opts out of prev/next turns via body[data-no-page-turn]. */

// This route is intentionally Chinese-only. nav.js still emits its shared
// bilingual data attributes, so select the Chinese labels locally without
// persisting or changing the visitor's language preference elsewhere.
document.documentElement.lang = 'zh-CN';
document.querySelectorAll('[data-zh]').forEach((node) => {
  const value = node.getAttribute('data-zh');
  if (value != null) node.textContent = value;
});
document.querySelectorAll('[data-aria-zh]').forEach((node) => {
  node.setAttribute('aria-label', node.getAttribute('data-aria-zh'));
});
mountSerialReader();
