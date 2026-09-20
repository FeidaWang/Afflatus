/**
 * Novels page shared-lib load order, as a single ES module entry
 * (see homeLibs.js for why this pattern replaces individual script tags).
 * Order matches the original <script> tag order exactly.
 */
import '../lib/nav.js';
import '../lib/transition.js';
import { createPagedBook } from '../lib/pagedBook.js';
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
  createPagedBook,
  createReaderStore,
  createStorageAdapter,
  parseReaderPath,
  readerLocale,
  readerPath,
});

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
window.dispatchEvent(new CustomEvent('afflatus-serial-ready'));

// The backdrop is decorative. Keep it out of the reader's first-paint and
// first-input budget; hydrate it after engagement or a long idle dwell.
let backdropLoading = false;
let backdropHandle = null;
let backdropTimer = 0;
let backdropEngaged = false;

async function startBackdrop() {
  backdropEngaged = true;
  if (backdropLoading || backdropHandle || document.body.classList.contains('reading-focused')) return;
  backdropLoading = true;
  clearTimeout(backdropTimer);
  removeEventListener('pointerdown', startBackdrop, true);
  removeEventListener('keydown', startBackdrop, true);
  try {
    const { mountSerialBackdrop } = await import('../ui/ambientBackdrops.js');
    if (!document.body.classList.contains('reading-focused')) backdropHandle = mountSerialBackdrop();
  } catch {}
  finally { backdropLoading = false; }
}

addEventListener('pointerdown', startBackdrop, { capture: true, passive: true, once: true });
addEventListener('keydown', startBackdrop, { capture: true, once: true });
backdropTimer = setTimeout(startBackdrop, 15_000);

const readerObserver = new IntersectionObserver(([entry]) => {
  document.body.classList.toggle('reading-focused', entry.isIntersecting);
  if (entry.isIntersecting) {
    backdropHandle?.destroy?.();
    backdropHandle = null;
  } else if (backdropEngaged) startBackdrop();
});
readerObserver.observe(document.getElementById('reader'));

addEventListener('pagehide', () => {
  clearTimeout(backdropTimer);
  backdropHandle?.destroy?.();
}, { once: true });
