// src/sectors/industry/globe-view.js
import { loadGlobeAsset } from '../../showcase/globeAsset.js';
import { projectXyz } from '../stage/projection.js';
import { clusterMarkers, companyMarkers } from './globe-layout.js';
import { LAYERS, LAYER_LABEL } from './industry-core.js';
import { escapeHtml, translate } from '../content.js';

const RING = { US: 'var(--us)', CN: 'var(--cn)' };
const byId = (list) => Object.fromEntries(list.map((x) => [x.id, x]));

// Which asset to draw for a company's logo (controller ruling 1): prefer the
// cropped/recoloured web_file; fall back to the original official file, and
// when that fallback is a dark-background asset, flag it for an ink chip.
function logoAsset(c, manifest) {
  const m = manifest[c.id];
  const initials = escapeHtml((c.ticker ?? c.name.en).slice(0, 2));
  const brand = m?.brand_color ?? null;
  if (m?.web_file) return { src: m.web_file, chip: false, initials, brand };
  if (m?.file) return { src: m.file, chip: m.background === 'dark', initials, brand };
  return { src: null, chip: false, initials, brand };
}

export function mountCompanyGlobe(host, { industry, manifest, lang }) {
  if (!host) return () => {};
  const t = (v) => (lang === 'zh' ? v.zh : v.en);
  const companies = byId(industry.companies);
  const svg = host.querySelector('svg.globe');
  const list = host.querySelector('.globe-list');
  const cards = host.querySelector('.layer-cards');
  let view = { lat0: 30, lon0: -100, radius: 300, cx: 320, cy: 320 };
  let layer = null, land = [], drag = null;

  // HTML logo (layer cards, company list): plain <img> carrying its own
  // fallback data so the delegated error listener below can replace it.
  function htmlLogo(c, size = 20) {
    const asset = logoAsset(c, manifest);
    if (!asset.src) {
      return `<b class="logo-fallback" style="--brand:${asset.brand ?? 'var(--ink)'};width:${size}px;height:${size}px">${asset.initials}</b>`;
    }
    const img = `<img src="${asset.src}" alt="" width="${size}" height="${size}" loading="lazy" data-fallback="${asset.initials}" data-brand="${asset.brand ?? ''}">`;
    return asset.chip ? `<span class="logo-chip" style="width:${size}px;height:${size}px">${img}</span>` : img;
  }

  // SVG logo (a lone company marker): an <image> with the same fallback data.
  function svgLogo(c, r) {
    const asset = logoAsset(c, manifest);
    const size = r * 1.24, half = size / 2;
    if (!asset.src) return `<text dy="4">${asset.initials}</text>`;
    const chip = asset.chip ? `<circle r="${half}" class="logo-chip-bg"/>` : '';
    return `${chip}<image href="${asset.src}" x="${-half}" y="${-half}" width="${size}" height="${size}" data-fallback="${asset.initials}"/>`;
  }

  // Numbered layer cards 01–08 (81k category cards)
  cards.innerHTML = LAYERS.map((id, i) => {
    const members = industry.companies.filter((c) => c.layer === id);
    const top = members.filter((c) => c.tier === 1).slice(0, 4);
    return `<li><button type="button" data-layer="${id}" aria-pressed="false">
      <span class="layer-no">${String(i + 1).padStart(2, '0')}</span>
      <strong>${escapeHtml(t(LAYER_LABEL[id]))}</strong>
      <span class="layer-count">${translate(`${members.length} companies`, `${members.length} 家公司`, lang)}</span>
      <span class="layer-logos">${top.map((c) => htmlLogo(c)).join('')}</span></button></li>`;
  }).join('');

  function draw() {
    const clusters = clusterMarkers(companyMarkers(industry.companies, view, { layer }));
    const dots = [];
    for (let i = 0; i < land.length; i += 9) {
      const p = projectXyz([land[i], land[i + 1], land[i + 2]], view);
      if (p.visible) dots.push(`M${p.x.toFixed(1)} ${p.y.toFixed(1)}h1.2`);
    }
    svg.innerHTML = `<circle cx="${view.cx}" cy="${view.cy}" r="${view.radius}" class="globe-disc"/>
      <path d="${dots.join('')}" class="globe-land"/>
      ${clusters.map((k) => {
        const c = companies[k.ids[0]];
        // A bubble is hollow (not US-listed) only when none of its members is listed.
        const listed = k.ids.some((id) => ['listed', 'adr'].includes(companies[id].listing));
        const label = k.ids.length > 1
          ? translate(`${k.ids.length} companies near ${c.hq.city.en}`, `${c.hq.city.zh}附近 ${k.ids.length} 家公司`, lang)
          : t(c.name);
        return `<g class="marker${listed ? '' : ' is-unlisted'}" tabindex="0" role="button" data-ids="${k.ids.join(',')}" aria-label="${escapeHtml(label)}" transform="translate(${k.x.toFixed(1)} ${k.y.toFixed(1)})">
          <circle r="${k.r}" style="stroke:${RING[c.country] ?? 'var(--other)'}"/>
          ${k.ids.length > 1 ? `<text dy="4">${k.ids.length}</text>` : svgLogo(c, k.r)}
        </g>`;
      }).join('')}`;
  }

  function show(ids) {
    list.innerHTML = ids.map((id) => {
      const c = companies[id];
      return `<li>${htmlLogo(c, 28)}<div><strong>${escapeHtml(t(c.name))}</strong>
        <span>${escapeHtml(c.ticker ? `${c.exchange}: ${c.ticker}` : translate('Not US-listed', '未在美上市', lang))} · ${escapeHtml(t(c.hq.city))}</span>
        <span>${escapeHtml(t(LAYER_LABEL[c.layer]))} · ${translate(`Tier ${c.tier}`, `${c.tier} 级`, lang)}</span>
        <p>${escapeHtml(t(c.role))}</p></div></li>`;
    }).join('');
  }

  const onPick = (e) => { const g = e.target.closest('[data-ids]'); if (g) show(g.dataset.ids.split(',')); };
  const onKey = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(e); } };
  const onLayer = (e) => {
    const b = e.target.closest('[data-layer]'); if (!b) return;
    layer = layer === b.dataset.layer ? null : b.dataset.layer;
    cards.querySelectorAll('[data-layer]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.layer === layer)));
    draw();
  };
  // Capture the pointer only once it has moved: capturing on pointerdown would
  // retarget the following click to the <svg>, so a plain click on a marker
  // would never reach onPick.
  const onDown = (e) => { drag = { x: e.clientX, y: e.clientY, lon0: view.lon0, lat0: view.lat0, moved: false }; };
  const onMove = (e) => {
    if (!drag) return;
    if (!drag.moved) {
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 4) return;
      drag.moved = true;
      svg.setPointerCapture(e.pointerId);
    }
    view = { ...view, lon0: drag.lon0 - (e.clientX - drag.x) * 0.3, lat0: Math.max(-60, Math.min(70, drag.lat0 + (e.clientY - drag.y) * 0.3)) }; draw(); };
  const onUp = () => { drag = null; };
  const presets = [...host.querySelectorAll('[data-view]')];
  const onPreset = (e) => { const [lat0, lon0] = e.currentTarget.dataset.view.split(',').map(Number); view = { ...view, lat0, lon0 }; draw(); };

  // Logo failure fallback (controller ruling 2): one delegated, capture-phase
  // `error` listener on the host catches both a failed HTML <img> (list and
  // layer-card logos) and a failed SVG <image> (marker logos) — `error`
  // events do not bubble, but capture-phase listening still sees them on the
  // way down to the target. Each replacement keeps a fixed size so the
  // surrounding layout does not collapse.
  const onAssetError = (e) => {
    const el = e.target;
    if (el instanceof HTMLImageElement && el.dataset.fallback !== undefined) {
      const b = document.createElement('b');
      b.className = 'logo-fallback';
      b.textContent = el.dataset.fallback;
      b.style.setProperty('--brand', el.dataset.brand || 'var(--ink)');
      b.style.width = `${el.width}px`;
      b.style.height = `${el.height}px`;
      el.replaceWith(b);
    } else if (el instanceof SVGImageElement && el.dataset.fallback !== undefined) {
      const monogram = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      monogram.setAttribute('dy', '4');
      monogram.textContent = el.dataset.fallback;
      el.replaceWith(monogram);
    }
  };

  svg.addEventListener('click', onPick); svg.addEventListener('keydown', onKey);
  svg.addEventListener('pointerdown', onDown); svg.addEventListener('pointermove', onMove); svg.addEventListener('pointerup', onUp);
  cards.addEventListener('click', onLayer);
  presets.forEach((b) => b.addEventListener('click', onPreset));
  host.addEventListener('error', onAssetError, true);
  loadGlobeAsset().then((g) => { land = g.points; draw(); }).catch(() => draw());
  draw(); show(industry.companies.filter((c) => c.tier === 1).map((c) => c.id));

  return () => {
    svg.removeEventListener('click', onPick); svg.removeEventListener('keydown', onKey);
    svg.removeEventListener('pointerdown', onDown); svg.removeEventListener('pointermove', onMove); svg.removeEventListener('pointerup', onUp);
    cards.removeEventListener('click', onLayer);
    presets.forEach((b) => b.removeEventListener('click', onPreset));
    host.removeEventListener('error', onAssetError, true);
  };
}
