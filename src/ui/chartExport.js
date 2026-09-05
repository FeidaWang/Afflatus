import { chartScale } from './portfolioChartGeometry.js';

const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]);

// Links contain a public chart identifier only. Never forward query strings,
// selected records, account fields or arbitrary application state.
export function chartLink(location, id) {
  if (!/^chart-(core|cycles|benchmarks|allocation)$/.test(id)) throw new Error('Unknown chart');
  const url = new URL(location.href);
  url.search = '';
  url.hash = id;
  return url.href;
}

// Render a fresh, self-contained public-data figure, not a screenshot of the
// page (which could include private UI, tooltips or an in-flight animation).
export function chartSVG({ title, date, source, note, series, records, hidden = new Set(), labels }) {
  let y = 28;
  const parts = [];
  const text = (value, x = 24, size = 15, color = '#182c37', width = 85) => {
    const lines = String(value).split('\n').flatMap(line => {
      const chars = Array.from(line); const out = [];
      // Conservative character width also accommodates CJK labels.
      while (chars.length) {
        let length = Math.min(width, chars.length);
        if (length < chars.length) {
          const space = chars.slice(0, length).lastIndexOf(' ');
          if (space > width / 2) length = space + 1;
        }
        out.push(chars.splice(0, length).join('').trim());
      }
      return out.length ? out : [''];
    });
    for (const line of lines) {
      parts.push(`<text x="${x}" y="${y}" font-size="${size}" fill="${color}">${escape(line)}</text>`);
      y += size + 7;
    }
  };
  text(title, 24, 24, '#111315', 38);
  text(date, 24, 14, '#364e60', 65);
  text(source, 24, 14, '#364e60', 65);
  text(note, 24, 14, '#364e60', 65);
  for (const item of series) {
    const rows = records.filter(row => row.series === item.id);
    const scale = item.domain || chartScale(rows.map(row => row.value));
    text(`${item.symbol} ${item.label} (${item.unit})${hidden.has(item.id) ? ` · ${labels.hidden}` : ''}`, 24, 18, '#111315', 52);
    text(`${labels.scale}: ${scale.min} — ${scale.max} ${item.unit}`, 24, 14);
    if (hidden.has(item.id)) continue;
    for (const row of rows) {
      text(`${row.label} · ${row.value == null ? labels.missing : row.value} ${row.unit} · ${row.status}`, 24, 15, '#182c37', 58);
      const point = value => 30 + (value - scale.min) / (scale.max - scale.min) * 830;
      const zero = point(0);
      parts.push(`<path d="M30 ${y}H860 M${zero} ${y - 7}V${y + 7}" stroke="#80909b" fill="none"/>`);
      if (Number.isFinite(row.value)) {
        const end = point(row.value);
        const color = row.value < 0 ? '#a82b36' : item.id === 'days' || item.id === 'spx' ? '#865017' : '#18607b';
        if (item.symbol === '●') {
          if (item.id === 'qqq') parts.push(`<path d="M${zero} ${y}H${end}" stroke="${color}"/>`);
          parts.push(`<circle cx="${end}" cy="${y}" r="5" fill="${color}"/>`);
        }
        else if (item.symbol === '□') parts.push(`<path d="M${zero} ${y}H${end}" stroke="${color}" stroke-dasharray="5 4"/><rect x="${end - 4}" y="${y - 4}" width="8" height="8" fill="${color}"/>`);
        else parts.push(`<rect x="${Math.min(zero, end)}" y="${y - 4}" width="${Math.abs(end - zero)}" height="8" fill="${color}"/>`);
      }
      y += 30;
    }
    y += 8;
  }
  text(labels.missingNote, 24, 14, '#364e60', 65);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="${y + 16}" viewBox="0 0 960 ${y + 16}" role="img"><title>${escape(title)}</title><desc>${escape(`${date} · ${source} · ${note}`)}</desc><rect width="960" height="${y + 16}" fill="#fff"/><g font-family="Arial, sans-serif">${parts.join('')}</g></svg>`;
}

export async function downloadChart(svg, format, filename) {
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const sourceURL = URL.createObjectURL(blob);
  let outputURL = sourceURL;
  try {
    if (format === 'png') {
      const image = new Image();
      await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = sourceURL; });
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth * 2; canvas.height = image.naturalHeight * 2;
      if (canvas.width * canvas.height > 32_000_000) throw new Error('Image too large');
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas unavailable');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const png = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!png) throw new Error('PNG unavailable');
      outputURL = URL.createObjectURL(png);
    }
    const link = document.createElement('a');
    link.href = outputURL; link.download = `${filename}.${format}`;
    link.click();
  } finally {
    // Keep object URLs alive long enough for Safari to start the download.
    setTimeout(() => { URL.revokeObjectURL(sourceURL); if (outputURL !== sourceURL) URL.revokeObjectURL(outputURL); }, 60_000);
  }
}
