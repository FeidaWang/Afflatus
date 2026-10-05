export const escape = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function selectCompanies(data, {query = '', layer = 'all', country = 'all'} = {}) {
  const q = query.trim().normalize('NFKC').toLocaleLowerCase();
  return data.companies.filter(c => (layer === 'all' || c.layer === layer) && (country === 'all' || c.country === country) && (!q || [c.name.en,c.name.zh,c.role.en,c.role.zh,c.city.en,c.city.zh,c.country,c.url].join(' ').normalize('NFKC').toLocaleLowerCase().includes(q)));
}
export function rankModels(models, {metric = 'score', country = 'all', open = false} = {}) {
  const rows = models.filter(m => (country === 'all' || m.country === country) && (!open || m.open === true));
  rows.sort((a,b) => {
    if (a[metric] == null) return b[metric] == null ? a.name.localeCompare(b.name) : 1;
    if (b[metric] == null) return -1;
    return (metric === 'cost' || metric === 'latency' ? a[metric]-b[metric] : b[metric]-a[metric]) || a.name.localeCompare(b.name);
  });
  return rows.map((m,i) => ({...m,rank:m[metric]==null ? null : i && rows[i-1][metric]===m[metric] ? rows.findIndex(r=>r[metric]===m[metric])+1 : i+1}));
}
export function metricValue(model, metric) {
  if (model[metric] == null) return '—';
  return metric === 'cost' ? `$${model.cost.toFixed(2)}` : metric === 'speed' ? `${model.speed}` : metric === 'latency' ? model.latency.toFixed(2) : `${model.score}`;
}
export function barRatio(value, values) {
  const max = Math.max(...values.filter(Number.isFinite), 1);
  return Number.isFinite(value) ? Math.max(0, Math.min(100, value/max*100)) : 0;
}
