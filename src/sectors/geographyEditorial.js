import { loadGlobeAsset } from '../showcase/globeAsset.js';

const REGIONS = [
  { id: 'US', en: 'United States', zh: '美国', longitude: -98, latitude: 39, color: '#80aa31' },
  { id: 'CN', en: 'China', zh: '中国', longitude: 104, latitude: 35, color: '#658f9a' },
];

export function mountGeographyEditorial(root, snapshot, language) {
  if (!root || !snapshot) return { destroy() {}, setLanguage() {} };
  const canvas = root.querySelector('#geographyMap');
  const wrap = root.querySelector('.geographyMapWrap');
  const regionName = root.querySelector('#geographyRegionName');
  const detail = root.querySelector('#geographyRegionDetail');
  const context = canvas.getContext('2d');
  const tooltip = document.createElement('output');
  tooltip.className = 'geographyTooltip';
  tooltip.hidden = true;
  wrap.append(tooltip);
  const scoreByModel = new Map(snapshot.observations
    .filter((row) => row.metric_id === 'intelligence' && row.evidence_status === 'reported_snapshot' && Number.isFinite(row.value))
    .map((row) => [row.model_id, row.value]));
  const selected = snapshot.models.filter((model) => model.status === 'reported_snapshot' && scoreByModel.has(model.id));
  let land = null;
  let index = 0;
  let lang = language;
  let zoom = 1;
  let offsetX = 0;
  let offsetY = 0;
  let size = { width: 0, height: 0 };
  let raf = 0;
  let destroyed = false;
  let drag = null;
  const tr = (en, zh) => lang === 'zh' ? zh : en;
  const modelsFor = (id) => selected.filter((model) => model.lab_geography === id);
  const median = (list) => {
    const values = list.map((model) => scoreByModel.get(model.id)).sort((a, b) => a - b);
    return values.length ? (values[Math.floor((values.length - 1) / 2)] + values[Math.floor(values.length / 2)]) / 2 : null;
  };

  function draw() {
    raf = 0;
    if (destroyed || !context) return;
    const { width, height } = size;
    if (!width || !height) return;
    context.clearRect(0, 0, width, height);
    context.fillStyle = '#eae9e1';
    context.fillRect(0, 0, width, height);
    context.save();
    context.translate(width / 2 + offsetX, height / 2 + offsetY);
    context.scale(zoom, zoom);
    context.translate(-width / 2, -height / 2);
    context.strokeStyle = '#d0d1c8';
    context.lineWidth = 1 / zoom;
    for (let lon = -150; lon <= 150; lon += 30) {
      const x = (lon + 180) / 360 * width;
      context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke();
    }
    for (let lat = -60; lat <= 60; lat += 30) {
      const y = (90 - lat) / 180 * height;
      context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke();
    }
    if (land?.points) {
      context.fillStyle = '#8d978f';
      for (let i = 0; i < land.points.length; i += 3) {
        const x = land.points[i], y = land.points[i + 1], z = land.points[i + 2];
        const longitude = Math.atan2(x, z);
        const latitude = Math.asin(Math.max(-1, Math.min(1, y / Math.hypot(x, y, z))));
        context.globalAlpha = .34;
        context.fillRect((longitude / Math.PI + 1) * width / 2, (.5 - latitude / Math.PI) * height, 1.1 / zoom, 1.1 / zoom);
      }
      context.globalAlpha = 1;
    }
    REGIONS.forEach((region, position) => {
      const count = modelsFor(region.id).length;
      const x = (region.longitude + 180) / 360 * width;
      const y = (90 - region.latitude) / 180 * height;
      const radius = 13 + count * 1.5;
      context.beginPath(); context.arc(x, y, radius, 0, Math.PI * 2);
      context.fillStyle = region.color + (position === index ? 'dd' : 'aa'); context.fill();
      context.lineWidth = (position === index ? 3 : 1.5) / zoom;
      context.strokeStyle = '#172018'; context.stroke();
      context.fillStyle = '#142015'; context.font = `700 ${Math.max(11, 13 / zoom)}px system-ui`;
      context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(String(count), x, y);
      context.font = `600 ${Math.max(10, 12 / zoom)}px system-ui`;
      context.fillText(region[lang], x, y + radius + 20 / zoom);
    });
    context.restore();
  }
  function schedule() { if (!raf && !destroyed) raf = requestAnimationFrame(draw); }
  function resize() {
    const rect = canvas.getBoundingClientRect();
    const pixelRatio = Math.min(devicePixelRatio || 1, 2);
    size = { width: Math.round(rect.width), height: Math.round(rect.height) };
    canvas.width = Math.round(size.width * pixelRatio);
    canvas.height = Math.round(size.height * pixelRatio);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    schedule();
  }
  function screenPoint(region) {
    const baseX = (region.longitude + 180) / 360 * size.width;
    const baseY = (90 - region.latitude) / 180 * size.height;
    return {
      x: size.width / 2 + offsetX + (baseX - size.width / 2) * zoom,
      y: size.height / 2 + offsetY + (baseY - size.height / 2) * zoom,
    };
  }
  function targetAt(event) {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left, y = event.clientY - rect.top;
    return REGIONS.findIndex((region) => {
      const point = screenPoint(region);
      return Math.hypot(point.x - x, point.y - y) < (13 + modelsFor(region.id).length * 1.5) * zoom + 8;
    });
  }
  function renderRegion() {
    const region = REGIONS[index];
    const models = modelsFor(region.id);
    const score = median(models);
    regionName.textContent = region[lang];
    detail.replaceChildren();
    const heading = document.createElement('h3');
    heading.textContent = region[lang];
    const count = document.createElement('p');
    count.className = 'geographyBigNumber';
    count.textContent = `${models.length} ${tr('selected configurations', '项选定配置')}`;
    const summary = document.createElement('p');
    summary.textContent = `${models.filter((model) => model.open_weights).length} ${tr('open-weight configurations', '项开放权重配置')} · ${tr('median overall index', '综合指数中位数')} ${score ?? '—'}`;
    const list = document.createElement('ul');
    models.sort((a, b) => scoreByModel.get(b.id) - scoreByModel.get(a.id)).forEach((model) => {
      const item = document.createElement('li');
      item.textContent = `${model.name} · ${scoreByModel.get(model.id)}`;
      list.append(item);
    });
    detail.append(heading, count, summary, list);
    schedule();
  }
  function select(position) { index = (position + REGIONS.length) % REGIONS.length; renderRegion(); }
  function zoomTo(next) { zoom = Math.max(1, Math.min(3, next)); schedule(); }
  function onPointerDown(event) { drag = { x: event.clientX, y: event.clientY, ox: offsetX, oy: offsetY, moved: false }; canvas.setPointerCapture(event.pointerId); }
  function onPointerMove(event) {
    if (drag) {
      const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
      if (Math.hypot(dx, dy) > 4) drag.moved = true;
      offsetX = Math.max(-size.width * zoom / 2, Math.min(size.width * zoom / 2, drag.ox + dx));
      offsetY = Math.max(-size.height * zoom / 2, Math.min(size.height * zoom / 2, drag.oy + dy));
      schedule();
    }
    const hovered = targetAt(event);
    if (hovered < 0) { tooltip.hidden = true; canvas.style.cursor = drag ? 'grabbing' : 'grab'; return; }
    const region = REGIONS[hovered];
    tooltip.hidden = false;
    tooltip.textContent = `${region[lang]} · ${modelsFor(region.id).length} ${tr('selected models', '项选定模型')}`;
    tooltip.style.left = `${event.clientX - canvas.getBoundingClientRect().left + 15}px`;
    tooltip.style.top = `${event.clientY - canvas.getBoundingClientRect().top + 15}px`;
    canvas.style.cursor = 'pointer';
  }
  function onPointerUp(event) { if (drag && !drag.moved) { const hovered = targetAt(event); if (hovered >= 0) select(hovered); } drag = null; }
  function onPointerCancel() { drag = null; tooltip.hidden = true; }
  function onPointerLeave() { tooltip.hidden = true; }
  const next = () => select(index + 1);
  const previous = () => select(index - 1);
  const plus = () => zoomTo(zoom * 1.4);
  const minus = () => zoomTo(zoom / 1.4);
  const reset = () => { zoom = 1; offsetX = 0; offsetY = 0; schedule(); };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerCancel);
  canvas.addEventListener('pointerleave', onPointerLeave);
  root.querySelector('#geographyNext').addEventListener('click', next);
  root.querySelector('#geographyPrevious').addEventListener('click', previous);
  root.querySelector('#geographyZoomIn').addEventListener('click', plus);
  root.querySelector('#geographyZoomOut').addEventListener('click', minus);
  root.querySelector('#geographyZoomReset').addEventListener('click', reset);
  loadGlobeAsset().then((value) => { if (!destroyed) { land = value; schedule(); } }).catch(() => {
    if (!destroyed) root.querySelector('.geographyMapHint').textContent = tr('Map detail unavailable; region counts remain below.', '地图细节暂不可用；下方地区数据仍可阅读。');
  });
  renderRegion();
  return {
    setLanguage(nextLanguage) { lang = nextLanguage; renderRegion(); },
    destroy() {
      destroyed = true; cancelAnimationFrame(raf); resizeObserver.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerCancel);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      root.querySelector('#geographyNext').removeEventListener('click', next);
      root.querySelector('#geographyPrevious').removeEventListener('click', previous);
      root.querySelector('#geographyZoomIn').removeEventListener('click', plus);
      root.querySelector('#geographyZoomOut').removeEventListener('click', minus);
      root.querySelector('#geographyZoomReset').removeEventListener('click', reset);
      tooltip.remove();
    },
  };
}
