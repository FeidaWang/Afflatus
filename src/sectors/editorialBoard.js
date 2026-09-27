const METRICS = ['intelligence', 'terminal', 'scicode', 'lcr'];

export function mountEditorialBoard(root, snapshot, language) {
  if (!root || !snapshot) return { destroy() {}, setLanguage() {} };
  const bars = root.querySelector('#frontierEditorialBars');
  const controls = [...root.querySelectorAll('[data-editorial-metric]')];
  const sourceById = new Map(snapshot.sources.map((source) => [source.id, source]));
  let metric = 'intelligence';
  let selected = null;
  let expanded = null;
  let lang = language;

  const translate = (en, zh) => lang === 'zh' ? zh : en;
  const valueFor = (model, metricId) => snapshot.observations.find((entry) =>
    entry.model_id === model.id && entry.metric_id === metricId &&
    entry.evidence_status === 'reported_snapshot' && Number.isFinite(entry.value));

  const unitFor = (observation) => ({ index_points: translate('index points', '指数分'), percent: '%', rating_points: translate('rating points', '评分点') })[observation.unit] || observation.unit.replaceAll('_', ' ');

  function showDetail(model, observation, target) {
    target.replaceChildren();
    if (!model || !observation) return;
    const eyebrow = document.createElement('p');
    eyebrow.className = 'editorialEyebrow';
    eyebrow.textContent = translate('SELECTED CONFIGURATION', '选定配置');
    const title = document.createElement('h3');
    title.textContent = model.name;
    const value = document.createElement('strong');
    value.className = 'editorialDetailValue';
    value.textContent = `${observation.value} ${unitFor(observation)}`;
    const meta = document.createElement('p');
    meta.textContent = `${model.lab} · ${model.lab_geography} · ${model.configuration}`;
    const note = document.createElement('p');
    note.textContent = translate(
      'A measured configuration in a selected, dated source report. Use the complete comparison below for cost, access and missing evidence.',
      '这是选定来源报告中带日期的具体配置。成本、访问条件与缺失证据，请查看下方完整比较。');
    const sourceId = observation.source_ids?.[0];
    const source = sourceById.get(sourceId);
    const link = document.createElement('a');
    link.href = source?.url || '#sectorsFrontier';
    link.textContent = translate('Inspect the source ↗', '检查来源 ↗');
    if (source?.url) { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
    target.append(eyebrow, title, value, meta, note, link);
  }

  function render() {
    const available = snapshot.models
      .map((model) => ({ model, observation: valueFor(model, metric) }))
      .filter((item) => item.observation)
      .sort((a, b) => b.observation.value - a.observation.value)
      .slice(0, 10);
    const maximum = Math.max(...available.map((item) => item.observation.value), 1);
    if (!available.some((item) => item.model.id === selected)) selected = available[0]?.model.id;
    controls.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.editorialMetric === metric)));
    bars.replaceChildren();
    available.forEach(({ model, observation }, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'frontierEditorialRow';
      button.dataset.model = model.id;
      button.dataset.origin = model.lab_geography;
      button.setAttribute('aria-pressed', String(model.id === selected));
      button.setAttribute('aria-label', `${model.name}: ${observation.value} ${unitFor(observation)}`);
      button.setAttribute('aria-controls', `editorial-note-${model.id}`);
      button.setAttribute('aria-expanded', String(model.id === expanded));
      const rank = document.createElement('span');
      rank.className = 'editorialRank';
      rank.textContent = String(index + 1).padStart(2, '0') + '.';
      const line = document.createElement('span');
      line.className = 'editorialLine';
      const name = document.createElement('span');
      name.className = 'editorialModel';
      name.textContent = model.name;
      const bar = document.createElement('span');
      bar.className = 'editorialBar';
      bar.style.width = `${Math.max(0, observation.value / maximum * 100)}%`;
      line.append(bar, name);
      const score = document.createElement('span');
      score.className = 'editorialScore';
      score.textContent = `${observation.value}${observation.unit === 'percent' ? '%' : ''}`;
      const chevron = document.createElement('span');
      chevron.className = 'editorialChevron';
      chevron.setAttribute('aria-hidden', 'true');
      chevron.textContent = '⌄';
      button.append(rank, line, score, chevron);
      const inlineDetail = document.createElement('div');
      inlineDetail.id = `editorial-note-${model.id}`;
      inlineDetail.className = 'editorialInlineDetail';
      inlineDetail.hidden = model.id !== expanded;
      showDetail(model, observation, inlineDetail);
      button.addEventListener('click', () => {
        selected = model.id;
        expanded = expanded === model.id ? null : model.id;
        bars.querySelectorAll('.frontierEditorialRow').forEach((row) =>
          row.setAttribute('aria-pressed', String(row.dataset.model === selected)));
        bars.querySelectorAll('.frontierEditorialRow').forEach((row) => {
          row.setAttribute('aria-expanded', String(row.dataset.model === expanded));
          row.nextElementSibling.hidden = row.dataset.model !== expanded;
        });
      });
      bars.append(button, inlineDetail);
    });
  }

  const onClick = (event) => {
    const button = event.target.closest('[data-editorial-metric]');
    if (!button || !METRICS.includes(button.dataset.editorialMetric)) return;
    metric = button.dataset.editorialMetric;
    expanded = null;
    render();
  };
  root.addEventListener('click', onClick);
  render();
  return {
    setLanguage(next) { lang = next; render(); },
    destroy() { root.removeEventListener('click', onClick); bars.replaceChildren(); },
  };
}
