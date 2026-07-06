/* ============================================================
   SHARE CARD (V21 Phase 0) — canvas renderer for a downloadable PNG in
   the horoscope page's healing palette (warm cream / sage / terracotta /
   soft gold + botanical sprig). Two card types:
     - 'mine': four-pillar chart card
     - 'syn':  two-person synastry score card
   DOM-coupled render code (canvas), no vitest by site convention — same
   discipline as other pure-visual modules; verified by build + human eye.
   Fonts are the ones the page already loads (Noto Serif SC / IBM Plex Mono).
   ============================================================ */

const C = {
  bg: '#F6EFE3', card: '#FFFBF2', card2: '#F1E7D4',
  text: '#4A453D', dim: '#6B6354', line: 'rgba(74,69,61,.18)',
  sage: '#9CAF88', sageDeep: '#52693D',
  terra: '#C96F4A', terraDeep: '#9C4A2A',
  goldSoft: '#D9B87C', goldDeep: '#7A5E1D',
  el: ['#4A6B3B', '#A2442E', '#7A5E1D', '#636358', '#396383'], // 木火土金水
};
const W = 1080, H = 1350;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Small botanical sprig (stem + pointed leaves + berries), drawn at (x,y)
// with the stem sweeping up-right; scale ~1 = ~260px tall.
function sprig(ctx, x, y, s, mirror) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(mirror ? -s : s, s);
  ctx.strokeStyle = C.sage; ctx.lineWidth = 5 / s; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(-30, -70, -35, -150, 5, -240); ctx.stroke();
  const leaf = (cx, cy, ang, len) => {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang);
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-14, -len * 0.4, -14, -len * 0.75, 0, -len);
    ctx.bezierCurveTo(14, -len * 0.75, 14, -len * 0.4, 0, 0);
    ctx.closePath(); ctx.fillStyle = C.sage; ctx.globalAlpha = 0.85; ctx.fill(); ctx.restore();
    ctx.globalAlpha = 1;
  };
  leaf(-22, -50, -1.1, 62); leaf(-8, -90, 0.9, 58); leaf(-32, -120, -1.2, 56);
  leaf(-12, -160, 0.8, 54); leaf(-24, -195, -1.25, 48); leaf(0, -225, 0.7, 44);
  ctx.fillStyle = C.terra; ctx.globalAlpha = 0.7;
  for (const [bx, by, r] of [[-26, -85, 6], [-18, -170, 5], [-2, -215, 4]]) {
    ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function frame(ctx, titleZh, titleEn, lang) {
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  sprig(ctx, W - 90, 300, 1.15, false);
  sprig(ctx, 95, H - 60, 0.9, true);
  ctx.fillStyle = C.card;
  roundRect(ctx, 70, 90, W - 140, H - 200, 28); ctx.fill();
  ctx.strokeStyle = C.line; ctx.lineWidth = 2; roundRect(ctx, 70, 90, W - 140, H - 200, 28); ctx.stroke();
  // header
  ctx.fillStyle = C.terraDeep;
  ctx.font = '700 26px "Spectral","Noto Serif SC",serif';
  ctx.textAlign = 'center';
  ctx.fillText(lang === 'zh' ? '观 星 台' : 'STAR TERRACE', W / 2, 170);
  ctx.fillStyle = C.text;
  ctx.font = '900 56px "Noto Serif SC",serif';
  ctx.fillText(lang === 'zh' ? titleZh : titleEn, W / 2, 245);
  // footer
  ctx.fillStyle = C.dim;
  ctx.font = '500 24px "Spectral","Noto Serif SC",serif';
  ctx.fillText('feida.au/horoscope.html', W / 2, H - 60);
  ctx.font = '500 20px "Noto Serif SC",serif';
  ctx.fillText(lang === 'zh' ? '仅供娱乐 · 不构成任何建议' : 'Entertainment only · not advice', W / 2, H - 28);
}

// pillars: [{gz, el, label}] — gz is the two-char 干支, el 0-4, label like 年柱.
function drawPillarTiles(ctx, pillars, cx, y, tileW, tileH, gap) {
  const total = pillars.length * tileW + (pillars.length - 1) * gap;
  let x = cx - total / 2;
  for (const p of pillars) {
    ctx.fillStyle = C.card2; roundRect(ctx, x, y, tileW, tileH, 18); ctx.fill();
    ctx.strokeStyle = C.line; ctx.lineWidth = 2; roundRect(ctx, x, y, tileW, tileH, 18); ctx.stroke();
    ctx.fillStyle = C.dim;
    ctx.font = `600 ${Math.round(tileW * 0.14)}px "Noto Serif SC",serif`;
    ctx.textAlign = 'center';
    ctx.fillText(p.label, x + tileW / 2, y + tileH * 0.17);
    ctx.fillStyle = C.el[p.el] || C.text;
    ctx.font = `900 ${Math.round(tileW * 0.42)}px "Noto Serif SC",serif`;
    ctx.fillText(p.gz[0] || '', x + tileW / 2, y + tileH * 0.52);
    ctx.fillText(p.gz[1] || '', x + tileW / 2, y + tileH * 0.86);
    x += tileW + gap;
  }
}

// payload (type 'mine'): { lang, pillars:[{gz,el,label}], chips:[str], dateStr }
// payload (type 'syn'):  { lang, score, a:{h,pillars}, b:{h,pillars}, dateStr }
export function renderShareCard(canvas, type, payload) {
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const lang = payload.lang === 'zh' ? 'zh' : 'en';

  if (type === 'mine') {
    frame(ctx, '我的四柱命盘', 'MY FOUR PILLARS', lang);
    drawPillarTiles(ctx, payload.pillars, W / 2, 330, 190, 420, 24);
    // identity chips
    ctx.fillStyle = C.sageDeep;
    ctx.font = '700 40px "Noto Serif SC",serif';
    ctx.textAlign = 'center';
    ctx.fillText(payload.chips.join('　·　'), W / 2, 850);
    if (payload.dateStr) {
      ctx.fillStyle = C.dim;
      ctx.font = '500 30px "IBM Plex Mono",monospace';
      ctx.fillText(payload.dateStr, W / 2, 910);
    }
    ctx.fillStyle = C.text;
    ctx.font = '400 30px "Noto Serif SC",serif';
    ctx.fillText(lang === 'zh' ? '扫历法而出，非随机数。' : 'Cast from the real sexagenary calendar.', W / 2, 990);
  } else {
    frame(ctx, '双人合盘', 'SYNASTRY', lang);
    drawPillarTiles(ctx, payload.a.pillars, W / 2, 310, 120, 260, 14);
    drawPillarTiles(ctx, payload.b.pillars, W / 2, 830, 120, 260, 14);
    ctx.fillStyle = C.dim;
    ctx.font = '600 26px "Noto Serif SC",serif';
    ctx.textAlign = 'center';
    ctx.fillText(payload.a.h, W / 2 - 380, 340);
    ctx.fillText(payload.b.h, W / 2 - 380, 860);
    // score ring between the two chart rows
    const cy = 700, r = 88;
    ctx.beginPath(); ctx.arc(W / 2, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(74,69,61,.12)'; ctx.lineWidth = 14; ctx.stroke();
    ctx.beginPath(); ctx.arc(W / 2, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (payload.score / 100));
    ctx.strokeStyle = C.terra; ctx.lineCap = 'round'; ctx.stroke();
    ctx.fillStyle = C.text;
    ctx.font = '900 76px "IBM Plex Mono",monospace';
    ctx.fillText(String(payload.score), W / 2, cy + 26);
    ctx.fillStyle = C.dim;
    ctx.font = '600 22px "Spectral",serif';
    ctx.fillText(lang === 'zh' ? '底盘缘分' : 'BASE BOND', W / 2, cy + 60);
  }
}

// Trigger a PNG download of the rendered card.
export function downloadShareCard(type, payload, filename) {
  const canvas = document.createElement('canvas');
  renderShareCard(canvas, type, payload);
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, 'image/png');
}
