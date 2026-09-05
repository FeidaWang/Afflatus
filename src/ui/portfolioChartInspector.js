import { chartNumber, chartScale, initPortfolioChartGeometry } from './portfolioChartGeometry.js';
import { chartLink, chartSVG, downloadChart } from './chartExport.js';
import './portfolioChartInspector.css';

const copy = {
  en: {
    core: 'Closed-cycle capital core', cycles: 'Closed-cycle trajectories', benchmarks: 'Model / benchmark', allocation: 'Research allocation',
    efficiency: 'Annualized cycle efficiency', days: 'Holding days', weighted: 'Weighted capital days', count: 'Closed cycles', volatility: 'Annual volatility', weight: 'Research weight',
    model: 'Model estimate', disclosed: 'Disclosed closed-cycle summary', research: 'Subjective research allocation · not account holdings',
    date: 'As of: FY2025–26; exact cutoff not disclosed. Method: 2026-08-08.',
    allocationDate: 'As of: 2026-08-07 08:29 ET',
    source: 'Source: Portfolio published model / closed-cycle summary', allocationSource: 'Source: published allocation framework (content.js)',
    note: 'Model / risk estimates, not audited returns. 365-day cycle projection is not achieved account return. Benchmark inputs and exact comparison dates are not disclosed.',
    missing: 'No data', missingNote: 'No data means missing or undisclosed, never zero. Exact trade dates and private settlement details are not published.',
    help: 'Hover or tap a mark. Focus this chart; use arrow keys to select records, Home/End for first/last. Esc or click outside to close. Full data below.',
    table: 'Complete chart data', tableScroll: 'Scroll the table sideways to read all columns.', series: 'Series', record: 'Record', value: 'Value', unit: 'Unit', status: 'Status', dateHeading: 'Date / reporting basis',
    copy: 'Copy chart link', copied: 'Link copied', copyFailed: 'Could not copy link', export: 'Export chart', download: 'Download started', exportFailed: 'Export failed', preparing: 'Preparing image…',
    footnote: 'Source and method [1]', back: 'Back to chart', hidden: 'Hidden', scale: 'Scale', loading: 'Loading current data; inspection unavailable. The table shows the previous published snapshot.', empty: 'No records available', allHidden: 'All series hidden; complete data below.',
  },
  zh: {
    core: '已结清周期资本核心', cycles: '已结清周期轨迹', benchmarks: '模型 / 基准倍数', allocation: '研究配置权重',
    efficiency: '周期年化效率', days: '持有天数', weighted: '资金加权占用天数', count: '已结清周期数', volatility: '年波动率', weight: '研究权重',
    model: '模型估算', disclosed: '公开已结清周期摘要', research: '主观研究配置 · 非账户实际持仓',
    date: '截至：2025–26 财年；精确截止日未披露。方法日期：2026-08-08。',
    allocationDate: '截至：2026-08-07 08:29 ET',
    source: '来源：Portfolio 公开模型 / 已结清周期摘要', allocationSource: '来源：公开配置框架（content.js）',
    note: '模型与风险估算，并非审计收益。365 天周期外推不等于账户实际收益。原始基准输入与精确比较日期未披露。',
    missing: '无数据', missingNote: '无数据表示缺失或未披露，不等于零。精确交易日期与私人结算明细不公开。',
    help: '悬停或轻触图形。聚焦图表后用方向键选择记录，Home/End 选择首尾。Esc 或外部点击关闭。下方提供完整数据。',
    table: '完整图表数据', tableScroll: '在表格区域左右滑动，可阅读全部列。', series: '系列', record: '记录', value: '值', unit: '单位', status: '状态', dateHeading: '日期 / 统计口径',
    copy: '复制图表链接', copied: '链接已复制', copyFailed: '复制失败', export: '导出图表', download: '已开始下载', exportFailed: '导出失败', preparing: '正在生成图片…',
    footnote: '来源与方法 [1]', back: '返回图表', hidden: '已隐藏', scale: '坐标', loading: '正在加载当前数据，暂不可探查。表格显示上一份公开快照。', empty: '暂无记录', allHidden: '所有系列已隐藏；下方仍有完整数据。',
  },
};
const element = (tag, text, attrs = {}) => {
  const el = document.createElement(tag);
  if (text) el.textContent = text;
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  return el;
};

// All adapters read the same public DOM fields that the M10 owners draw.
// No new financial values, account access, or shadow dataset is introduced.
function readChart(kind, root, c, zh) {
  const series = [];
  const records = [];
  const addSeries = (id, label, unit, symbol = '━', domain) => { series.push({ id, label, unit, symbol, domain }); };
  const add = (node, label, id, status, valueNode = node.querySelector('[data-chart-value]')) => {
    const item = series.find(s => s.id === id);
    const value = chartNumber(valueNode?.textContent);
    records.push({ node, label, series: id, value, unit: item.unit, status: value == null ? c.missing : status });
  };
  if (kind === 'cycles') {
    addSeries('efficiency', c.efficiency, '%'); addSeries('days', c.days, zh ? '天' : 'days', '●');
    root.querySelectorAll('.trade-route').forEach(row => {
      const label = row.querySelector('header > span').textContent;
      add(row.querySelector('.route-efficiency'), label, 'efficiency', c.model);
      add(row.querySelector('.route-track'), label, 'days', c.disclosed);
    });
  } else if (kind === 'benchmarks') {
    addSeries('qqq', zh ? '模型 / QQQ' : 'Model / QQQ', '×', '●'); addSeries('spx', zh ? '模型 / SPX' : 'Model / SPX', '×', '□');
    root.querySelectorAll('.velocity-vector').forEach((node, i) => add(node, i ? 'SPX' : 'QQQ', i ? 'spx' : 'qqq', c.model));
    // Filtering must not rescale one benchmark independently of the other.
    const domain = chartScale(records.map(r => r.value));
    series.forEach(s => { s.domain = domain; });
  } else if (kind === 'allocation') {
    addSeries('weight', c.weight, '%', '━', { min: 0, max: 100 });
    root.querySelectorAll('.pick-card, .holdings-fallback li').forEach(row => {
      const node = row.querySelector('.alloc-row') || row;
      add(node, row.querySelector('.pick-ticker, strong').textContent, 'weight', c.research, row.querySelector('.alloc-num, b'));
    });
  } else {
    addSeries('efficiency', c.efficiency, '%'); addSeries('weighted', c.weighted, zh ? '天' : 'days', '●');
    addSeries('count', c.count, zh ? '条' : 'cycles'); addSeries('volatility', c.volatility, '%');
    add(root.querySelector('.cycle-efficiency'), c.efficiency, 'efficiency', c.model, root.querySelector('.cycle-efficiency strong'));
    root.querySelectorAll('.core-telemetry > div').forEach((row, i) => {
      if (i < 3) add(row, series[i + 1].label, series[i + 1].id, i === 2 ? c.model : c.disclosed, row.querySelector('dd'));
    });
  }
  return { title: c[kind], date: kind === 'allocation' ? c.allocationDate : c.date,
    source: kind === 'allocation' ? c.allocationSource : c.source,
    note: kind === 'allocation' ? c.research : c.note, records, series, labels: c };
}

export function initPortfolioChartInspector() {
  const controllers = [];
  for (const [kind, selector] of Object.entries({ core: '.cycle-core-grid', benchmarks: '.velocity-stage', cycles: '.route-manifest', allocation: '#pickGrid' })) {
    const root = document.querySelector(selector);
    if (!root || root.dataset.inspector) continue;
    root.dataset.inspector = 'ready';
    // Keep the allocation list's existing ID/semantics and dossier buttons.
    const target = kind === 'allocation' ? root.parentElement : root;
    target.id = `chart-${kind}`;
    target.tabIndex = 0;
    target.setAttribute('role', 'group');
    const panel = element('section', '', { class: 'chart-inspector', 'aria-label': 'Chart data' });
    root.after(panel);
    const tooltip = element('div', '', { class: 'chart-tooltip', role: 'tooltip', id: `${target.id}-tooltip`, hidden: '' });
    document.body.append(tooltip);
    let data, c, active = 0, selectedNode, pinned = false, leaveTimer;
    let hidden = new Set();
    let live, status, tableRegion, menu;
    const visible = () => data.records.filter(row => !hidden.has(row.series));
    const busy = () => root.getAttribute('aria-busy') === 'true';
    const close = () => {
      clearTimeout(leaveTimer);
      tooltip.hidden = true; pinned = false;
      selectedNode?.removeAttribute('data-chart-selected'); selectedNode = null;
      target.removeAttribute('aria-describedby');
      if (live) live.textContent = '';
    };
    const place = node => {
      const rect = node.getBoundingClientRect();
      const viewport = window.visualViewport;
      const left = viewport?.offsetLeft || 0, top = viewport?.offsetTop || 0;
      const width = viewport?.width || innerWidth, height = viewport?.height || innerHeight;
      tooltip.style.maxWidth = `${Math.max(1, width - 16)}px`;
      tooltip.style.maxHeight = `${Math.max(1, height - 16)}px`;
      const box = tooltip.getBoundingClientRect();
      tooltip.style.left = `${Math.max(left + 8, Math.min(rect.left, left + width - box.width - 8))}px`;
      const above = rect.top - box.height - 10;
      tooltip.style.top = `${Math.max(top + 8, Math.min(above >= top + 8 ? above : rect.bottom + 10, top + height - box.height - 8))}px`;
    };
    const select = (index, keyboard = false) => {
      clearTimeout(leaveTimer);
      const rows = visible();
      if (busy() || !rows.length) { close(); return; }
      active = Math.max(0, Math.min(index, rows.length - 1));
      const row = rows[active];
      if (!row.node.isConnected) { close(); return; }
      selectedNode?.removeAttribute('data-chart-selected'); selectedNode = row.node;
      row.node.setAttribute('data-chart-selected', 'true');
      const series = data.series.find(s => s.id === row.series);
      const text = `${row.label} · ${series.label}\n${c.value}: ${row.value == null ? c.missing : row.value} ${row.unit}\n${c.status}: ${row.status}\n${data.date}`;
      tooltip.textContent = text; tooltip.hidden = false;
      target.setAttribute('aria-describedby', tooltip.id);
      if (keyboard) { row.node.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' }); live.textContent = text; }
      place(row.node);
    };
    const table = () => {
      tableRegion.replaceChildren();
      const el = element('table');
      el.append(element('caption', `${data.title} — ${c.table}`));
      const head = element('thead'), header = element('tr');
      [c.record, c.value, c.unit, c.series, c.status, c.dateHeading].forEach(label => header.append(element('th', label, { scope: 'col' })));
      head.append(header); el.append(head);
      const body = element('tbody');
      for (const row of data.records) {
        const tr = element('tr'), item = data.series.find(s => s.id === row.series);
        tr.append(element('th', row.label, { scope: 'row' }));
        [row.value == null ? c.missing : String(row.value), row.unit, item.label + (hidden.has(row.series) ? ` · ${c.hidden}` : ''), row.status, data.date]
          .forEach(value => tr.append(element('td', value)));
        body.append(tr);
      }
      el.append(body); tableRegion.append(el);
    };
    const refresh = () => {
      close(); active = 0;
      if (kind === 'cycles' || kind === 'benchmarks') initPortfolioChartGeometry();
      const zh = document.documentElement.lang.startsWith('zh'); c = copy[zh ? 'zh' : 'en'];
      data = readChart(kind, root, c, zh);
      target.setAttribute('aria-label', `${data.title}. ${c.help}`);
      panel.setAttribute('aria-label', `${data.title} — ${c.table}`);
      panel.replaceChildren();
      const help = element('p', c.help);
      const legend = element('div', '', { class: 'chart-series', 'aria-label': c.series });
      for (const item of data.series) {
        const label = `${item.symbol} ${item.label} (${item.unit})`;
        const button = element(data.series.length > 1 ? 'button' : 'span', label);
        const update = () => {
          button.setAttribute('aria-pressed', String(!hidden.has(item.id)));
          button.textContent = label + (hidden.has(item.id) ? ` · ${c.hidden}` : '');
          data.records.filter(r => r.series === item.id).forEach(r => r.node.classList.toggle('chart-series-hidden', hidden.has(item.id)));
        };
        if (data.series.length > 1) {
          button.type = 'button'; update();
          button.addEventListener('click', () => { close(); active = 0; hidden.has(item.id) ? hidden.delete(item.id) : hidden.add(item.id); update(); table(); status.textContent = visible().length ? '' : c.allHidden; });
        }
        legend.append(button);
      }
      const actions = element('div', '', { class: 'chart-actions' });
      const copyButton = element('button', c.copy, { type: 'button' });
      copyButton.addEventListener('click', async () => {
        status.textContent = '';
        try { await navigator.clipboard.writeText(chartLink(location, target.id)); status.textContent = c.copied; }
        catch { status.textContent = c.copyFailed; }
      });
      actions.append(copyButton);
      // Only the public, finite-size DOM figures have a supported exporter.
      if (!busy() && data.records.length && data.records.length <= 100) {
        menu = element('details', '', { class: 'chart-export' });
        const summary = element('summary', c.export); menu.append(summary);
        for (const format of ['svg', 'png']) {
          if (format === 'png' && !document.createElement('canvas').getContext('2d')) continue;
          const button = element('button', format.toUpperCase(), { type: 'button' });
          button.addEventListener('click', async () => {
            close(); menu.open = false; summary.focus();
            status.textContent = c.preparing; actions.setAttribute('aria-busy', 'true');
            menu.querySelectorAll('button').forEach(b => { b.disabled = true; });
            try { await downloadChart(chartSVG({ ...data, hidden }), format, target.id); status.textContent = c.download; }
            catch { status.textContent = c.exportFailed; }
            finally { actions.removeAttribute('aria-busy'); menu.querySelectorAll('button').forEach(b => { b.disabled = false; }); }
          });
          menu.append(button);
        }
        actions.append(menu);
      }
      status = element('p', busy() ? c.loading : data.records.length ? '' : c.empty, { role: 'status', class: 'chart-status' });
      live = element('span', '', { role: 'status', class: 'chart-sr' });
      const ref = element('a', c.footnote, { href: `#${target.id}-note`, class: 'chart-note-ref' });
      tableRegion = element('div', '', { class: 'chart-table-region', tabindex: '0', role: 'region', 'aria-label': `${data.title} — ${c.table}`, 'aria-describedby': `${target.id}-note` });
      const note = element('p', `${data.date} ${data.source}. ${data.note} ${c.missingNote} `, { id: `${target.id}-note`, tabindex: '-1', class: 'chart-footnote' });
      note.append(element('a', c.back, { href: `#${target.id}` }));
      panel.append(help, legend, actions, status, live, ref, element('p', c.tableScroll), tableRegion, note);
      table();
    };
    target.addEventListener('focus', () => { pinned = true; select(active, true); });
    target.addEventListener('keydown', event => {
      if (event.target !== target) return;
      const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
      if (!keys.includes(event.key)) return;
      event.preventDefault(); pinned = true;
      select(event.key === 'Home' ? 0 : event.key === 'End' ? visible().length - 1 : active + (['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1), true);
    });
    const hit = event => visible().findIndex(row => row.node.contains(event.target));
    root.addEventListener('pointermove', event => { if (event.pointerType === 'touch') return; const index = hit(event); if (index >= 0) { pinned = false; select(index); } });
    root.addEventListener('click', event => { const index = hit(event); if (index >= 0) { pinned = true; select(index); } });
    root.addEventListener('pointerleave', event => { if (!pinned && !tooltip.contains(event.relatedTarget)) leaveTimer = setTimeout(close, 180); });
    tooltip.addEventListener('pointerenter', () => clearTimeout(leaveTimer));
    tooltip.addEventListener('pointerleave', event => { if (!pinned && !root.contains(event.relatedTarget)) leaveTimer = setTimeout(close, 180); });
    target.addEventListener('focusout', () => close());
    document.addEventListener('pointerdown', event => {
      if (!root.contains(event.target) && !tooltip.contains(event.target)) close();
      if (!menu?.contains(event.target)) { if (menu) menu.open = false; }
    });
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      close();
      if (menu?.open) { menu.open = false; menu.querySelector('summary').focus(); }
    });
    const reposition = () => { if (!tooltip.hidden && selectedNode) place(selectedNode); };
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, { passive: true });
    window.visualViewport?.addEventListener('resize', reposition);
    window.visualViewport?.addEventListener('scroll', reposition);
    refresh();
    // The allocation owner is lazy and can replace all cards. Discard the old
    // record selection on every source update, including loading transitions.
    new MutationObserver(refresh).observe(root, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['aria-busy'] });
    window.addEventListener('afflatus-lang', refresh);
    controllers.push({ target, close });
  }
  const navigate = () => {
    controllers.forEach(controller => controller.close());
    const controller = controllers.find(({ target }) => `#${target.id}` === location.hash);
    if (controller) { controller.target.scrollIntoView({ block: 'start' }); controller.target.focus({ preventScroll: true }); }
  };
  window.addEventListener('hashchange', navigate);
  if (controllers.some(({ target }) => `#${target.id}` === location.hash)) requestAnimationFrame(navigate);
}
