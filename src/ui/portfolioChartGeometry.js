// Small, zero-inclusive scales for the existing Portfolio DOM charts.
// null is absence, never a synthetic zero; each record is an independent mark.
export function chartNumber(text) {
  const value = String(text ?? '').trim().replace('−', '-');
  return /^[+-]?\d+(\.\d+)?\s*[%×]?$/.test(value) ? Number.parseFloat(value) : null;
}
function extent(value) {
  if (!value) return 0;
  const power = 10 ** Math.floor(Math.log10(value));
  return [1, 2, 2.5, 3, 4, 5, 6, 8, 10].find(n => n * power >= value) * power;
}
export function chartScale(values) {
  const known = values.filter(Number.isFinite);
  const min = -extent(Math.abs(Math.min(0, ...known)));
  const max = extent(Math.max(0, ...known)) || (min === 0 ? 1 : 0);
  const position = value => (value - min) / (max - min) * 100;
  return { min, max, zero: position(0), mark(value) {
    if (!Number.isFinite(value)) return null;
    return { start: position(Math.min(0, value)), width: Math.abs(value) / (max - min) * 100, point: position(value) };
  } };
}
export function initPortfolioChartGeometry() {
  for (const selector of ['.route-efficiency', '.route-track', '.velocity-vector']) {
    const rows = [...document.querySelectorAll(selector)];
    const values = rows.map(row => chartNumber(row.querySelector('[data-chart-value]')?.textContent));
    const scale = chartScale(values);
    rows.forEach((row, index) => {
      const mark = scale.mark(values[index]);
      row.dataset.chartMissing = String(!mark);
      row.dataset.chartNegative = String(values[index] < 0);
      if (!mark) {
        const label = row.querySelector('[data-chart-value]');
        label.dataset.en = 'No data';
        label.dataset.zh = '无数据';
        const text = document.documentElement.lang.startsWith('zh') ? '无数据' : 'No data';
        if (label.textContent !== text) label.textContent = text;
      }
      row.style.setProperty('--chart-zero', `${scale.zero}%`);
      if (mark) {
        row.style.setProperty('--chart-start', `${mark.start}%`);
        row.style.setProperty('--chart-width', `${mark.width}%`);
        row.style.setProperty('--chart-point', `${mark.point}%`);
      }
      for (const [bound, value] of [['min', scale.min], ['max', scale.max]]) {
        const label = row.querySelector(`[data-axis-${bound}]`);
        if (label.textContent !== String(value)) label.textContent = value;
      }
    });
  }
}
