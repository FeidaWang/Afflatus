/* ============================================================
   SCROLL REVEAL VIEW — DOM half of the anthropic.com-style scroll-linked
   card reveal (urgent.md Part 2 §9). Physics lives in scrollReveal.js (pure,
   vitest-covered); this file only touches the DOM: element discovery,
   sizing, the shared rAF loop, and paint-only clip-path writes (design.md
   宪章③ — transform/opacity/paint only, damped chase, never a linear tween,
   never a teleport).

   Applied to exactly three selectors per urgent.md §9.4 — .heroCard,
   .graphWrap, .band — nothing else. sectors.html-only (not part of the
   shared sectorsLibs.js bundle other pages also load).
   ============================================================ */
import { revealProgress, chase, easeOutQuad, revealClipPath, revealClipPathX } from './scrollReveal.js';

const EPS = 0.001;

export function initScrollReveal() {
  // §9.6: no clip-path support -> render everything normally, no animation attempted.
  if (typeof CSS === 'undefined' || !CSS.supports || !CSS.supports('clip-path', 'inset(0px round 0px)')) return;

  const targets = [];
  document.querySelectorAll('.heroCard, .graphWrap').forEach((el) => targets.push({ el, kind: 'card', rendered: 0, target: 0, tracking: false }));
  document.querySelectorAll('.band').forEach((el) => targets.push({ el, kind: 'x', rendered: 0, target: 0, tracking: false }));
  if (!targets.length) return;

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function apply(t) {
    const e = easeOutQuad(t.rendered);
    const w = t.el.getBoundingClientRect().width || 1;
    t.el.style.clipPath = t.kind === 'x' ? revealClipPathX(e, w) : revealClipPath(e, w);
  }

  // Start every target in the "collapsed" pre-reveal state, THEN either
  // freeze it open (reduced motion, §9.6) or let the loop chase it open as
  // it scrolls into the trigger window.
  targets.forEach((t) => { t.rendered = reduce ? 1 : 0; apply(t); });
  if (reduce) return;

  let running = false, raf = 0, lastT = 0;
  function loop(now) {
    const dt = lastT ? Math.min(0.05, (now - lastT) / 1000) : 0;
    lastT = now;
    let anyActive = false;
    for (const t of targets) {
      if (!t.tracking) continue;
      const r = t.el.getBoundingClientRect();
      t.target = revealProgress(r.top, r.height, innerHeight);
      t.rendered = chase(t.rendered, t.target, dt);
      apply(t);
      if (Math.abs(t.target - t.rendered) > EPS) anyActive = true;
    }
    if (anyActive) { raf = requestAnimationFrame(loop); }
    else { running = false; lastT = 0; }
  }
  function start() { if (!running) { running = true; raf = requestAnimationFrame(loop); } }

  // IO gates which targets are even worth recomputing (§9.5 "sleeps when no
  // tracked section is in its trigger window") with a generous margin so the
  // chase starts a little before the element is strictly on-screen. Actual
  // per-scroll updates come from the scroll listener below — IO's own
  // isIntersecting only toggles on threshold crossings, too coarse to drive
  // a smooth scrub by itself.
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const t = targets.find((x) => x.el === entry.target);
      if (!t) return;
      t.tracking = entry.isIntersecting;
      if (entry.isIntersecting) start();
    });
  }, { threshold: [0, 1], rootMargin: '20% 0px 20% 0px' });
  targets.forEach((t) => io.observe(t.el));

  addEventListener('scroll', () => { if (targets.some((t) => t.tracking)) start(); }, { passive: true });
  addEventListener('resize', () => { targets.forEach(apply); }, { passive: true });
}
