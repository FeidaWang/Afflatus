/* ============================================================
   SECTORS COMPETITION VIEW — DOM/SVG glue for the three Red-vs-Blue sections
   added by urgent.md Part 3: the evaluation radar plus benchmark table
   (RB-P0-04), the dual Top-10 equity boards (RB-P0-05) and the geopolitical
   scoreboard (RB-P0-06).

   All arithmetic lives in sectorsCompetition.js; this file only projects it into
   the DOM. Everything is built with createElement/textContent rather than
   innerHTML: the dataset is local, but source URLs and bilingual copy pass
   through here and the site's rule is that JSON-derived strings never become
   markup.

   Accessibility contract inherited from ROADMAP P0-07: the table under the radar
   is the complete dataset and is keyboard-sortable, the radar SVG carries a name
   containing every plotted value, series are distinguished by stroke pattern as
   well as colour, and a missing measurement renders as a labelled gap so it can
   never be misread as a score of zero.
   ============================================================ */
import {
  buildRadar,
  radarPolygon,
  radarAxisPoints,
  buildTable,
  sortRows,
  buildScoreboard,
  buildBoards,
  countTiers,
} from './sectorsCompetition.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const RADAR_SIZE = 640;
const RADAR_RADIUS = 214;
const MAX_SERIES = 4;
const BLOC_STROKE = { US: '#62A8FF', CN: '#FF7A80', neutral: '#7EF0DC' };
const DEFAULT_SELECTION = ['claude-opus-5', 'claude-fable-5', 'kimi-k3', 'minimax-m3'];

function svg(name, attrs = {}) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) {
    if (value !== null && value !== undefined) node.setAttribute(key, String(value));
  }
  return node;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

function tierBadge(tier, label) {
  const badge = el('span', 'rbTier', label || tier);
  badge.dataset.tier = tier;
  return badge;
}

function blocBadge(bloc, label) {
  const badge = el('span', 'rbBloc', label);
  badge.dataset.bloc = bloc;
  return badge;
}

function formatValue(value, unit) {
  if (!Number.isFinite(value)) return null;
  const rounded = Math.abs(value) >= 100 ? Math.round(value) : Math.round(value * 100) / 100;
  if (unit === 'USD') return `$${rounded}`;
  if (unit === '%') return `${rounded}%`;
  if (unit === 'x') return `${rounded}x`;
  return String(rounded);
}

/**
 * @param {{radar:HTMLElement, table:HTMLElement, boards:HTMLElement, scoreboard:HTMLElement}} hosts
 * @param {object} data parsed sectors-competition.json
 * @param {{lang:()=>string}} [opts]
 */
export function initSectorsCompetition(hosts, data, opts = {}) {
  const getLang = typeof opts.lang === 'function' ? opts.lang : () => 'en';
  const zh = () => getLang() === 'zh';
  const T = (en, zhText) => (zh() ? zhText : en);
  const pick = (item, key) => (item ? item[`${key}_${zh() ? 'zh' : 'en'}`] : '');

  const roster = Array.isArray(data?.models) ? data.models : [];
  let selection = DEFAULT_SELECTION.filter((id) => roster.some((model) => model.id === id));
  if (!selection.length) selection = roster.slice(0, MAX_SERIES).map((model) => model.id);
  let sortColumn = 'aa_intelligence';
  let sortDirection = 'desc';

  /* ── radar ─────────────────────────────────────────────────────────── */

  function radarCaptionText(radar) {
    const parts = radar.series.map((series) => {
      const values = series.points.map((point) => {
        const axis = radar.axes.find((item) => item.id === point.axisId);
        const label = pick(axis, 'label');
        if (point.value === null) return `${label} ${T('not published', '未公布')}`;
        return `${label} ${formatValue(point.value, point.unit)}`;
      });
      return `${series.name}: ${values.join(', ')}`;
    });
    const gapNote = radar.gaps
      ? T(
        `${radar.gaps} measurement${radar.gaps === 1 ? '' : 's'} not published; those axes are drawn as gaps, not as zero.`,
        `有 ${radar.gaps} 项测量未公布；相应轴以断口呈现，而非计为零分。`,
      )
      : '';
    return `${parts.join('. ')}. ${gapNote}`.trim();
  }

  function renderRadar() {
    const host = hosts.radar;
    if (!host) return;
    host.replaceChildren();
    const radar = buildRadar(data, selection);
    const axisCount = radar.axes.length;

    const figure = el('figure', 'rbRadarFig');
    const chart = svg('svg', {
      viewBox: `0 0 ${RADAR_SIZE} ${RADAR_SIZE}`,
      role: 'img',
      id: 'rbRadarSvg',
      'aria-label': `${T('Frontier model evaluation radar', '前沿模型评测雷达')} — ${radarCaptionText(radar)}`,
    });
    const centre = svg('g', { transform: `translate(${RADAR_SIZE / 2} ${RADAR_SIZE / 2})` });

    for (const ring of [0.25, 0.5, 0.75, 1]) {
      centre.appendChild(svg('circle', {
        r: RADAR_RADIUS * ring, fill: 'none', stroke: 'rgba(255,255,255,.09)', 'stroke-width': 1,
      }));
    }
    const axisPoints = radarAxisPoints(axisCount, RADAR_RADIUS);
    axisPoints.forEach((point, index) => {
      centre.appendChild(svg('line', {
        x1: 0, y1: 0, x2: point.x, y2: point.y, stroke: 'rgba(255,255,255,.12)', 'stroke-width': 1,
      }));
      const axis = radar.axes[index];
      const label = svg('text', {
        x: point.x * 1.14,
        y: point.y * 1.14 + 4,
        fill: '#9A97A0',
        'font-size': 13,
        'font-weight': 700,
        'text-anchor': Math.abs(point.x) < 1 ? 'middle' : (point.x > 0 ? 'start' : 'end'),
      });
      label.textContent = pick(axis, 'label');
      centre.appendChild(label);
      if (axis.extent) {
        const scale = svg('text', {
          x: point.x * 1.14,
          y: point.y * 1.14 + 20,
          fill: '#78787f',
          'font-size': 10.5,
          'text-anchor': Math.abs(point.x) < 1 ? 'middle' : (point.x > 0 ? 'start' : 'end'),
        });
        scale.textContent = `${formatValue(axis.extent.min, axis.unit)}–${formatValue(axis.extent.max, axis.unit)}`;
        centre.appendChild(scale);
      }
    });

    for (const series of radar.series) {
      const polygon = radarPolygon(series, axisCount, RADAR_RADIUS);
      const stroke = BLOC_STROKE[series.bloc] || BLOC_STROKE.neutral;
      // Segment-by-segment rather than one closed path: a null point must break
      // the outline instead of pulling it to the centre.
      for (let index = 0; index < polygon.length; index++) {
        const from = polygon[index];
        const to = polygon[(index + 1) % polygon.length];
        if (!from || !to) continue;
        centre.appendChild(svg('line', {
          x1: from.x, y1: from.y, x2: to.x, y2: to.y,
          stroke,
          'stroke-width': 2,
          // Stroke pattern duplicates the bloc encoding for colour-blind and
          // forced-colours users.
          'stroke-dasharray': series.bloc === 'CN' ? '7 5' : null,
          'stroke-linecap': 'round',
        }));
      }
      for (const point of polygon) {
        if (!point) continue;
        centre.appendChild(svg('circle', { cx: point.x, cy: point.y, r: 4, fill: stroke }));
      }
    }
    chart.appendChild(centre);
    figure.appendChild(chart);

    const caption = el('figcaption', null, radarCaptionText(radar));
    caption.id = 'rbRadarCaption';
    caption.setAttribute('aria-live', 'polite');
    figure.appendChild(caption);

    const side = el('div', 'rbRadarPicker');
    side.appendChild(el('p', 'rbPickerHint', T(
      `Compare up to ${MAX_SERIES} models. Solid outline: US bloc. Dashed: China bloc.`,
      `最多同时对比 ${MAX_SERIES} 个模型。实线为美国阵营，虚线为中国阵营。`,
    )));
    const list = el('div', 'rbPickerList');
    list.setAttribute('role', 'group');
    list.setAttribute('aria-label', T('Compare models', '对比模型'));
    for (const model of roster) {
      const button = el('button', null, model.name);
      button.type = 'button';
      button.dataset.modelId = model.id;
      button.style.setProperty('--pick', BLOC_STROKE[model.bloc] || BLOC_STROKE.neutral);
      const active = selection.includes(model.id);
      button.setAttribute('aria-pressed', String(active));
      // A model with nothing plottable is still listed, but says so.
      button.addEventListener('click', () => {
        if (selection.includes(model.id)) selection = selection.filter((id) => id !== model.id);
        else selection = [...selection, model.id].slice(-MAX_SERIES);
        renderRadar();
        hosts.radar.querySelector(`button[data-model-id="${model.id}"]`)?.focus();
      });
      list.appendChild(button);
    }
    side.appendChild(list);

    const axisNote = el('div', 'rbAxisNote');
    for (const axis of radar.axes) {
      const line = el('p', null, `${pick(axis, 'label')} — ${pick(axis, 'metric')}`);
      line.style.margin = '0 0 6px';
      axisNote.appendChild(line);
    }
    side.appendChild(axisNote);

    const layout = el('div', 'rbRadarLayout');
    layout.append(figure, side);
    host.appendChild(layout);
  }

  /* ── benchmark table ───────────────────────────────────────────────── */

  function renderTable() {
    const host = hosts.table;
    if (!host) return;
    host.replaceChildren();
    const { columns, rows } = buildTable(data);
    const ordered = sortRows(rows, sortColumn, sortDirection);

    const wrap = el('div', 'rbTableWrap');
    const table = el('table', 'rbTable');
    const caption = el('caption', null, T(
      'Complete benchmark, operational and pricing grid. Empty cells are deliberate: a column marked not published means no comparable figure exists for that model, and no value was estimated to fill it.',
      '完整的基准、运行与定价矩阵。空白单元格是有意留空：标记为「未公布」的列表示该模型没有可比数值，且不会以估算值填补。',
    ));
    table.appendChild(caption);

    const thead = el('thead');
    const headRow = el('tr');
    headRow.appendChild(el('th', null, T('Model', '模型')));
    headRow.firstChild.setAttribute('scope', 'col');
    for (const column of columns) {
      const th = el('th');
      th.setAttribute('scope', 'col');
      const sortable = !column.status;
      if (!sortable) {
        th.appendChild(el('span', null, pick(column, 'label')));
        th.appendChild(tierBadge(column.status, T('not published', '未公布')));
      } else {
        const button = el('button', null, pick(column, 'label'));
        button.type = 'button';
        const isActive = sortColumn === column.id;
        button.setAttribute('aria-sort', isActive ? (sortDirection === 'desc' ? 'descending' : 'ascending') : 'none');
        button.setAttribute('aria-label', T(
          `Sort by ${column.label_en}`,
          `按${column.label_zh}排序`,
        ));
        button.addEventListener('click', () => {
          if (sortColumn === column.id) sortDirection = sortDirection === 'desc' ? 'asc' : 'desc';
          else { sortColumn = column.id; sortDirection = column.higher_better === false ? 'asc' : 'desc'; }
          renderTable();
          hosts.table.querySelector(`button[aria-sort]:not([aria-sort="none"])`)?.focus();
        });
        th.appendChild(button);
      }
      headRow.appendChild(th);
    }
    headRow.appendChild(el('th', null, T('Note', '备注')));
    headRow.lastChild.setAttribute('scope', 'col');
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = el('tbody');
    for (const row of ordered) {
      const tr = el('tr');
      const nameCell = el('th');
      nameCell.setAttribute('scope', 'row');
      const name = el('div', 'rbName');
      name.append(
        blocBadge(row.bloc, row.bloc === 'CN' ? T('CN', '中') : T('US', '美')),
        el('span', null, row.name),
        tierBadge(row.route === 'open' ? 'reported' : 'pending', row.route === 'open' ? T('open weights', '开放权重') : T('closed API', '闭源 API')),
      );
      nameCell.appendChild(name);
      tr.appendChild(nameCell);
      for (const cell of row.cells) {
        const td = el('td');
        td.dataset.tier = cell.tier;
        const text = formatValue(cell.value, cell.unit);
        if (text === null) {
          const empty = el('span', 'rbEmpty', cell.tier === 'pending' ? '—' : T('n/a', '不适用'));
          if (cell.note_en) empty.title = pick(cell, 'note');
          td.appendChild(empty);
        } else {
          td.appendChild(el('span', null, text));
        }
        tr.appendChild(td);
      }
      const noteCell = el('td', 'rbNotes', pick(row, 'notes'));
      tr.appendChild(noteCell);
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    wrap.appendChild(table);
    host.appendChild(wrap);

    const key = el('div', 'rbColKey');
    for (const column of columns) {
      if (!column.status) continue;
      const line = el('p');
      line.style.margin = '0';
      line.append(el('b', null, `${pick(column, 'label')} · ${column.status.replace(/_/g, ' ')}`), document.createTextNode(` ${pick(column, 'note')}`));
      key.appendChild(line);
    }
    const counts = countTiers(data);
    key.appendChild(el('p', null, T(
      `Provenance mix: ${counts.verified} verified, ${counts.reported} reported, ${counts.estimate} estimate, ${counts.pending} pending.`,
      `溯源构成：${counts.verified} 项一手核验、${counts.reported} 项二手报道、${counts.estimate} 项编辑估算、${counts.pending} 项未公布。`,
    )));
    host.appendChild(key);
  }

  /* ── equity boards ─────────────────────────────────────────────────── */

  function boardSection(side, items) {
    const board = el('section', 'rbBoard');
    board.dataset.bloc = side;
    const head = el('h3', 'rbBoardHead');
    head.append(
      document.createTextNode(side === 'US'
        ? T('US AI board · Top 10', '美国 AI 榜 · 十强')
        : T('China AI board · Top 10', '中国 AI 榜 · 十强')),
      el('small', null, side === 'US'
        ? T('NASDAQ / NYSE listings', '纳斯达克 / 纽交所上市')
        : T('A-share (SSE / SZSE) and HKEX listings', 'A 股（沪深）与港交所上市')),
    );
    board.appendChild(head);
    const maxConviction = Math.max(...items.map((item) => item.conviction.value), 1);
    items.forEach((item, index) => {
      const row = el('div', 'rbRow');
      row.appendChild(el('div', 'rbRank', String(index + 1)));
      const rowHead = el('div', 'rbRowHead');
      rowHead.append(
        el('span', 'rbTicker', item.ticker),
        el('span', 'rbExch', item.exchange),
        el('span', 'rbLayer', item.layer),
      );
      const conviction = el('div', 'rbConv');
      const bar = el('div', 'rbConvBar');
      const fill = el('i');
      fill.style.setProperty('--w', `${Math.round((item.conviction.value / maxConviction) * 100)}%`);
      fill.style.setProperty('--barColor', side === 'US' ? BLOC_STROKE.US : BLOC_STROKE.CN);
      bar.appendChild(fill);
      conviction.append(
        el('span', null, T('desk weight', '台面权重')),
        bar,
        el('b', null, `${item.conviction.value}`),
        tierBadge(item.conviction.tier, T('estimate', '估算')),
      );
      rowHead.appendChild(conviction);
      row.appendChild(rowHead);
      row.appendChild(el('p', null, pick(item, 'thesis')));
      if (item.kpis.length) {
        const kpis = el('div', 'rbKpis');
        for (const kpi of item.kpis) {
          const chip = el('span', 'rbKpi');
          chip.append(el('span', null, pick(kpi, 'label')), document.createTextNode(kpi.value));
          if (kpi.src) {
            const link = el('a', null, '↗');
            link.href = kpi.src;
            link.target = '_blank';
            link.rel = 'noopener';
            link.setAttribute('aria-label', T(`Source for ${kpi.label_en}`, `${kpi.label_zh}的来源`));
            chip.appendChild(link);
          }
          kpis.appendChild(chip);
        }
        row.appendChild(kpis);
      }
      const risk = el('p', 'rbRisk');
      risk.append(el('b', null, T('Key risk', '关键风险')), document.createTextNode(pick(item, 'risk')));
      row.appendChild(risk);
      board.appendChild(row);
    });
    board.appendChild(el('p', 'rbBoardNote', side === 'US'
      ? T('Desk weights are the operator\'s own conviction, not a model output and not a recommendation.',
        '台面权重是操作者本人的信念度，不是模型输出，也不构成推荐。')
      : T('A-share and HKEX access differs by account type (Connect / QDII eligibility). Stated as fact, not as advice.',
        'A 股与港股的可交易范围因账户类型而异（互联互通 / QDII 资格）。此为事实说明，不构成建议。')));
    return board;
  }

  function renderBoards() {
    const host = hosts.boards;
    if (!host) return;
    host.replaceChildren();
    const boards = buildBoards(data);
    const wrap = el('div', 'rbBoards');
    wrap.append(boardSection('US', boards.US), boardSection('CN', boards.CN));
    host.appendChild(wrap);
  }

  /* ── scoreboard ────────────────────────────────────────────────────── */

  function renderScoreboard() {
    const host = hosts.scoreboard;
    if (!host) return;
    host.replaceChildren();
    const board = buildScoreboard(data.scoreboard);

    const totals = el('div', 'rbScoreTotals');
    const usTotal = el('div', 'rbTotal');
    usTotal.dataset.bloc = 'US';
    usTotal.append(el('span', null, T('US ecosystem', '美国生态')), el('b', null, board.us.toFixed(1)));
    const cnTotal = el('div', 'rbTotal');
    cnTotal.dataset.bloc = 'CN';
    cnTotal.append(el('span', null, T('China ecosystem', '中国生态')), el('b', null, board.cn.toFixed(1)));
    totals.append(usTotal, el('div', 'rbTotalDivide'), cnTotal);
    host.appendChild(totals);

    for (const axis of board.axes) {
      const row = el('div', 'rbAxisRow');
      const head = el('div', 'rbAxisHead');
      head.append(
        el('h3', null, pick(axis, 'label')),
        el('span', 'rbAxisWeight', T(`weight ${Math.round(axis.weight * 100)}%`, `权重 ${Math.round(axis.weight * 100)}%`)),
        tierBadge(axis.tier),
        blocBadge(axis.lead === 'tie' ? 'neutral' : axis.lead, axis.lead === 'tie'
          ? T('level', '持平')
          : T(`${axis.lead} leads by ${axis.gap}`, `${axis.lead === 'US' ? '美方' : '中方'}领先 ${axis.gap}`)),
      );
      row.appendChild(head);

      const bars = el('div', 'rbAxisBars');
      for (const side of ['US', 'CN']) {
        const bar = el('div', 'rbAxisBar');
        bar.dataset.bloc = side;
        const track = el('div');
        const fill = el('i');
        fill.style.setProperty('--w', `${side === 'US' ? axis.us : axis.cn}%`);
        track.appendChild(fill);
        bar.append(el('b', null, String(side === 'US' ? axis.us : axis.cn)), track);
        bars.appendChild(bar);
      }
      row.appendChild(bars);

      const method = el('p', 'rbAxisMethod');
      method.append(el('b', null, T('Method', '方法')), document.createTextNode(pick(axis, 'method')));
      row.appendChild(method);
      const evidence = el('p', 'rbAxisMethod');
      evidence.append(el('b', null, T('Evidence', '证据')), document.createTextNode(pick(axis, 'evidence')));
      if (axis.src) {
        const link = el('a', null, T(' Source ↗', ' 来源 ↗'));
        link.href = axis.src;
        link.target = '_blank';
        link.rel = 'noopener';
        evidence.appendChild(link);
      }
      row.appendChild(evidence);
      host.appendChild(row);
    }

    const weightsNote = el('p', 'rbAxisMethod');
    weightsNote.append(el('b', null, T('Weighting', '权重说明')), document.createTextNode(pick(data.scoreboard, 'weights_note')));
    host.appendChild(weightsNote);

    const outlook = el('div', 'rbOutlook');
    outlook.append(el('b', null, T('Outlook — both cases stated', '前景展望 · 双向论证')), document.createTextNode(pick(data.scoreboard, 'outlook')));
    host.appendChild(outlook);
  }

  function render() {
    renderRadar();
    renderTable();
    renderBoards();
    renderScoreboard();
  }

  render();
  return { render, destroy() { for (const host of Object.values(hosts)) host?.replaceChildren(); } };
}
