// Static final frame of each stage scene, for reduced motion (spec §3.4, §4.1): the same
// layouts.js targets the canvas animates to, drawn once as inline SVG.
import { globeView, sceneTargets } from './layouts.js';

const W = 640, H = 720;                    // phone-shaped layout: the plot sits in the 12–50% band
const VIEW = `0 ${H * 0.08} ${W} ${H * 0.46}`;

export function staticFrameSvg(scene, { dots, snapshot, industry }, lang = 'en') {
  const targets = sceneTargets(scene, { dots, snapshot, industry, width: W, height: H });
  const disc = scene === 'open' || scene === 'ecosystems'
    ? (({ cx, cy, radius }) => `<circle class="frame-disc" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${radius.toFixed(1)}"/>`)(globeView(W, H, 0))
    : '';
  const circles = targets.filter((q) => q.alpha > 0.01 && q.r > 0.1)
    .map((q) => `<circle class="dot" cx="${q.x.toFixed(1)}" cy="${q.y.toFixed(1)}" r="${q.r}" fill="${q.color}"${q.alpha < 1 ? ` fill-opacity="${q.alpha.toFixed(2)}"` : ''}/>`).join('');
  const labels = targets.filter((q) => q.labelAnchor)
    .map((q) => `<text x="${(q.x + q.r + 6).toFixed(1)}" y="${q.y.toFixed(1)}" dy="4">${lang === 'zh' ? q.labelZh : q.label}</text>`).join('');
  return `<svg class="stage-frame" viewBox="${VIEW}" aria-hidden="true" focusable="false">${disc}${circles}${labels}</svg>`;
}
