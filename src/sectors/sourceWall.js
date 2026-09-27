const GROUPS = {
  origin: [
    { id: 'all', en: 'All selected models', zh: '全部选定模型' },
    { id: 'US', en: 'US-based labs', zh: '美国实验室' },
    { id: 'CN', en: 'China-based labs', zh: '中国实验室' },
  ],
  weights: [
    { id: 'all', en: 'All weight statuses', zh: '全部权重状态' },
    { id: 'open', en: 'Open weights', zh: '开放权重' },
    { id: 'closed', en: 'Closed weights', zh: '非开放权重' },
  ],
  metric: [
    { id: 'intelligence', en: 'Overall index', zh: '综合指数' },
    { id: 'terminal', en: 'Terminal work', zh: '终端任务' },
    { id: 'scicode', en: 'Scientific coding', zh: '科研编程' },
    { id: 'lcr', en: 'Long context', zh: '长上下文' },
  ],
};

export function mountSourceWall(dialog, snapshot, language) {
  if (!dialog || !snapshot) return { destroy() {}, setLanguage() {} };
  const open = document.getElementById('sourceWallOpen');
  const close = document.getElementById('sourceWallClose');
  const search = document.getElementById('sourceWallSearch');
  const nav = document.getElementById('sourceWallNav');
  const cards = document.getElementById('sourceWallCards');
  const tabs = [...dialog.querySelectorAll('[data-wall-group]')];
  const sources = new Map(snapshot.sources.map((source) => [source.id, source]));
  let group = 'origin';
  let filter = 'all';
  let lang = language;
  let lastFocus = null;
  const tr = (en, zh) => lang === 'zh' ? zh : en;
  const observation = (model, metric) => snapshot.observations.find((row) =>
    row.model_id === model.id && row.metric_id === metric &&
    row.evidence_status === 'reported_snapshot' && Number.isFinite(row.value));

  function buildCard(model, metric) {
    const score = observation(model, metric);
    const article = document.createElement('article');
    article.className = 'sourceWallCard';
    const label = document.createElement('span');
    label.className = 'sourceWallCardLabel';
    label.textContent = `${model.lab_geography} · ${model.open_weights ? tr('OPEN WEIGHTS', '开放权重') : tr('CLOSED WEIGHTS', '非开放权重')}`;
    const title = document.createElement('h3');
    title.textContent = model.name;
    const value = document.createElement('strong');
    value.textContent = score ? `${score.value} ${score.unit.replaceAll('_', ' ')}` : tr('No reported value', '无已报告数值');
    const description = document.createElement('p');
    description.textContent = `${model.lab} · ${model.configuration}`;
    article.append(label, title, value, description);
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = tr('Inspect evidence', '查看证据');
    details.append(summary);
    const note = document.createElement('p');
    note.textContent = tr(
      'This is one reported configuration in a selected cohort. Context, license and current pricing require separate checks.',
      '这是选定样本中的一项来源报告配置。上下文、许可和当前价格仍需分别核查。');
    details.append(note);
    const source = sources.get(score?.source_ids?.[0] || model.source_ids?.[0]);
    if (source?.url) {
      const link = document.createElement('a');
      link.href = source.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = tr('Open primary source ↗', '打开一手来源 ↗');
      details.append(link);
    }
    article.append(details);
    return article;
  }

  function render() {
    tabs.forEach((tab) => tab.setAttribute('aria-pressed', String(tab.dataset.wallGroup === group)));
    nav.replaceChildren();
    for (const option of GROUPS[group]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.wallFilter = option.id;
      button.setAttribute('aria-current', String(option.id === filter));
      button.textContent = option[lang];
      nav.append(button);
    }
    const metric = group === 'metric' ? filter : 'intelligence';
    const query = search.value.trim().toLocaleLowerCase();
    const models = snapshot.models.filter((model) => {
      if (model.status !== 'reported_snapshot') return false;
      if (group === 'origin' && filter !== 'all' && model.lab_geography !== filter) return false;
      if (group === 'weights' && filter !== 'all' && model.open_weights !== (filter === 'open')) return false;
      if (query && !`${model.name} ${model.lab} ${model.configuration}`.toLocaleLowerCase().includes(query)) return false;
      return Boolean(observation(model, metric));
    }).sort((a, b) => observation(b, metric).value - observation(a, metric).value);
    cards.replaceChildren();
    const heading = document.createElement('h3');
    heading.className = 'sourceWallSectionTitle';
    heading.textContent = (GROUPS[group].find((item) => item.id === filter)?.[lang] || '') + ` · ${models.length}`;
    cards.append(heading);
    if (!models.length) {
      const empty = document.createElement('p');
      empty.textContent = tr('No matching configurations in this selected snapshot.', '选定快照中没有符合条件的配置。');
      cards.append(empty);
    } else models.forEach((model) => cards.append(buildCard(model, metric)));
  }

  function onTab(event) {
    const button = event.target.closest('[data-wall-group]');
    if (!button || !GROUPS[button.dataset.wallGroup]) return;
    group = button.dataset.wallGroup;
    filter = group === 'metric' ? 'intelligence' : 'all';
    render();
  }
  function onFilter(event) {
    const button = event.target.closest('[data-wall-filter]');
    if (!button) return;
    filter = button.dataset.wallFilter;
    render();
  }
  function onOpen() { lastFocus = document.activeElement; dialog.showModal(); render(); search.focus(); }
  function onClose() { dialog.close(); lastFocus?.focus(); }
  function onBackdrop(event) { if (event.target === dialog) onClose(); }
  function onCancel() { queueMicrotask(() => lastFocus?.focus()); }
  open.addEventListener('click', onOpen);
  close.addEventListener('click', onClose);
  dialog.addEventListener('click', onTab);
  dialog.addEventListener('click', onBackdrop);
  dialog.addEventListener('cancel', onCancel);
  nav.addEventListener('click', onFilter);
  search.addEventListener('input', render);
  render();
  return {
    setLanguage(next) { lang = next; render(); },
    destroy() {
      open.removeEventListener('click', onOpen);
      close.removeEventListener('click', onClose);
      dialog.removeEventListener('click', onTab);
      dialog.removeEventListener('click', onBackdrop);
      dialog.removeEventListener('cancel', onCancel);
      nav.removeEventListener('click', onFilter);
      search.removeEventListener('input', render);
      if (dialog.open) dialog.close();
    },
  };
}
