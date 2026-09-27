// Sticky dot stage: six scroll scenes drawn on one canvas (spec §2.1).
// Reduced motion or no 2D context → data-mode="static" and CSS shows the six cards as plain text.
import { loadGlobeAsset } from '../../showcase/globeAsset.js';
import { currentLanguage } from '../content.js';
import { projectXyz } from './projection.js';
import { SCENES, GLOBE_LON, buildDots, globeTargets, globeView, sceneTargets, interpolate } from './layouts.js';

const EXCERPT_MS = 7000;

export function mountStage(host, { snapshot, industry }) {
  if (!host) return () => {};
  const canvas = host.querySelector('canvas');
  const cards = [...host.querySelectorAll('[data-scene]')];
  const legendObs = host.querySelector('[data-scene-legend="obs"]');
  const legendEntity = host.querySelector('[data-scene-legend="entity"]');
  const excerpts = [...host.querySelectorAll('[data-excerpt]')];
  const selectors = [...host.querySelectorAll('[data-excerpt-select]')];
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const ctx2d = canvas?.getContext('2d');

  // S0 thesis carousel: works in both modes; auto-advances only while live and on scene 0.
  let excerpt = 0, timer = 0, pinned = false, active = 0;
  const showExcerpt = (index) => {
    excerpt = index;
    excerpts.forEach((el, i) => { el.hidden = i !== index; });
    selectors.forEach((el, i) => el.setAttribute('aria-pressed', String(i === index)));
  };
  const schedule = () => {
    clearTimeout(timer);
    if (pinned || host.dataset.mode !== 'live' || !excerpts.length) return;
    timer = setTimeout(() => { if (active === 0 && !document.hidden) showExcerpt((excerpt + 1) % excerpts.length); schedule(); }, EXCERPT_MS);
  };
  const onSelect = (event) => {
    const button = event.target.closest('[data-excerpt-select]');
    if (!button || !host.contains(button)) return;
    pinned = true; clearTimeout(timer);
    showExcerpt(Number(button.dataset.excerptSelect));
  };
  host.addEventListener('click', onSelect);

  const dots = buildDots(snapshot);
  const layoutCtx = { dots, snapshot, industry, width: 0, height: 0 };
  let land = null, frames = [], w = 0, h = 0, raf = 0, visible = true, spin = 0, last = 0, io = null;

  const resize = () => {
    const dpr = Math.min(2, devicePixelRatio || 1);
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr; ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    Object.assign(layoutCtx, { width: w, height: h });
    frames = SCENES.map((s) => sceneTargets(s, layoutCtx));
  };
  const progress = () => {
    const r = host.getBoundingClientRect();
    const travel = r.height - innerHeight;
    return Math.max(0, Math.min(SCENES.length - 1, (-r.top / (travel || 1)) * (SCENES.length - 1)));
  };
  const drawLand = (lon0, alpha) => {
    if (!land || alpha <= 0) return;
    const view = globeView(w, h, lon0);
    ctx2d.fillStyle = `rgba(20,20,19,${0.18 * alpha})`;
    const step = w < 900 ? 9 : 3;                        // every 3rd point keeps 60fps on phones
    for (let i = 0; i < land.length; i += step) {
      const p = projectXyz([land[i], land[i + 1], land[i + 2]], view);
      if (p.visible) ctx2d.fillRect(p.x, p.y, 1.2, 1.2);
    }
  };
  const drawLabels = (targets, alpha) => {
    if (alpha <= 0) return;
    const zh = currentLanguage() === 'zh';
    ctx2d.globalAlpha = alpha; ctx2d.fillStyle = '#141413';
    ctx2d.font = '600 13px system-ui, sans-serif'; ctx2d.textBaseline = 'middle';
    for (const q of targets) if (q.labelAnchor) ctx2d.fillText(zh ? q.labelZh : q.label, q.x + q.r + 6, q.y);
    ctx2d.globalAlpha = 1;
  };
  const tick = (now) => {
    raf = requestAnimationFrame(tick);
    if (!visible) return;
    const dt = last ? (now - last) / 1000 : 0; last = now;
    const p = progress();
    const s = Math.floor(p), t = p - s;
    if (p < 1) spin = (spin + dt * 6) % 360;
    ctx2d.clearRect(0, 0, w, h);
    // Scenes 0→1 keep the dots registered on the turning land: both ends are projected at the current longitude.
    const e = t * t * (3 - 2 * t);
    const lon = p < 1 ? GLOBE_LON.open + spin * (1 - e) + (GLOBE_LON.ecosystems - GLOBE_LON.open) * e : GLOBE_LON.ecosystems;
    drawLand(lon, Math.max(0, 1 - Math.max(0, p - 1)));
    const a = s === 0 ? globeTargets('open', layoutCtx, lon) : frames[s];
    const b = s === 0 ? globeTargets('ecosystems', layoutCtx, lon) : frames[Math.min(s + 1, frames.length - 1)];
    for (let i = 0; i < dots.length; i++) {
      const q = interpolate(a[i], b[i], t, i, dots.length);
      if (q.alpha <= 0.01 || q.r <= 0.1) continue;
      ctx2d.globalAlpha = q.alpha; ctx2d.fillStyle = q.color;
      ctx2d.beginPath(); ctx2d.arc(q.x, q.y, q.r, 0, Math.PI * 2); ctx2d.fill();
    }
    ctx2d.globalAlpha = 1;
    drawLabels(frames[SCENES.length - 1], Math.max(0, Math.min(1, (p - 4.5) * 2)));
    const next = Math.round(p);
    if (next !== active) { active = next; if (active === 0) schedule(); }
    cards.forEach((c) => c.toggleAttribute('data-active', Number(c.dataset.scene) === active));
    if (legendObs) legendObs.hidden = active >= 4;
    if (legendEntity) legendEntity.hidden = active < 4;
  };

  const stop = () => {
    cancelAnimationFrame(raf); raf = 0;
    io?.disconnect(); io = null;
    removeEventListener('resize', resize);
    clearTimeout(timer);
  };
  const goStatic = () => {
    stop();
    host.dataset.mode = 'static';
    cards.forEach((c) => c.removeAttribute('data-active'));
  };
  const goLive = () => {
    host.dataset.mode = 'live';
    loadGlobeAsset().then((g) => { land = g.points; }).catch(() => {});
    io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; last = 0; });
    io.observe(host);
    addEventListener('resize', resize);
    resize(); raf = requestAnimationFrame(tick);
    schedule();
  };
  const onMotion = () => (motion.matches || !ctx2d ? goStatic() : goLive());
  motion.addEventListener('change', onMotion);
  onMotion();

  return () => {
    stop();
    motion.removeEventListener('change', onMotion);
    host.removeEventListener('click', onSelect);
  };
}
