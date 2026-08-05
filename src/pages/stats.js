import './statsLibs.js';
import { mountTermGlossary } from '../lib/termGlossary.js';
import { pick } from '../lib/i18nData.js';
import { fetchJson } from '../lib/fetchJson.js';
import { createLatestWorkerTask } from '../lib/latestWorkerTask.js';
import {
  createMsiArchive,
  createWorldCupArchive,
  normalizePersonName,
} from '../lib/stats/archiveAdapters.js';
import {
  bootstrapDistribution,
  brierScore,
  exactBinomialTwoSided,
  formatPercent,
  summarizeRecords,
  wilsonInterval,
} from '../lib/stats/statistics.js';
import {
  renderBootstrapHistogram,
  renderCalibrationChart,
  renderCumulativeChart,
  renderOutcomeBars,
  renderThresholdReadout,
  STATS_PALETTE,
} from '../lib/stats/chartViews.js';
import statsBootstrapWorkerUrl from '../workers/statsBootstrap.worker.js?worker&url';

const reducedMotion = (() => {
  try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
})();
const isChinese = () => (document.documentElement.lang || '').startsWith('zh');
const currentLanguage = () => (isChinese() ? 'zh' : 'en');
const element = (tag, className, html) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html != null) node.innerHTML = html;
  return node;
};
const escapeHtml = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');
const bilingualNode = (node, en, zh) => {
  node.dataset.en = en;
  node.dataset.zh = zh;
  node.textContent = isChinese() ? zh : en;
  return node;
};
const applyI18n = () => {
  try { window.AfflatusI18N?.apply(); } catch {}
};

const termGlossaryController = mountTermGlossary({
  getLang: () => window.AfflatusI18N?.get?.() || 'en',
});

const tooltip = document.getElementById('tip');
function showTooltip(html, event) {
  tooltip.innerHTML = html;
  tooltip.classList.add('show');
  tooltip.setAttribute('aria-hidden', 'false');
  tooltip.style.left = `${Math.min(event.clientX + 14, innerWidth - 300)}px`;
  tooltip.style.top = `${Math.min(event.clientY + 14, innerHeight - 120)}px`;
}
function hideTooltip() {
  tooltip.classList.remove('show');
  tooltip.setAttribute('aria-hidden', 'true');
}

function revealCards() {
  const cards = document.querySelectorAll('.chart-card');
  if (reducedMotion || !('IntersectionObserver' in window)) {
    cards.forEach((card) => card.classList.add('in'));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('in');
      observer.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -8% 0px' });
  cards.forEach((card) => observer.observe(card));
}

function appendStat(strip, {
  target,
  suffix = '',
  decimals = null,
  en,
  zh,
  className = '',
}) {
  const wrapper = element('div', `stat${className ? ` ${className}` : ''}`);
  const value = element('b');
  wrapper.append(value, bilingualNode(element('small'), en, zh));
  strip.appendChild(wrapper);
  // Statistics are claims, not decoration. Paint the settled value on the
  // first frame so screenshots, assistive tech and quick scans never observe
  // an animated but numerically false intermediate result.
  value.textContent = `${decimals == null ? target : target.toFixed(decimals)}${suffix}`;
}

function renderSummaryStrip(archive) {
  const strip = document.getElementById(`${archive.id}Strip`);
  strip.replaceChildren();
  const detailed = summarizeRecords(archive.scored);
  const headline = archive.id === 'wc'
    ? {
        total: archive.headline.total,
        successes: archive.headline.successes,
        exact: archive.headline.exact,
        hitRate: archive.headline.total ? archive.headline.successes / archive.headline.total : 0,
        interval: wilsonInterval(archive.headline.successes, archive.headline.total),
        pValue: exactBinomialTwoSided(archive.headline.successes, archive.headline.total),
      }
    : detailed;
  const skill = detailed.brierSkill;
  const isWorldCup = archive.id === 'wc';

  appendStat(strip, {
    target: headline.total,
    en: isWorldCup ? 'matches resolved — full tournament' : 'series resolved',
    zh: isWorldCup ? '已判定 — 整届赛事' : '已判定系列赛',
  });
  appendStat(strip, {
    target: Math.round(headline.hitRate * 100),
    suffix: '%',
    en: `outcome hit rate — ${headline.successes}/${headline.total} · Wilson 95%: ${formatPercent(headline.interval[0])}–${formatPercent(headline.interval[1])}`,
    zh: `胜负命中率 — ${headline.successes}/${headline.total} · Wilson 95%：${formatPercent(headline.interval[0])}–${formatPercent(headline.interval[1])}`,
  });
  appendStat(strip, {
    target: headline.exact,
    en: isWorldCup ? 'exact scorelines — full tournament' : 'exact scorelines',
    zh: isWorldCup ? '比分全中 — 整届赛事' : '比分全中',
    className: 'gold',
  });
  appendStat(strip, {
    target: detailed.brier || 0,
    decimals: 3,
    en: isWorldCup
      ? `Brier score, knockout stage only (n=${detailed.total}) · skill ${skill >= 0 ? '+' : ''}${formatPercent(skill || 0)}`
      : `Brier score (0.25 = coin flip) · skill ${skill >= 0 ? '+' : ''}${formatPercent(skill || 0)}`,
    zh: isWorldCup
      ? `Brier 评分，仅淘汰赛阶段 (n=${detailed.total})· 技能分 ${skill >= 0 ? '+' : ''}${formatPercent(skill || 0)}`
      : `Brier 评分（0.25 = 抛硬币）· 技能分 ${skill >= 0 ? '+' : ''}${formatPercent(skill || 0)}`,
    className: skill < 0 ? 'warn' : '',
  });
  appendStat(strip, {
    target: headline.pValue,
    decimals: 2,
    en: isWorldCup
      ? 'exact binomial p vs. coin flip, full tournament'
      : 'exact binomial p vs. coin flip — not significant; n is far too small to claim skill',
    zh: isWorldCup
      ? '对抛硬币的精确二项检验 p 值，整届赛事'
      : '对抛硬币的精确二项检验 p 值——不显著；n 太小，尚不能声称「有技术含量」',
    className: 'warn',
  });
}

function msiDisplay(record) {
  const source = record.source;
  return {
    round: pick(source, 'round', currentLanguage()),
    match: `${source.home} vs ${source.away}`,
    shortMatch: `${source.home}·${source.away}`,
    call: `${pickedTeamForMsi(source)} ${source.opusScore || ''}`.trim(),
    result: `${source.result.home}-${source.result.away}`,
    reason: pick(source, 'reason', currentLanguage()) || '',
  };
}

function pickedTeamForMsi(series) {
  return series.opus === 'home' ? series.home : series.away;
}

function worldCupDisplay(record) {
  const source = record.source;
  const language = currentLanguage();
  const pickedSide = source.opus === 'home' ? 'home' : 'away';
  return {
    round: pick(source, 'round', language),
    match: `${pick(source, 'home', language)} vs ${pick(source, 'away', language)}`,
    shortMatch: `${source.home}·${source.away}`,
    call: `${pick(source, pickedSide, language)} ${source.opusScore || ''}`.trim(),
    result: `${source.result.home}-${source.result.away}${source.extra ? ` ${source.extra}` : ''}`,
    reason: pick(source, 'reason', language) || '',
  };
}

function displayFor(archive, record) {
  return archive.id === 'msi' ? msiDisplay(record) : worldCupDisplay(record);
}

function openDrawer(archive, record) {
  const display = displayFor(archive, record);
  const drawer = document.getElementById(`${archive.id}Drawer`);
  const resultMark = record.ok ? (record.exact ? '⭐' : '✓') : '✗';
  drawer.innerHTML = `<div class="hd">${escapeHtml(display.round)} — ${escapeHtml(display.match)}
    · ${isChinese() ? '预测' : 'call'}: ${escapeHtml(display.call)} @ ${Math.round(record.conf * 100)}%
    · ${isChinese() ? '结果' : 'result'}: ${escapeHtml(display.result)} ${resultMark}</div>
    <div class="rsn">${escapeHtml(display.reason)}</div>`;
  drawer.classList.add('show');
  drawer.scrollIntoView({ block: 'nearest', behavior: reducedMotion ? 'auto' : 'smooth' });
}

function tooltipHtml(archive, record) {
  const display = displayFor(archive, record);
  const resultMark = record.ok ? (record.exact ? '⭐' : '✓') : '✗';
  return `<b>${escapeHtml(display.match)}</b><br>
    ${isChinese() ? '预测' : 'call'}: ${escapeHtml(display.call)} @ ${Math.round(record.conf * 100)}%<br>
    ${isChinese() ? '结果' : 'result'}: ${escapeHtml(display.result)} ${resultMark}<br>
    <span style="color:${STATS_PALETTE.dim}">${isChinese() ? '点击看当时判断依据' : 'click for the original reasoning'}</span>`;
}

function renderSharedCharts(archive) {
  const title = archive.id === 'msi' ? 'MSI' : 'World Cup';
  renderOutcomeBars(document.getElementById(`${archive.id}Bars`), archive.scored, {
    ariaLabel: `${title} per-${archive.id === 'msi' ? 'series' : 'match'} confidence and outcomes`,
    itemLabel: (record) => displayFor(archive, record).shortMatch,
    actionLabel: (record) => {
      const display = displayFor(archive, record);
      return `${isChinese() ? '打开' : 'Open'} ${display.match}, ${Math.round(record.conf * 100)}%, ${record.ok ? (isChinese() ? '判对' : 'correct') : (isChinese() ? '判错' : 'wrong')}`;
    },
    onActivate: (record) => { hideTooltip(); openDrawer(archive, record); },
    onPointerMove: (record, event) => showTooltip(tooltipHtml(archive, record), event),
    onPointerLeave: hideTooltip,
    reducedMotion,
  });
  renderCumulativeChart(document.getElementById(`${archive.id}Curve`), archive.scored, {
    id: archive.id,
    ariaLabel: `${title} cumulative hit rate and Wilson confidence interval`,
    reducedMotion,
  });
  renderCalibrationChart(document.getElementById(`${archive.id}Calib`), archive.scored, {
    ariaLabel: `${title} reliability calibration diagram`,
  });
}

function wireThreshold(archive) {
  const slider = document.getElementById(archive.id === 'msi' ? 'thSlider' : 'wcThSlider');
  const value = document.getElementById(archive.id === 'msi' ? 'thVal' : 'wcThVal');
  const readout = document.getElementById(archive.id === 'msi' ? 'thReadout' : 'wcThReadout');
  const render = () => {
    value.textContent = `${slider.value}%`;
    renderThresholdReadout(readout, archive.scored, Number(slider.value) / 100, {
      bilingualNode,
      applyI18n,
    });
  };
  slider.oninput = render;
  render();
}

const bootstrapRunners = {
  msi: createLatestWorkerTask(statsBootstrapWorkerUrl),
  wc: createLatestWorkerTask(statsBootstrapWorkerUrl),
};
const bootstrapEpochs = { msi: 0, wc: 0 };

function wireBootstrap(archive) {
  const button = document.getElementById(archive.id === 'msi' ? 'bootBtn' : 'wcBootBtn');
  const output = document.getElementById(archive.id === 'msi' ? 'bootHist' : 'wcBootHist');
  bootstrapRunners[archive.id].cancel('archive-rerendered');
  const seed = `${archive.id}-2026-track-record-v1`;
  button.onclick = async () => {
    const epoch = ++bootstrapEpochs[archive.id];
    button.setAttribute('aria-busy', 'true');
    output.textContent = isChinese() ? '正在后台重采样……' : 'Resampling off the main thread…';
    try {
      let result;
      try {
        result = await bootstrapRunners[archive.id].run('bootstrap', {
          outcomes: archive.scored.map((record) => record.ok),
          iterations: 2000,
          seed,
        });
      } catch (error) {
        if (error?.name === 'AbortError') throw error;
        result = bootstrapDistribution({
          outcomes: archive.scored.map((record) => record.ok),
          iterations: 2000,
          seed,
        });
      }
      if (epoch !== bootstrapEpochs[archive.id]) return;
      renderBootstrapHistogram(output, result, {
        label: archive.id === 'msi'
          ? 'MSI bootstrap hit-rate distribution, 95% interval'
          : 'World Cup bootstrap hit-rate distribution, 95% interval',
      });
    } catch (error) {
      if (error?.name !== 'AbortError') {
        output.textContent = isChinese() ? '重采样失败，请重试。' : 'Bootstrap failed — try again.';
      }
    } finally {
      if (epoch === bootstrapEpochs[archive.id]) button.removeAttribute('aria-busy');
    }
  };
}

function renderProbabilityBoard(container, entries, {
  name,
  actual,
  winner,
  winnerGlyph,
}) {
  container.replaceChildren();
  entries.forEach((entry) => {
    const isWinner = actual ? winner(entry, actual) : false;
    const row = element('div', `pick-row${actual ? (isWinner ? ' won' : ' lost') : ''}`);
    row.appendChild(element('span', 'who', `${escapeHtml(name(entry))}${isWinner ? ` ${winnerGlyph}` : ''}`));
    const bar = element('div', 'bar', '<i></i>');
    row.append(bar, element('span', 'pct', `${entry.prob}%`));
    container.appendChild(row);
    requestAnimationFrame(() => { bar.firstElementChild.style.width = `${entry.prob}%`; });
  });
}

function renderBoards(archive) {
  const { data } = archive;
  if (archive.id === 'msi') {
    renderProbabilityBoard(document.getElementById('msiChamps'), data.champion || [], {
      name: (entry) => entry.team,
      actual: archive.actualChampion,
      winner: (entry, actual) => entry.team === actual,
      winnerGlyph: '🏆',
    });
    if (archive.actualChampion) {
      bilingualNode(
        document.getElementById('msiChampNote'),
        `Stated before the Grand Final. Actual champion: ${archive.actualChampion}.`,
        `总决赛开打前给出的概率。实际冠军：${archive.actualChampion}。`,
      );
    }
    const mvpContainer = document.getElementById('msiMvps');
    renderProbabilityBoard(mvpContainer, data.mvp || [], {
      name: (entry) => entry.team,
      actual: archive.actualMvp,
      winner: (entry, actual) => archive.matchesMvp(entry, actual),
      winnerGlyph: '✓',
    });
    if (archive.actualMvp) {
      mvpContainer.appendChild(bilingualNode(
        element('p', 'note'),
        `Actual Finals MVP: ${archive.actualMvp}.`,
        `实际总决赛 MVP：${archive.actualMvp}。`,
      ));
    } else {
      mvpContainer.appendChild(bilingualNode(
        element('p', 'note'),
        'Official Finals MVP pending in the data file.',
        '官方决赛 MVP 待数据文件更新。',
      ));
    }
    return;
  }

  renderProbabilityBoard(document.getElementById('wcChamps'), data.championsPreFinal || [], {
    name: (entry) => pick(entry, 'team', currentLanguage()),
    actual: archive.actualChampion,
    winner: (entry, actual) => entry.team === actual,
    winnerGlyph: '🏆',
  });
  if (archive.actualChampion) {
    bilingualNode(
      document.getElementById('wcChampNote'),
      `Stated before the Final. Actual champion: ${archive.actualChampion}.`,
      `决赛开打前给出的概率。实际冠军：${archive.actualChampion}。`,
    );
  }
  renderProbabilityBoard(document.getElementById('wcMvps'), data.playersPreFinal || [], {
    name: (entry) => pick(entry, 'name', currentLanguage()),
    actual: archive.actualMvp,
    winner: (entry, actual) => normalizePersonName(entry.name) === normalizePersonName(actual),
    winnerGlyph: '🏆',
  });
  if (archive.actualMvp) {
    bilingualNode(
      document.getElementById('wcMvpNote'),
      `Stated before the Final. Actual Golden Ball: ${archive.actualMvp}.${data.goldenBoot ? ` (Golden Boot — a separate award — went to ${data.goldenBoot}, not tracked on this board.)` : ''}`,
      `决赛开打前给出的概率。实际金球奖得主：${archive.actualMvp}。${data.goldenBoot ? `（金靴奖是另一个奖项，得主是 ${data.goldenBoot}，本盘未追踪。）` : ''}`,
    );
  }
}

function makeRowAction(row, label, action) {
  row.setAttribute('role', 'button');
  row.setAttribute('tabindex', '0');
  row.setAttribute('aria-label', label);
  row.onclick = action;
  row.onkeydown = (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    action();
  };
}

function renderLog(archive) {
  const table = document.getElementById(`${archive.id}Log`);
  const matchHeading = archive.id === 'msi' ? ['Series', '对阵'] : ['Match', '对阵'];
  table.setAttribute('aria-label', archive.id === 'msi'
    ? (isChinese() ? 'MSI 全部系列赛判定记录；每行可打开原始理由' : 'MSI full series log; activate a row to open the original reasoning')
    : (isChinese() ? '世界杯淘汰赛逐场记录；每行可打开原始理由' : 'World Cup knockout-stage log; activate a row to open the original reasoning'));
  table.innerHTML = `<thead><tr>
    <th data-en="Round" data-zh="轮次">${isChinese() ? '轮次' : 'Round'}</th>
    <th data-en="${matchHeading[0]}" data-zh="${matchHeading[1]}">${isChinese() ? matchHeading[1] : matchHeading[0]}</th>
    <th data-en="Call" data-zh="预测">${isChinese() ? '预测' : 'Call'}</th>
    <th data-en="Conf." data-zh="置信度">${isChinese() ? '置信度' : 'Conf.'}</th>
    <th data-en="Result" data-zh="结果">${isChinese() ? '结果' : 'Result'}</th><th></th>
  </tr></thead>`;
  const body = document.createElement('tbody');
  archive.scored.forEach((record) => {
    const display = displayFor(archive, record);
    const mark = record.ok
      ? (record.exact ? '<span class="star">⭐</span>' : '<span class="ok">✓</span>')
      : '<span class="bad">✗</span>';
    const row = element('tr', null, `<td>${escapeHtml(display.round)}</td>
      <td>${escapeHtml(display.match)}</td><td>${escapeHtml(display.call)}</td>
      <td>${Math.round(record.conf * 100)}%</td><td>${escapeHtml(display.result)}</td><td>${mark}</td>`);
    makeRowAction(
      row,
      `${isChinese() ? '打开理由：' : 'Open reasoning: '}${display.match}`,
      () => openDrawer(archive, record),
    );
    body.appendChild(row);
  });
  table.appendChild(body);
}

function renderArchive(archive) {
  renderSummaryStrip(archive);
  renderSharedCharts(archive);
  wireThreshold(archive);
  wireBootstrap(archive);
  renderBoards(archive);
  renderLog(archive);
  applyI18n();
}

function renderUnavailable(id) {
  const strip = document.getElementById(`${id}Strip`);
  strip.replaceChildren(element('div', 'stat', '<b>—</b><small>data unavailable / 数据暂不可用</small>'));
}

const archives = { msi: null, wc: null };
Promise.allSettled([fetchJson('leagues'), fetchJson('games')]).then(([leagues, games]) => {
  if (leagues.status === 'fulfilled') {
    archives.msi = createMsiArchive(leagues.value);
    renderArchive(archives.msi);
  } else renderUnavailable('msi');
  if (games.status === 'fulfilled') {
    archives.wc = createWorldCupArchive(games.value);
    renderArchive(archives.wc);
  } else renderUnavailable('wc');
});

window.addEventListener('afflatus-lang', () => {
  termGlossaryController.refresh();
  window.setTimeout(() => {
    if (archives.msi) renderArchive(archives.msi);
    if (archives.wc) renderArchive(archives.wc);
  }, 0);
});
window.addEventListener('pagehide', () => {
  // pagehide also fires for bfcache. Stop current CPU work without disposing
  // the channels permanently so a restored page can run a fresh bootstrap.
  bootstrapRunners.msi.cancel('page-hidden');
  bootstrapRunners.wc.cancel('page-hidden');
});

revealCards();
