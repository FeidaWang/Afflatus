/**
 * Shared count-up animation primitives (ROADMAP §0b A3).
 *
 * Previously this exact "ease from 0 to a target number over N ms" logic was
 * implemented twice: inline in sectors.html (parses the number already in
 * the DOM, runs once on first paint) and as animateCounter/animatePick in
 * marketDeck.js (reads data-counter attributes, runs when scrolled into
 * view via IntersectionObserver). Both used the same cubic ease-out shape
 * (1 - (1-t)^3, i.e. utils/math.js's `easeOut`) - only the trigger and the
 * data source differed. This module keeps the one real tween (`animateCountUp`)
 * and offers the two data-source conventions as thin wrappers so callers
 * don't have to hand-roll the rAF loop again for the next page that needs it.
 */
import { clamp, easeOut } from '../utils/math.js';

/**
 * Tween a numeric value from 0 to `target` and report it every frame.
 * @param {HTMLElement|null} el - element to write `el.textContent` into (skip if you pass onFrame)
 * @param {number} target - final numeric value
 * @param {object} [opts]
 * @param {string} [opts.suffix=''] - text appended after the formatted number (only used with the default textContent writer)
 * @param {number} [opts.duration=900] - tween length in ms
 * @param {(v:number)=>string} [opts.format] - formats the live value into text; defaults to "round if the target is a whole number, else 1 decimal place" (sectors.html's original behaviour)
 * @param {(v:number,p:number)=>void} [opts.onFrame] - called every frame with the live value + eased progress (0..1) instead of writing to `el` - use this for custom targets like a bar width or a specific child text node
 */
export function animateCountUp(el, target, opts = {}) {
  const {
    suffix = '',
    duration = 900,
    format = v => (target % 1 === 0 ? String(Math.round(v)) : v.toFixed(1)),
    onFrame,
  } = opts;

  const write = v => {
    if (onFrame) onFrame(v, v / (target || 1));
    else if (el) el.textContent = format(v) + suffix;
  };

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    write(target);
    return;
  }

  const start = performance.now();
  function tick(now) {
    const t = clamp((now - start) / duration, 0, 1);
    const p = easeOut(t);
    write(target * p);
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

/** Read the number already sitting in `el.textContent` (e.g. a hardcoded
 *  "24%" in the HTML) and count up to it, preserving whatever suffix follows
 *  the number. This is sectors.html's `.countup` convention - the final
 *  value lives in the markup so the page still reads correctly with JS off. */
export function animateCountUpFromText(el, opts = {}) {
  const m = (el.textContent || '').match(/(-?\d+(?:\.\d+)?)/);
  if (!m) return;
  const target = parseFloat(m[1]);
  const suffix = el.textContent.replace(m[1], '').trim();
  animateCountUp(el, target, { duration: 900, ...opts, suffix: opts.suffix ?? suffix });
}

/** Wire every element matching `selector` (default `.countup`) to count up
 *  once on first paint - runs immediately if the DOM is already parsed,
 *  otherwise waits for DOMContentLoaded. No-ops under prefers-reduced-motion. */
export function runCountUpOnLoad(selector = '.countup') {
  function run() {
    document.querySelectorAll(selector).forEach(el => animateCountUpFromText(el));
  }
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (document.readyState !== 'loading') run();
  else document.addEventListener('DOMContentLoaded', run);
}
