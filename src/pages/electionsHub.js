import { ELECTION_EVENTS, PARTIES, daysUntil, eventById, eventPhase, nextEvent, railPositions } from '../lib/electionRules.js';
import { createChamberLayout } from '../lib/chamberLayout.js';
import { renderPartyBadge } from '../lib/electionPartyMarkup.js';
import { VEC_POLLS_CLOSE, VEC_PUBLIC_FEED_BASE, isVecElectionNight } from '../config/electionSources.js';

const $ = (id) => document.getElementById(id);
const DASH = '—';
const keepDate = (text) => text.replace(/\d+ [年月日](?: \d+ [月日])*/g, (date) => date.replaceAll(' ', '\u00a0'));

export const electionLabel = (pair, lang) => (lang === 'zh' ? keepDate(pair.zh) : pair.en);
export const electionLocale = () => window.AfflatusI18N?.get() ?? (document.documentElement.lang.startsWith('zh') ? 'zh' : 'en');

// For a week after polls close the calendar leads with the Victorian count instead of the next election.
const RESULTS_LEAD_MS = 7 * 86_400_000;
const resultsEvent = (now) => {
  const since = now - Date.parse(VEC_POLLS_CLOSE);
  return since >= 0 && since < RESULTS_LEAD_MS ? eventById('vic-2026') : null;
};

let hubCount = null;
let hubCheck = null;
let repaintHubCount = null;

export function stopElectionHub() {
  hubCheck?.listeners.abort();
  hubCheck?.feed?.stop();
  hubCheck = null;
  repaintHubCount = null;
}

/** The calendar and workbench use the same validated pointer and refresh policy. */
async function startHubCount(event) {
  if (hubCheck) return;
  const check = { listeners: new AbortController(), feed: null };
  hubCheck = check;
  try {
    const [results, { seatCatalogue }, { createFeedController, fetchFeedJson, VISIBLE_CHECK_MS }] = await Promise.all([
      import('../lib/electionResults.js'), import('../lib/electionCatalogue.js'), import('../lib/electionFeed.js'),
    ]);
    if (hubCheck !== check) return;
    check.feed = createFeedController({
      base: VEC_PUBLIC_FEED_BASE,
      eventId: event.id,
      hostname: window.location.hostname,
      serverApprovedSource: 'vec-2026',
      fetchJson: fetchFeedJson,
      isHidden: () => document.hidden,
      visibleCheckMs: (now) => isVecElectionNight(now) ? 15_000 : VISIBLE_CHECK_MS,
      onChange({ snapshot, pointer, status }) {
        if (snapshot) {
          const tally = results.partyTally(seatCatalogue(event.id, 'assembly'), results.seatStates(snapshot, pointer), PARTIES[event.family]);
          const files = pointer.sources[0]?.feeds ?? [];
          hubCount = {
            tally,
            assembly: results.vicOfficeCount(snapshot, 'assembly'),
            council: results.vicOfficeCount(snapshot, 'council'),
            fileTimes: Object.fromEntries(files.map(({ office, publishedAt }) => [office, publishedAt])),
            delayed: status === 'error' || files.some((file) => file.status === 'error' || file.status === 'delayed') ||
              results.ageSeconds(pointer.sources[0]?.lastCheckedAt, Date.now()) >= 20 * 60,
          };
        }
        repaintHubCount?.();
      },
    });
    document.addEventListener('visibilitychange', check.feed.visibilityChanged, { signal: check.listeners.signal });
    await check.feed.start();
  } catch {
    if (hubCheck === check) hubCheck = null;
  }
}

export function setElectionText(element, en, zh, lang) {
  element.setAttribute('data-en', en);
  element.setAttribute('data-zh', zh);
  element.textContent = lang === 'zh' ? zh : en;
}

export function renderElectionHub(now, lang) {
  const T = (en, zh) => (lang === 'zh' ? zh : en);
  const L = (pair) => electionLabel(pair, lang);
  const setText = (element, en, zh) => setElectionText(element, en, zh, lang);
  const eventHref = (event, office = event.offices[0].id) => `?${new URLSearchParams({ event: event.id, office })}`;

  function formatNow() {
    const options = { timeZone: 'Australia/Melbourne', day: 'numeric', month: 'short', year: 'numeric' };
    return new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : 'en-AU', options).format(now);
  }

  function renderMiniSilhouette(event) {
    const office = event.offices[0];
    const layout = createChamberLayout(event.id, office.id);
    if (!layout) {
      const markX = ((office.majority / office.seats) * 296 + 12).toFixed(1);
      return `<svg class="el-mini-chamber el-mini-scale" viewBox="0 0 320 68" aria-hidden="true">
        <rect class="el-mini-track" x="12" y="28" width="296" height="14" rx="2"/>
        <line class="el-mini-line" x1="${markX}" y1="14" x2="${markX}" y2="54"/>
        <text class="el-mini-num" x="${markX}" y="11" text-anchor="middle">${office.majority}</text>
      </svg>`;
    }
    const marks = layout.slots.map((slot) => {
      if (!layout.desk) return `<circle cx="${slot.x}" cy="${slot.y}" r="${slot.radius}"/>`;
      const { width, height } = layout.desk;
      return `<rect x="${(slot.x - width / 2).toFixed(1)}" y="${(slot.y - height / 2).toFixed(1)}" width="${width}" height="${height}" transform="rotate(${slot.rotation} ${slot.x} ${slot.y})"/>`;
    }).join('');
    return `<svg class="el-mini-chamber" data-chamber="${layout.kind}" viewBox="${layout.viewBox.join(' ')}" aria-hidden="true">${marks}</svg>`;
  }

  function renderRail() {
    const { stops, nowLeft } = railPositions(now);
    const next = nextEvent(now);
    return `<div class="el-rail">
      <span class="el-rail-now" style="left:${nowLeft}%">${T('NOW', '现在')} · ${formatNow()}</span>
      <ol class="el-rail-line">${stops.map(({ event, left }) => {
      const phase = eventPhase(event, now);
      const kind = phase === 'past' ? 'past' : event === next ? 'next' : '';
      return `<li class="el-rail-stop ${kind}" style="left:${left}%"><a href="${eventHref(event)}" data-nav><i></i><b>${L(event.region)}</b><span>${L(event.dateLabel)}</span></a></li>`;
    }).join('')}</ol>
    </div>`;
  }

  const officeFacts = (event) => {
    const main = event.offices[0];
    const unit = main.unit ? L(main.unit) : T('seats', '席');
    return `${L(main.fullName)} ${main.seats} ${unit} · ${L(main.majorityLabel)}`;
  };

  function renderNextCard(event) {
    const days = daysUntil(event, now);
    return `<section class="el-next" aria-labelledby="el-next-title">
      <div class="el-next-body">
        <p class="el-card-date">${L(event.dateLabel)} · ${L(event.pollsClose)}</p>
        <h2 id="el-next-title">${L(event.headline)}</h2>
        <p class="el-next-facts">${officeFacts(event)} · ${L(event.extraFact)}</p>
        <a class="el-btn" href="${eventHref(event)}" data-nav>${T(`Open ${L(event.short)}`, `打开${L(event.short)}`)} →</a>
      </div>
      <div class="el-next-visual">
        ${renderMiniSilhouette(event)}
        <div class="el-countdown">
          ${days === null
      ? `<strong>${DASH}</strong><span>${L(event.dateLabel)}</span>`
      : `<strong>${days}</strong><span>${T('days', '天')}</span>`}
        </div>
      </div>
    </section>`;
  }

  function renderHubCount(event) {
    if (!hubCount) return '';
    const office = event.offices[0];
    const parties = PARTIES[event.family].filter((party) => hubCount.tally[party.id].decided || hubCount.tally[party.id].leading);
    const segment = (party, count, kind) => (count ? `<i class="el-tally-seg is-${kind}" style="width:${(count / office.seats) * 100}%;--seat:${party.color}"></i>` : '');
    const rows = parties.map((party, index) => {
      const { decided, leading } = hubCount.tally[party.id];
      const mark = `<span class="el-tally-mark" style="left:${(office.majority / office.seats) * 100}%">${index === 0 ? `<span>${L(office.majorityLabel)}</span>` : ''}</span>`;
      return `<div class="el-tally-row" data-party-row="${party.id}"><span class="el-tally-name">${renderPartyBadge(event.family, party.id, 'sm')}<span>${L(party)}</span></span><div class="el-tally-bar" aria-hidden="true">${segment(party, decided, 'decided')}${segment(party, leading, 'leading')}${mark}</div><b>${decided + leading}</b></div>`;
    }).join('');
    return `${rows ? `<div class="el-tally-rows">${rows}</div><p class="el-next-facts">${T('Assembly seats declared or leading on the current 2CP count · 45 for majority', '下议院已宣布或按当前两候选人计票领先的席位 · 45 席过半')}</p>` : ''}
      <p class="el-next-facts">${renderHubReporting()}</p>`;
  }

  function renderHubReporting() {
    if (!hubCount) return '';
    const { assembly, council, fileTimes, delayed } = hubCount;
    const time = new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : 'en-AU', { timeZone: 'Australia/Melbourne', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    const fromFile = (office) => fileTimes[office] ? ` · ${time.format(new Date(fileTimes[office]))}` : '';
    return `${T(`Assembly ${assembly.reported}/88 districts reporting · ${assembly.declared} declared`, `下议院 ${assembly.reported}/88 个选区已报票 · ${assembly.declared} 席已宣布`)}${fromFile('assembly')}
      <br>${T(`Council ${council.reported}/8 regions reporting · ${council.declared} declared`, `上议院 ${council.reported}/8 个大区已报票 · ${council.declared} 个大区已宣布`)}${fromFile('council')}${delayed ? ` · ${T('Updates delayed', '更新延迟')}` : ''}`;
  }

  function renderResultsCard(event) {
    const night = isVecElectionNight(now.getTime());
    return `<section class="el-next el-next-live" aria-labelledby="el-next-title">
      <div class="el-next-body">
        <p class="el-live-flag">${night ? T('Counting now', '正在计票') : T('Latest count', '最新计票')}</p>
        <h2 id="el-next-title">${night ? T('Victoria is counting', '维多利亚州正在计票') : T('Victoria: the count so far', '维多利亚州：目前计票结果')}</h2>
        <p class="el-next-facts">${officeFacts(event)} · ${L(event.extraFact)}</p>
        <div class="el-hub-count" id="el-hub-count">${renderHubCount(event)}</div>
        <div class="el-hub-offices"><a class="el-btn" href="${eventHref(event)}" data-nav>${T('Assembly results', '下议院结果')} →</a>
        <a class="el-btn el-btn-o" href="${eventHref(event, 'council')}" data-nav>${T('Council results', '上议院结果')} →</a></div>
      </div>
    </section>`;
  }

  function renderCard(event, wide = false) {
    const phase = eventPhase(event, now);
    const pill = phase === 'past' && event.id === 'vic-2026'
      ? `<span class="el-pill" id="el-vic-card-count">${renderHubReporting()}</span>`
      : phase === 'past'
      ? `<span class="el-pill">${T('Voted · no verified results loaded', '已投票 · 未加载经核验的结果')}</span>`
      : '';
    return `<li class="el-card${wide ? ' el-card-wide' : ''}">
      <a href="${eventHref(event)}" data-nav>
        <div class="el-card-top">
          <div>
            <h3>${L(event.region)}</h3>
            <span class="el-card-date">${L(event.dateLabel)}</span>
          </div>
          ${renderMiniSilhouette(event)}
        </div>
        <span class="el-card-facts">${officeFacts(event)} · ${L(event.extraFact)}</span>
        ${pill}
      </a>
    </li>`;
  }

  const lead = resultsEvent(now.getTime());
  const strip = $('el-strip');
  $('el-strip-meta').innerHTML = `<span>5 ${T('events', '场')}</span><span>AEDT · ET</span>`;

  setText($('el-title-main'), 'ELECTIONS', '选举');
  const sub = $('el-title-sub');
  sub.hidden = false;
  setText(sub, '2026–28', '2026–28');

  const eventsNav = $('el-events');
  eventsNav.hidden = true;
  eventsNav.innerHTML = '';
  $('el-hero-controls').innerHTML = '';
  document.body.dataset.view = 'hub';

  const next = lead || nextEvent(now);
  const others = ELECTION_EVENTS.filter((event) => event !== next);
  $('el-view').innerHTML = `${renderRail()}
    <div class="el-bento">
      ${lead ? renderResultsCard(lead) : next ? renderNextCard(next) : ''}
      <ul class="el-cards">${others.map((event, index) => renderCard(event, index === 0)).join('')}</ul>
    </div>
    <p class="el-foot">${T('Australia/Melbourne & America/New_York · Checked against official sources Nov 2026.', '墨尔本与纽约时区 · 2026 年 11 月对照官方来源核对。')}</p>`;
  repaintHubCount = () => {
    const hasResults = Boolean(lead && hubCount);
    strip.dataset.mode = hasResults ? 'live' : 'preview';
    if (hasResults) setText($('el-strip-flag'), 'Unofficial results', '非正式结果');
    else setText($('el-strip-flag'), 'Preview', '预览');
    const countHost = $('el-hub-count');
    if (countHost) countHost.innerHTML = renderHubCount(lead);
    const cardHost = $('el-vic-card-count');
    if (cardHost) cardHost.innerHTML = renderHubReporting();
  };
  repaintHubCount();
  if (now.getTime() >= Date.parse(VEC_POLLS_CLOSE)) void startHubCount(eventById('vic-2026'));
}
