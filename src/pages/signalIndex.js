import { fetchJson } from '../lib/fetchJson.js';
import { SIGNAL_TOPICS, SIGNAL_STATUSES, SIGNAL_INDUSTRIES, filterSignalRecords, signalEvidenceAge, nextSignalReleases } from '../lib/signalIndexModel.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const lang = () => window.AfflatusI18N?.get() === 'zh' ? 'zh' : 'en';
const copy = (en, zh) => lang() === 'zh' ? zh : en;
const local = value => value?.[lang()] ?? '';
const date = value => new Intl.DateTimeFormat(lang() === 'zh' ? 'zh-CN' : 'en-AU', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
const sourceLink = (url, label) => `<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(label)} <span aria-hidden="true">↗</span></a>`;
const badge = event => `<span class="record-badge topic-${escape(event.topic)}">${escape(local(SIGNAL_TOPICS[event.topic]))}</span>`;

export function mountPolicyIndex() {
  const list = document.getElementById('record-list');
  if (!list) return;
  const state = { topic: 'all', month: 'all', industry: 'all', query: '', view: 'cards', limit: 9 };
  const search = document.getElementById('record-search');
  const month = document.getElementById('record-month');
  const industry = document.getElementById('record-industry');
  let data;

  function renderRecords() {
    if (!data) return;
    const records = filterSignalRecords(data.events, state);
    document.getElementById('record-count').textContent = copy(`${records.length} of ${data.events.length} records`, `${data.events.length} 条资料中显示 ${records.length} 条`);
    document.querySelectorAll('[data-topic]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.topic === state.topic)));
    document.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === state.view)));
    list.hidden = state.view !== 'cards';
    const table = document.getElementById('record-table');
    table.hidden = state.view !== 'table';
    const visible = records.slice(0, state.limit);
    list.innerHTML = visible.map(event => `<article class="record-card" id="${escape(event.id)}">
      <div class="record-meta">${badge(event)}<time datetime="${escape(event.date)}">${date(event.date)}</time></div>
      <h3>${escape(local(event.name))}</h3><p class="record-agency">${escape(event.agency)} · ${escape(local(SIGNAL_STATUSES[event.status]))}</p>
      <p class="record-fact">${escape(local(event.print))}</p>
      <details><summary>${copy('AI implications & evidence', 'AI 影响与证据')}</summary><div class="record-detail">
        <h4>${copy('Conditional AI transmission', '条件性 AI 传导')}</h4><p>${escape(local(event.industryTransmission))}</p>
        <h4>${copy('Market evidence', '市场证据')}</h4><p>${escape(local(event.marketWindow))}</p><p>${escape(local(event.repricing))}</p><p>${escape(local(event.equityReaction))}</p>
        <h4>${copy('What to follow', '后续观察')}</h4><p>${escape(local(event.verdict))}</p>
        <div class="record-sources">${event.marketSources.filter(s => s.url !== event.source).map(s => sourceLink(s.url, lang() === 'zh' ? s.label_zh : s.label_en)).join('')}</div>
      </div></details><div class="record-footer">${sourceLink(event.source, copy('Primary source', '原始来源'))}</div>
    </article>`).join('');
    const empty = copy('No records match these filters. Try another month or clear the filters.', '没有符合条件的资料。可选择其他月份或清除筛选。');
    if (!records.length) list.innerHTML = `<p class="empty-records">${empty}</p>`;
    table.innerHTML = `<table><caption>${copy('Filtered policy records', '筛选后的政策资料')}</caption><thead><tr>${[copy('Date', '日期'), copy('Record', '资料'), copy('Topic', '主题'), copy('Status', '状态'), copy('Source', '来源')].map(x => `<th scope="col">${x}</th>`).join('')}</tr></thead><tbody>${records.map(event => `<tr><td><time datetime="${escape(event.date)}">${event.date}</time></td><th scope="row">${escape(local(event.name))}</th><td>${escape(local(SIGNAL_TOPICS[event.topic]))}</td><td>${escape(local(SIGNAL_STATUSES[event.status]))}</td><td>${sourceLink(event.source, event.agency)}</td></tr>`).join('')}</tbody></table>${records.length ? '' : `<p class="empty-records">${empty}</p>`}`;
    document.getElementById('load-records').hidden = state.view !== 'cards' || records.length <= state.limit;
    document.getElementById('reset-records').hidden = state.topic === 'all' && state.month === 'all' && state.industry === 'all' && !state.query;
  }

  function renderOverview() {
    const checked = data.checked_at || data.updated;
    document.querySelectorAll('[data-index-updated]').forEach(node => { node.textContent = copy('Checked: ', '核验日期：') + date(checked); });
    const status = document.querySelector('[data-index-status]');
    const evidence = signalEvidenceAge(checked);
    status.dataset.evidenceState = evidence;
    status.textContent = evidence === 'reviewed'
      ? copy(`Primary sources checked ${date(checked)} · Weekly review`, `一手来源核验于 ${date(checked)} · 每周汇总`)
      : copy(`Historical snapshot · Last checked ${date(checked)}. A new source review is due.`, `历史快照 · 上次核验 ${date(checked)}，等待新一轮来源检查。`);
    document.querySelector('[data-coverage-note]').textContent = local(data.coverage_note);
    document.querySelector('.signal-hero-art').alt = copy('Bank, computing and energy connected in an editorial illustration', '银行、计算与能源相连接的原创插画');
    const rate = data.overview.policyRate;
    const decisions = data.events.filter(event => event.rate).sort((a, b) => a.date.localeCompare(b.date));
    const metrics = [
      [copy('Federal funds target', '联邦基金目标区间'), `${rate.lower.toFixed(2)}–${rate.upper.toFixed(2)}%`, `${copy('Decision', '决议')} · ${date(rate.date)}`],
      [copy('FOMC decisions', 'FOMC 决议'), String(decisions.length).padStart(2, '0'), `${date(decisions[0].date)} → ${date(decisions.at(-1).date)}`],
      [copy('Primary records', '一手资料'), String(data.events.length), copy('Bilingual · dated · sourced', '双语 · 注明日期 · 可溯源')],
    ];
    document.getElementById('index-metrics').innerHTML = metrics.map(([label, value, note]) => `<div><p>${label}</p><strong>${value}</strong><small>${note}</small></div>`).join('');
    document.getElementById('index-summary').innerHTML = `<p>${escape(local(data.overview.summary))}</p>${sourceLink(rate.source, copy('Latest FOMC statement', '最近一次 FOMC 声明'))}`;
    document.getElementById('fomc-decisions').innerHTML = decisions.map(event => {
      const change = `${event.rate.changeBps > 0 ? '+' : ''}${event.rate.changeBps}`;
      return `<a class="decision-item" href="${escape(event.source)}" target="_blank" rel="noopener noreferrer"><time datetime="${event.date}">${date(event.date)}</time><strong>${event.rate.lower.toFixed(2)}–${event.rate.upper.toFixed(2)}%</strong><span>${event.rate.changeBps ? copy(`${change} bp`, `${change} 基点`) : copy('Hold', '维持')} · ${escape(event.rate.vote)} <span aria-hidden="true">↗</span></span></a>`;
    }).join('');
    renderChart(decisions);
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const today = ['year', 'month', 'day'].map(type => parts.find(part => part.type === type).value).join('-');
    const next = nextSignalReleases(data.schedule, today);
    document.getElementById('next-releases').innerHTML = `<h3>${copy('Next official checkpoints', '下一个官方观察节点')}</h3>${next.length ? next.slice(0, 3).map(item => `<p><time datetime="${item.date}">${date(item.date)}</time>${sourceLink(item.source, local(item.name))}</p>`).join('') : `<p>${copy('No future date has been verified in this snapshot. Check the official FOMC calendar.', '本快照暂无已核实的未来日期，请查看官方FOMC日历。')}</p>`}`;
    const policyRecords = filterSignalRecords(data.events);
    const highlights = [
      policyRecords.find(event => event.topic === 'fiscal' && event.agency === 'Treasury'),
      policyRecords.find(event => event.topic === 'fiscal' && event.agency !== 'Treasury'),
      policyRecords.find(event => event.topic === 'government'),
    ].filter(Boolean);
    document.getElementById('policy-highlights').innerHTML = highlights.map(event => `<article>${badge(event)}<h3>${escape(local(event.name))}</h3><p>${escape(local(event.print))}</p><small>${escape(local(SIGNAL_STATUSES[event.status]))} · ${date(event.date)}</small>${sourceLink(event.source, copy('Read the document', '查看文件'))}</article>`).join('');
    document.getElementById('industry-tiles').innerHTML = Object.entries(SIGNAL_INDUSTRIES).map(([key, value]) => {
      const records = data.events.filter(event => event.sectors.includes(key));
      return `<button type="button" data-industry-shortcut="${key}"><span class="industry-title">${escape(local(value.name))}</span><span class="industry-read">${escape(local(value.read))}</span><span class="data-tiles" aria-hidden="true">${records.map(event => `<i class="topic-${escape(event.topic)}"></i>`).join('')}</span><span class="industry-count">${records.length} ${copy('records', '条资料')} <span aria-hidden="true">→</span></span></button>`;
    }).join('');
    month.innerHTML = `<option value="all">${copy('All months', '全部月份')}</option>` + [...new Set(data.events.map(event => event.date.slice(0, 7)))].sort().reverse().map(value => `<option value="${value}">${value}</option>`).join('');
    month.value = state.month;
    industry.innerHTML = `<option value="all">${copy('All industries', '全部产业')}</option>` + Object.entries(SIGNAL_INDUSTRIES).map(([key, value]) => `<option value="${key}">${escape(local(value.name))}</option>`).join('');
    industry.value = state.industry;
  }

  function renderChart(decisions) {
    const width = 800, height = 210, left = 52, top = 24, bottom = 166;
    const minDate = Date.parse(decisions[0].date), maxDate = Date.parse(decisions.at(-1).date);
    const values = decisions.map(event => event.rate.upper);
    const minimum = Math.floor(Math.min(...values) * 4) / 4 - 0.5;
    const maximum = Math.ceil(Math.max(...values) * 4) / 4 + 0.25;
    const x = event => left + (Date.parse(event.date) - minDate) / (maxDate - minDate || 1) * 702;
    const y = value => bottom - (value - minimum) / (maximum - minimum) * (bottom - top);
    let path = `M ${x(decisions[0])} ${y(decisions[0].rate.upper)}`;
    decisions.slice(1).forEach(event => { path += ` H ${x(event)} V ${y(event.rate.upper)}`; });
    const step = Math.max(0.25, Math.ceil((maximum - minimum) / 4 * 4) / 4);
    const labels = Array.from({ length: Math.floor((maximum - minimum) / step) + 1 }, (_, i) => minimum + i * step);
    const description = decisions.map(event => `${event.date}: ${event.rate.upper.toFixed(2)}%`).join('; ');
    document.getElementById('rate-chart').innerHTML = `<p class="chart-label">${copy('Federal funds target · upper bound (%)', '联邦基金目标利率 · 上限（%）')}</p><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escape(copy('Target upper bound by decision date: ', '各决议日期的目标上限：') + description)}">${labels.map(value => `<line x1="${left}" x2="770" y1="${y(value)}" y2="${y(value)}" class="chart-grid"/><text x="0" y="${y(value) + 4}">${value.toFixed(2)}</text>`).join('')}<path d="${path}" class="rate-line"/>${decisions.map(event => `<circle cx="${x(event)}" cy="${y(event.rate.upper)}" r="5" class="rate-point"/><text x="${x(event)}" y="197" text-anchor="middle">${event.date.slice(5).replace('-', '/')}</text>`).join('')}</svg><p class="chart-note">${copy('Policy target, not a market yield. Spacing follows actual decision dates.', '政策目标利率，不是市场收益率。横轴间距按实际决议日期绘制。')}</p>`;
  }

  function applyFilter() { state.limit = 9; renderRecords(); }
  document.querySelectorAll('[data-topic]').forEach(button => button.addEventListener('click', () => { state.topic = button.dataset.topic; applyFilter(); }));
  document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => { state.view = button.dataset.view; renderRecords(); }));
  search.addEventListener('input', () => { state.query = search.value; applyFilter(); });
  month.addEventListener('change', () => { state.month = month.value; applyFilter(); });
  industry.addEventListener('change', () => { state.industry = industry.value; applyFilter(); });
  document.getElementById('load-records').addEventListener('click', () => { state.limit += 9; renderRecords(); });
  document.getElementById('reset-records').addEventListener('click', () => {
    Object.assign(state, { topic: 'all', month: 'all', industry: 'all', query: '', limit: 9 });
    search.value = ''; month.value = 'all'; industry.value = 'all'; renderRecords();
  });
  document.addEventListener('click', event => {
    const tile = event.target.closest('[data-industry-shortcut]');
    const topic = event.target.closest('[data-topic-shortcut]');
    if (!tile && !topic) return;
    Object.assign(state, { topic: topic?.dataset.topicShortcut || 'all', month: 'all', industry: tile?.dataset.industryShortcut || 'all', query: '', limit: 9 });
    search.value = ''; month.value = 'all'; industry.value = state.industry; renderRecords();
    location.hash = 'ch03';
  });
  const sections = [...document.querySelectorAll('.signal-content .index-section[id], #treasuryYieldBoard')];
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      const visible = entries.find(entry => entry.isIntersecting);
      if (visible) document.querySelectorAll('.signal-sidebar nav a').forEach(link => {
        if (link.hash === `#${visible.target.id}`) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }, { rootMargin: '-90px 0px -55% 0px' });
    sections.forEach(section => observer.observe(section));
  }

  window.addEventListener('afflatus-lang', () => { if (data) { renderOverview(); renderRecords(); } });
  fetchJson('signal').then(payload => {
    data = payload; renderOverview(); renderRecords();
  }).catch(() => {
    document.querySelector('[data-index-status]').textContent = copy('Research data is unavailable. Reload the page or open the official sources below.', '研究数据暂不可用，请刷新页面或查看下方官方来源。');
  });
}
