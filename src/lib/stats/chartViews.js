import {
  calibrationBins,
  cumulativeSeries,
  formatPercent,
  thresholdSummary,
} from './statistics.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

export const STATS_PALETTE = Object.freeze({
  green: '#57c98a',
  red: '#e0596b',
  gold: '#e8ad6f',
  teal: '#4fd6c4',
  dim: '#8fa3b8',
  axis: 'rgba(220,232,242,.28)',
  grid: 'rgba(220,232,242,.07)',
});

function svgElement(tag, attributes = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value));
  return node;
}

function makeAction(node, label, action) {
  node.setAttribute('role', 'button');
  node.setAttribute('tabindex', '0');
  node.setAttribute('aria-label', label);
  node.addEventListener('click', action);
  node.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    action();
  });
}

export function renderOutcomeBars(container, records, options) {
  const {
    ariaLabel,
    itemLabel,
    actionLabel,
    onActivate,
    onPointerMove,
    onPointerLeave,
    reducedMotion = false,
    palette = STATS_PALETTE,
  } = options;
  const width = 720;
  const height = 240;
  const left = 34;
  const bottom = 46;
  const barWidth = (width - left - 10) / Math.max(records.length, 1);
  const baseY = height - bottom;
  const svg = svgElement('svg', {
    viewBox: `0 0 ${width} ${height}`,
    role: 'group',
    'aria-label': ariaLabel,
  });

  for (const tick of [0, 1]) {
    const y = baseY - tick * (height - bottom - 14);
    svg.append(
      svgElement('line', { x1: left, y1: y, x2: width - 6, y2: y, stroke: tick ? palette.grid : palette.axis }),
      Object.assign(svgElement('text', {
        x: 4, y: y + 4, fill: palette.dim, 'font-size': 10, 'font-family': 'monospace',
      }), { textContent: `${tick * 100}%` }),
    );
  }

  records.forEach((record, index) => {
    const targetHeight = record.conf * (height - bottom - 14);
    const x = left + index * barWidth + barWidth * 0.18;
    const bar = svgElement('rect', {
      x,
      width: barWidth * 0.64,
      rx: 1.5,
      fill: record.ok ? palette.green : palette.red,
      'fill-opacity': 0.9,
      class: 'bar-hit',
      y: reducedMotion ? baseY - targetHeight : baseY,
      height: reducedMotion ? targetHeight : 0,
    });
    makeAction(bar, actionLabel(record), () => onActivate(record));
    if (onPointerMove) bar.addEventListener('mousemove', (event) => onPointerMove(record, event));
    if (onPointerLeave) bar.addEventListener('mouseleave', onPointerLeave);
    svg.appendChild(bar);

    if (!reducedMotion) {
      window.setTimeout(() => {
        const startedAt = performance.now();
        const frame = (time) => {
          const progress = Math.max(0, Math.min(1, (time - startedAt) / 700));
          const eased = 1 - (1 - progress) ** 3;
          bar.setAttribute('height', String(targetHeight * eased));
          bar.setAttribute('y', String(baseY - targetHeight * eased));
          if (progress < 1 && bar.isConnected) requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      }, 40 * index);
    }

    if (record.exact) {
      const star = svgElement('text', {
        x: x + barWidth * 0.32,
        y: baseY - targetHeight - 6,
        fill: palette.gold,
        'font-size': 12,
        'text-anchor': 'middle',
      });
      star.textContent = '★';
      svg.appendChild(star);
    }

    const label = svgElement('text', {
      x: x + barWidth * 0.32,
      y: height - bottom + 12,
      fill: palette.dim,
      'font-size': 10,
      'font-family': 'monospace',
      'text-anchor': 'end',
      transform: `rotate(-38 ${x + barWidth * 0.32} ${height - bottom + 12})`,
    });
    label.textContent = itemLabel(record);
    svg.appendChild(label);
  });

  container.replaceChildren(svg);
  return svg;
}

export function renderCumulativeChart(container, records, {
  id,
  ariaLabel,
  reducedMotion = false,
  palette = STATS_PALETTE,
}) {
  const width = 360;
  const height = 200;
  const left = 34;
  const bottom = 24;
  const plotWidth = (width - left - 10) / Math.max(records.length - 1, 1);
  const y = (value) => (height - bottom) - value * (height - bottom - 14);
  const points = cumulativeSeries(records);
  const pointString = (field) => points
    .map((point) => `${left + point.index * plotWidth},${y(field(point))}`)
    .join(' ');
  const upper = pointString((point) => point.interval[1]);
  const lower = [...points].reverse()
    .map((point) => `${left + point.index * plotWidth},${y(point.interval[0])}`)
    .join(' ');
  const line = pointString((point) => point.hitRate);
  const gradientId = `wilson-gradient-${id}`;

  container.innerHTML = `<svg viewBox="0 0 ${width} ${height}" xmlns="${SVG_NS}" role="img" aria-label="${ariaLabel}">
    <defs><linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${palette.teal}" stop-opacity=".16"/><stop offset="100%" stop-color="${palette.teal}" stop-opacity="0"/></linearGradient></defs>
    <line x1="${left}" y1="${y(0)}" x2="${width - 6}" y2="${y(0)}" stroke="${palette.axis}"/>
    <line x1="${left}" y1="${y(1)}" x2="${width - 6}" y2="${y(1)}" stroke="${palette.grid}"/>
    <text x="4" y="${y(0) + 4}" fill="${palette.dim}" font-size="10" font-family="monospace">0%</text>
    <text x="4" y="${y(1) + 4}" fill="${palette.dim}" font-size="10" font-family="monospace">100%</text>
    <polygon fill="url(#${gradientId})" points="${upper} ${lower}"/>
    <line x1="${left}" y1="${y(0.5)}" x2="${width - 6}" y2="${y(0.5)}" stroke="${palette.gold}" stroke-opacity=".3"/>
    <polyline data-stats-curve fill="none" stroke="${palette.teal}" stroke-width="1.5" points="${line}"/>
    ${points.map((point) => `<circle cx="${left + point.index * plotWidth}" cy="${y(point.hitRate)}" r="3" fill="${palette.teal}"/>`).join('')}
  </svg>`;

  if (!reducedMotion) {
    const path = container.querySelector('[data-stats-curve]');
    const length = path?.getTotalLength?.() || 600;
    if (path) {
      path.style.strokeDasharray = String(length);
      path.style.strokeDashoffset = String(length);
      path.style.transition = 'stroke-dashoffset 1s ease .2s';
      requestAnimationFrame(() => requestAnimationFrame(() => { path.style.strokeDashoffset = '0'; }));
    }
  }
}

export function renderCalibrationChart(container, records, {
  ariaLabel,
  palette = STATS_PALETTE,
}) {
  const width = 360;
  const height = 210;
  const left = 36;
  const bottom = 26;
  const x = (value) => left + ((value - 0.4) / 0.6) * (width - left - 12);
  const y = (value) => (height - bottom) - value * (height - bottom - 14);
  const bins = calibrationBins(records);
  container.innerHTML = `<svg viewBox="0 0 ${width} ${height}" xmlns="${SVG_NS}" role="img" aria-label="${ariaLabel}">
    <line x1="${left}" y1="${y(0)}" x2="${width - 6}" y2="${y(0)}" stroke="${palette.axis}"/>
    <line x1="${left}" y1="${y(1)}" x2="${width - 6}" y2="${y(1)}" stroke="${palette.grid}"/>
    <text x="4" y="${y(0) + 4}" fill="${palette.dim}" font-size="10" font-family="monospace">0%</text>
    <text x="4" y="${y(1) + 4}" fill="${palette.dim}" font-size="10" font-family="monospace">100%</text>
    ${[0.5, 0.7, 0.9].map((tick) => `<text x="${x(tick)}" y="${height - bottom + 14}" fill="${palette.dim}" font-size="10" font-family="monospace" text-anchor="middle">${Math.round(tick * 100)}%</text>`).join('')}
    <line x1="${x(0.4)}" y1="${y(0.4)}" x2="${x(1)}" y2="${y(1)}" stroke="${palette.gold}" stroke-opacity=".3"/>
    ${bins.map((bin) => {
      const cx = x(bin.averageConfidence);
      const cy = y(bin.hitRate);
      return `<line x1="${cx}" y1="${y(bin.interval[0])}" x2="${cx}" y2="${y(bin.interval[1])}" stroke="${palette.teal}" stroke-opacity=".55" stroke-width="1.5"/>
        <circle cx="${cx}" cy="${cy}" r="${3 + bin.total}" fill="${bin.hitRate >= bin.averageConfidence ? palette.green : palette.red}" fill-opacity=".8" stroke="rgba(255,255,255,.35)"/>
        <text x="${cx + 8}" y="${cy - 8}" fill="${palette.dim}" font-size="9" font-family="monospace">n=${bin.total}</text>`;
    }).join('')}
  </svg>`;
}

export function renderThresholdReadout(container, records, threshold, {
  bilingualNode,
  applyI18n,
}) {
  const summary = thresholdSummary(records, threshold);
  const values = [
    [summary.total, 'calls kept (n)', '保留场次 (n)'],
    [summary.total ? formatPercent(summary.hitRate) : '—', 'hit rate', '命中率'],
    [summary.total ? `${formatPercent(summary.interval[0])}–${formatPercent(summary.interval[1])}` : '—', 'Wilson 95%', 'Wilson 95%'],
    [summary.brier == null ? '—' : summary.brier.toFixed(3), 'Brier (↓ better)', 'Brier（越低越好）'],
  ];
  container.replaceChildren(...values.map(([value, en, zh]) => {
    const cell = document.createElement('div');
    const strong = document.createElement('b');
    strong.textContent = String(value);
    const label = document.createElement('span');
    bilingualNode(label, en, zh);
    cell.append(strong, label);
    return cell;
  }));
  applyI18n();
}

export function renderBootstrapHistogram(container, result, {
  label,
  palette = STATS_PALETTE,
}) {
  const width = 360;
  const height = 190;
  const left = 30;
  const bottom = 26;
  const max = Math.max(...result.counts, 1);
  const barWidth = (width - left - 10) / result.counts.length;
  const quantileX = (value) => left + value * result.total * barWidth + barWidth / 2;
  const interval = `${formatPercent(result.lower)}–${formatPercent(result.upper)}`;

  container.innerHTML = `<svg viewBox="0 0 ${width} ${height}" xmlns="${SVG_NS}" role="img" aria-label="${label} ${interval}">
    ${result.counts.map((count, successes) => {
      const barHeight = (count / max) * (height - bottom - 16);
      return `<rect x="${left + successes * barWidth + 0.5}" y="${height - bottom - barHeight}" width="${Math.max(0, barWidth - 1)}" height="${barHeight}" fill="${palette.teal}" fill-opacity=".8"/>`;
    }).join('')}
    ${[result.lower, result.upper].map((value) => `<line x1="${quantileX(value)}" y1="14" x2="${quantileX(value)}" y2="${height - bottom}" stroke="${palette.gold}" stroke-dasharray="5 4"/>`).join('')}
    ${[0, 0.5, 1].map((tick) => `<text x="${left + tick * result.total * barWidth + barWidth / 2}" y="${height - bottom + 14}" fill="${palette.dim}" font-size="9.5" font-family="monospace" text-anchor="middle">${Math.round(tick * 100)}%</text>`).join('')}
    <text x="${left}" y="10" fill="${palette.dim}" font-size="9.5" font-family="monospace">${result.iterations} / ${result.iterations} · 95% CI ${interval} · seed ${result.seed}</text>
  </svg>`;
}
