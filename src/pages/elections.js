/* ============================================================
   ELECTIONS: calendar hub (Bento silhouettes) and Spatial Workbench console.
   DOM glue only: rules live in electionRules.js, the view state in
   electionState.js, seats in electionCatalogue.js, result meaning in
   electionResults.js. With no cleared feed nothing fetches results, and no
   party colour reaches a seat without one. Feed text is escaped before use.
   ============================================================ */
import {
  ELECTION_EVENTS,
  NO_RESULT,
  NOT_ON_BALLOT,
  PARTIES,
  daysUntil,
  eventById,
  eventPhase,
  nextEvent,
  officeById,
  partyIconsFor,
  railPositions,
  statusVocabulary,
} from '../lib/electionRules.js';
import { baselineFor, baselineUrl } from '../lib/electionBaseline.js';
import { seatCatalogue, sortSeats } from '../lib/electionCatalogue.js';
import { bindSeatCatalogue, chamberSvg, createChamberLayout, seatMark, tallySeats } from '../lib/chamberLayout.js';
import {
  areaBox,
  areaMembers,
  areaSummary,
  bindFeatures,
  findSeat,
  geographyAreas,
  geographyFor,
  geographyGap,
  mapSvg,
  mapUrl,
  seatFeature,
  zoomViewBox,
} from '../lib/electionGeography.js';
import { parseState, serializeState, withEvent, withGeography, withOffice, withRace } from '../lib/electionState.js';
import { ELECTION_FEED_BASE, VEC_POLLS_CLOSE, VEC_PUBLIC_FEED_BASE, sourceById } from '../config/electionSources.js';
import { CIVIC_BASE, createCivicReader } from '../lib/civicApi.js';
import { ageSeconds, contestLeader, coveredSeats, isLocalHost, partyTally, primaryLeader, raceFreshness, raceIndex, seatStates, snapshotErrors } from '../lib/electionResults.js';
import { createFeedController } from '../lib/electionFeed.js';
import { getLocale } from '../lib/localeStore.js';

const $ = (id) => document.getElementById(id);
const DASH = '—';
const INITIAL_ROWS = 12;
const NO_STATES = Object.freeze({});
const NO_RACES = new Map();
const CHAIR_LABELS = Object.freeze({
  rostrum: { en: 'Rostrum', zh: '讲台' },
  speaker: { en: 'Speaker', zh: '议长' },
  president: { en: 'President', zh: '议长' },
});
const SUPPORTS_POPOVER = typeof HTMLElement !== 'undefined' && Object.hasOwn(HTMLElement.prototype, 'popover');
const PHONE_QUERY = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  ? window.matchMedia('(max-width: 640px)')
  : null;
const HOVER_QUERY = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  ? window.matchMedia('(hover: hover)')
  : null;
const REDUCED_MOTION_QUERY = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  ? window.matchMedia('(prefers-reduced-motion: reduce)')
  : null;

let lang = window.AfflatusI18N ? window.AfflatusI18N.get() : getLocale('en');
const T = (en, zh) => (lang === 'zh' ? zh : en);
const keepDate = (text) => text.replace(/\d+ [年月日](?: \d+ [月日])*/g, (date) => date.replaceAll(' ', '\u00a0'));
const L = (pair) => (lang === 'zh' ? keepDate(pair.zh) : pair.en);

let state = parseState(window.location.search);
let table = { key: 'seat', direction: 'asc', expanded: false, query: '' };
// Which spatial panel owns the primary Stage slot on desktop/tablet ('explore' or 'chamber').
let stagePrimary = 'explore';
let activeMap = null;
let zoomedSeat = null;
const mapRequests = new Map();
const baselineRequests = new Map();
const animatedViews = new Set();
let activeSweep = null;
let feed = null;
let feedEventId = null;
let vecStartTimer;
let shown = null;
let replayIndex = null;

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const currentStates = () => shown?.states || NO_STATES;
const currentRaces = () => shown?.races || NO_RACES;
const partiesOf = (event) => PARTIES[event.family];
const isReplay = () => replayIndex !== null;
const ageClock = () => (isReplay() ? Date.parse(shown.snapshot.publishedAt) : Date.now());
const officeRacesOf = (officeId = state.office) => (shown ? shown.snapshot.races.filter((race) => race.office === officeId) : []);
const isBaselineForOffice = (officeId = state.office) => Boolean(shown?.isBaseline && officeRacesOf(officeId).length > 0);
const hasShownForOffice = (officeId = state.office) => Boolean(shown && (!shown.isBaseline || officeRacesOf(officeId).length > 0));

function renderPartyIcons(icons, size = 'md') {
  if (!icons.length) return '';
  const imgs = icons.map((icon) => `<img class="el-party-icon${icon.wide ? ' is-wide' : ''}" src="${icon.src}" alt="" width="${icon.width}" height="${icon.height}" decoding="async">`).join('');
  return `<span class="el-party-badge el-party-badge-${size}${icons.length > 1 ? ' is-pair' : ''}" aria-hidden="true">${imgs}</span>`;
}

const renderPartyBadge = (family, partyId, size = 'md') => renderPartyIcons(partyIconsFor(family, partyId), size);
const renderCandidatePartyBadge = (family, candidate, size = 'sm') => renderPartyIcons(partyIconsFor(family, candidate?.partyId, candidate?.party, candidate?.independent), size);

const NOT_LOADED = () => T('Not loaded: no verified source yet', '未加载：尚无经核验的来源');
const NOT_PUBLISHED = () => T('Not published by the source', '来源未发布');
const COUNTING_WORDS = Object.freeze({
  recount: { en: 'Recount', zh: '重新计票' },
  rcv_pending: { en: 'RCV pending', zh: '等待排序计票' },
  runoff: { en: 'Runoff', zh: '第二轮' },
});
const WITHDRAWN = Object.freeze({ en: 'Decision withdrawn', zh: '判定已撤销' });
const LATER_CONTEST_WORDS = Object.freeze({
  runoff: { en: 'runoff', zh: '决选' },
  postponed: { en: 'postponed', zh: '延期' },
});

const TABLE_PARTY_SHORT = Object.freeze({
  dem: { en: 'Dem', zh: '民主党' },
  rep: { en: 'Rep', zh: '共和党' },
  teal: { en: 'Ind.', zh: '独立' },
});

function raceStatusWords(seat, race, event) {
  const words = statusVocabulary(event);
  const mark = seatMark(seat, currentStates()[seat.seatId], partiesOf(event));
  const party = mark.party ? ` · ${L(mark.party)}` : '';
  if (race.decision.status === 'certified') return `${L(words.final)}${party}`;
  if (race.decision.status === 'provider_called') return `${L(words.called)} · ${esc(race.decision.authority)}${party}`;
  if (mark.status === 'unavailable') return L(words.unavailable);
  if (race.decision.status === 'call_rescinded') return L(WITHDRAWN);
  if (COUNTING_WORDS[race.counting.status]) return L(COUNTING_WORDS[race.counting.status]);
  if (mark.status === 'leading') return `${L(words.leading)}${party}`;
  return L(race.counting.status === 'no_votes' ? words.notStarted : words.counting);
}

function seatStatus(seat) {
  if (!seat.onBallot) return L(NOT_ON_BALLOT);
  const race = currentRaces().get(seat.seatId);
  if (!race) return L(NO_RESULT);
  const stale = raceFreshness(race, shown.pointer) === 'stale';
  const later = LATER_CONTEST_WORDS[race.contestKind];
  return `${raceStatusWords(seat, race, eventById(state.event))}${later ? ` · ${L(later)}` : ''}${stale ? ` · ${T('stale', '已过时')}` : ''}`;
}

function tableRaceStatusWords(seat, race, event) {
  const words = statusVocabulary(event);
  const mark = seatMark(seat, currentStates()[seat.seatId], partiesOf(event));
  const partyPair = mark.party ? (TABLE_PARTY_SHORT[mark.party.id] || mark.party) : null;
  const party = partyPair ? ` · ${L(partyPair)}` : '';
  if (race.decision.status === 'certified') {
    return `${event.family === 'us' ? T('Certified', '已认证') : T('Declared', '已宣布')}${party}`;
  }
  if (race.decision.status === 'provider_called') {
    return `${event.family === 'us' ? T('Called', '已判定') : T('Projected', '预测')}${party}`;
  }
  if (mark.status === 'unavailable') return T('Unavailable', '来源不可用');
  if (race.decision.status === 'call_rescinded') return L(WITHDRAWN);
  if (COUNTING_WORDS[race.counting.status]) return L(COUNTING_WORDS[race.counting.status]);
  if (mark.status === 'leading') return `${T('Leading', '领先')}${party}`;
  if (race.counting.status === 'no_votes') {
    return event.family === 'us' ? T('No votes', '未计票') : L(words.notStarted);
  }
  return event.family === 'us' ? T('Reporting', '计票中') : T('Counting', '计票中');
}

function tableStatus(seat) {
  if (!seat.onBallot) return L(NOT_ON_BALLOT);
  const race = currentRaces().get(seat.seatId);
  if (!race) return T('No result', '未加载');
  const stale = raceFreshness(race, shown.pointer) === 'stale';
  const later = LATER_CONTEST_WORDS[race.contestKind];
  return `${tableRaceStatusWords(seat, race, eventById(state.event))}${later ? ` · ${L(later)}` : ''}${stale ? ` · ${T('stale', '已过时')}` : ''}`;
}

const contestCount = (seats) => seats.filter((seat) => seat.onBallot).length;
const eventHref = (eventId) => serializeState(withEvent(eventId)) || window.location.pathname;
const hubHref = () => window.location.pathname;

function setText(element, en, zh) {
  element.setAttribute('data-en', en);
  element.setAttribute('data-zh', zh);
  element.textContent = T(en, zh);
}

function phaseLabel(event, now) {
  const phase = eventPhase(event, now);
  if (phase === 'past') return T('voted', '已投票');
  if (phase === 'undated') return T('TBD', '待定');
  if (nextEvent(now)?.id === event.id) {
    const days = daysUntil(event, now);
    return days === 0 ? T('today', '今天') : T(`${days}d`, `${days}天`);
  }
  return L(event.dateLabel);
}

function formatNow(now) {
  const options = { timeZone: 'Australia/Melbourne', day: 'numeric', month: 'short', year: 'numeric' };
  return new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : 'en-AU', options).format(now);
}

/* ---------- Hub ---------- */

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

function renderHub(now) {
  syncFeed(null);
  const strip = $('el-strip');
  strip.dataset.mode = 'preview';
  setText($('el-strip-flag'), 'Preview', '预览');
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

  const next = nextEvent(now);
  const others = ELECTION_EVENTS.filter((event) => event !== next);
  $('el-view').innerHTML = `${renderRail(now)}
    <div class="el-bento">
      ${next ? renderNextCard(next, now) : ''}
      <ul class="el-cards">${others.map((event, index) => renderCard(event, now, index === 0)).join('')}</ul>
    </div>
    <p class="el-foot">${T('Australia/Melbourne & America/New_York · Checked against official sources Nov 2026.', '墨尔本与纽约时区 · 2026 年 11 月对照官方来源核对。')}</p>`;
}

function renderRail(now) {
  const { stops, nowLeft } = railPositions(now);
  const next = nextEvent(now);
  return `<div class="el-rail">
    <span class="el-rail-now" style="left:${nowLeft}%">${T('NOW', '现在')} · ${formatNow(now)}</span>
    <ol class="el-rail-line">${stops.map(({ event, left }) => {
    const phase = eventPhase(event, now);
    const kind = phase === 'past' ? 'past' : event === next ? 'next' : '';
    return `<li class="el-rail-stop ${kind}" style="left:${left}%"><a href="${eventHref(event.id)}" data-nav><i></i><b>${L(event.region)}</b><span>${L(event.dateLabel)}</span></a></li>`;
  }).join('')}</ol>
  </div>`;
}

const officeFacts = (event) => {
  const main = event.offices[0];
  const unit = main.unit ? L(main.unit) : T('seats', '席');
  return `${L(main.fullName)} ${main.seats} ${unit} · ${L(main.majorityLabel)}`;
};

function renderNextCard(event, now) {
  const days = daysUntil(event, now);
  return `<section class="el-next" aria-labelledby="el-next-title">
    <div class="el-next-body">
      <p class="el-card-date">${L(event.dateLabel)} · ${L(event.pollsClose)}</p>
      <h2 id="el-next-title">${L(event.headline)}</h2>
      <p class="el-next-facts">${officeFacts(event)} · ${L(event.extraFact)}</p>
      <a class="el-btn" href="${eventHref(event.id)}" data-nav>${T(`Open ${L(event.short)}`, `打开${L(event.short)}`)} →</a>
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

function renderCard(event, now, wide = false) {
  const phase = eventPhase(event, now);
  const pill = phase === 'past'
    ? `<span class="el-pill">${T('Voted · no verified results loaded', '已投票 · 未加载经核验的结果')}</span>`
    : '';
  return `<li class="el-card${wide ? ' el-card-wide' : ''}">
    <a href="${eventHref(event.id)}" data-nav>
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

/* ---------- Console ---------- */

function defaultStagePrimary(event, office) {
  if (!seatCatalogue(event.id, office.id).length) return 'chamber';
  return geographyFor(event.id, office.id) || state.geographyView === 'schematic' ? 'explore' : 'chamber';
}

function renderFeedButton() {
  if (!feed?.state.pointer) return '';
  return `<button type="button" class="el-btn el-btn-o el-cmd-btn" id="el-feed-toggle" ${isReplay() ? 'disabled' : ''}>${feed.state.paused ? T('Resume updates', '恢复更新') : T('Pause updates', '暂停更新')}</button>`;
}

function syncFeedButton() {
  const slot = $('el-feed-slot');
  if (!slot) return;
  if (!feed?.state.pointer) {
    slot.innerHTML = '';
    return;
  }
  const existing = $('el-feed-toggle');
  if (existing) {
    existing.disabled = isReplay();
    existing.textContent = feed.state.paused ? T('Resume updates', '恢复更新') : T('Pause updates', '暂停更新');
  } else {
    slot.innerHTML = renderFeedButton();
  }
}

function renderConsole(now) {
  const event = eventById(state.event);
  const office = officeById(event, state.office);
  const seats = seatCatalogue(event.id, office.id);
  const unit = office.unit ? L(office.unit) : T('seats', '席');

  setText($('el-title-main'), event.short.en, event.short.zh);
  const sub = $('el-title-sub');
  if (event.offices.length <= 1) {
    sub.hidden = false;
    setText(sub, office.fullName.en, office.fullName.zh);
  } else {
    sub.hidden = true;
    setText(sub, '', '');
  }

  const eventsNav = $('el-events');
  eventsNav.hidden = false;
  eventsNav.innerHTML = `<a class="el-events-all" href="${hubHref()}" data-nav aria-label="${T('All elections', '全部选举')}">← ${T('All', '全部')}</a>
    <ul>${ELECTION_EVENTS.map((item) => `<li><a href="${eventHref(item.id)}" data-nav ${item.id === event.id ? 'aria-current="page"' : ''}>${L(item.short)}<small>${phaseLabel(item, now)}</small></a></li>`).join('')}</ul>`;

  syncFeed(event);
  $('el-hero-controls').innerHTML = `${event.offices.length > 1 ? `<div class="el-seg" role="group" aria-label="${T('Office', '议院')}">
    ${event.offices.map((item) => `<button type="button" data-office="${item.id}" aria-pressed="${item.id === office.id}">${L(item.name)}</button>`).join('')}
  </div>` : ''}<span id="el-feed-slot">${renderFeedButton()}</span>`;

  renderConsoleStrip(event, office, seats);
  document.body.dataset.view = 'console';
  stagePrimary = defaultStagePrimary(event, office);

  const hasExplore = seats.length > 0;
  $('el-view').innerHTML = `
    ${renderFeedBanner()}
    ${renderTally(event, office, seats, unit, now)}
    <div class="el-workbench${hasExplore ? '' : ' is-single-stage'}" id="el-workbench" data-primary="${stagePrimary}">
      ${hasExplore ? `<section class="el-panel el-explore" id="el-explore" aria-labelledby="el-explore-title">
        <div class="el-explore-head" id="el-explore-head">
          ${renderStageSwitcher(event, office)}
          <div class="el-stage-actions">
            <button type="button" class="el-pip-swap" data-stage="explore">⇄ ${T('Expand', '放大')}</button>
            <button type="button" class="el-explore-toggle" id="el-explore-toggle" aria-expanded="false" aria-controls="el-explore-body">${T('Show', '展开')}</button>
          </div>
        </div>
        <h2 id="el-explore-title" class="el-sr">${exploreTitle()}</h2>
        <div class="el-explore-body" id="el-explore-body">${renderExplore(event, office, seats)}</div>
      </section>` : ''}
      <section class="el-panel el-chamber" id="el-chamber" aria-labelledby="el-chamber-title">
        <div class="el-chamber-head">
          <h2 id="el-chamber-title" class="el-panel-title">${L(office.fullName)} · ${office.seats} ${unit}</h2>
          ${hasExplore ? `<div class="el-chamber-tools" id="el-chamber-tools">
            <button type="button" class="el-pip-swap" data-stage="chamber">⇄ ${T('Expand', '放大')}</button>
          </div>` : ''}
        </div>
        ${renderChamber(event, office, seats)}
      </section>
      <div class="el-dock" id="el-dock">
        ${hasExplore ? `<form class="el-search" id="el-search-form" role="search">
          <label for="el-search" class="el-sr">${T('Find a seat', '查找席位')}</label>
          <input id="el-search" type="search" list="el-search-list" autocomplete="off" enterkeyhint="search" placeholder="${T('Search seats…', '搜索席位…')}">
          <datalist id="el-search-list">${seats.map((seat) => `<option value="${L(seat.label)}"></option>`).join('')}</datalist>
          <p class="el-note" id="el-search-note" role="status"></p>
        </form>` : ''}
        <aside class="el-panel el-drawer" id="el-drawer" aria-label="${T('Race details', '比赛详情')}" hidden></aside>
        <section class="el-panel el-races" aria-labelledby="el-races-title">
          <h2 id="el-races-title" class="el-sr">${T('Races', '比赛')}</h2>
          <div id="el-races-table"></div>
        </section>
      </div>
    </div>
    <section class="el-panel el-sources" id="el-sources" popover="auto" aria-labelledby="el-sources-title">${renderSourcesInner(event, seats)}</section>
    ${renderReplay()}
    <p class="el-foot" id="el-foot">${footText()}</p>
    <p class="el-sr" id="el-live" role="status"></p>`;

  syncWorkbenchOrder();
  renderRaces();
  syncSelection();
  showMap();
  maybeStartTimelineSweep();
}

function renderStageSwitcher(event, office) {
  const geography = geographyFor(event.id, office.id);
  const mapActive = stagePrimary === 'explore' && state.geographyView === 'map' && Boolean(geography);
  const blocksActive = stagePrimary === 'explore' && (!geography || state.geographyView === 'schematic');
  const chamberActive = stagePrimary === 'chamber';
  return `<div class="el-seg el-seg-small el-stage-seg" id="el-stage-seg" role="group" aria-label="${T('Seat view', '席位视图')}">
    ${geography
    ? `<button type="button" data-geo="map" aria-pressed="${mapActive}">${T('Map', '地图')}</button>
      <button type="button" data-geo="schematic" aria-pressed="${blocksActive}">${T('Seat blocks', '席位块')}</button>`
    : `<button type="button" data-stage="explore" aria-pressed="${blocksActive}">${T('Seat blocks', '席位块')}</button>`}
    ${office.geometry ? `<button type="button" data-stage="chamber" aria-pressed="${chamberActive}">${T('Chamber', '议席图')}</button>` : ''}
  </div>`;
}

function syncStageButtons() {
  const event = eventById(state.event);
  if (!event) return;
  const office = officeById(event, state.office);
  const geography = geographyFor(event.id, office.id);
  const mapActive = stagePrimary === 'explore' && state.geographyView === 'map' && Boolean(geography);
  const blocksActive = stagePrimary === 'explore' && (!geography || state.geographyView === 'schematic');
  const chamberActive = stagePrimary === 'chamber';
  $('el-stage-seg')?.querySelector('[data-geo="map"]')?.setAttribute('aria-pressed', String(mapActive));
  $('el-stage-seg')?.querySelector('[data-geo="schematic"]')?.setAttribute('aria-pressed', String(blocksActive));
  $('el-stage-seg')?.querySelector('[data-stage="explore"]')?.setAttribute('aria-pressed', String(blocksActive));
  $('el-stage-seg')?.querySelector('[data-stage="chamber"]')?.setAttribute('aria-pressed', String(chamberActive));
}

// Keeps DOM order identical to visual order on desktop, tablet and phone without CSS `order`.
function syncWorkbenchOrder() {
  const workbench = $('el-workbench');
  if (!workbench) return;
  workbench.dataset.primary = stagePrimary;
  const explore = $('el-explore');
  const chamber = $('el-chamber');
  const dock = $('el-dock');
  if (!explore || !chamber || !dock) return;
  const seg = $('el-stage-seg');
  const segHost = !PHONE_QUERY?.matches && stagePrimary === 'chamber' ? $('el-chamber-tools') : $('el-explore-head');
  if (seg && segHost && seg.parentElement !== segHost) segHost.prepend(seg);
  const desired = PHONE_QUERY?.matches
    ? [chamber, dock, explore]
    : stagePrimary === 'chamber'
      ? [chamber, explore, dock]
      : [explore, chamber, dock];
  desired.forEach((node, index) => {
    if (workbench.children[index] !== node) workbench.insertBefore(node, workbench.children[index] || null);
  });
  syncStageButtons();
}

function renderVicContext(event, office, now = Date.now()) {
  if (event.id !== 'vic-2026' || office.id !== 'assembly') return '';
  const races = officeRacesOf(office.id);
  const baseline = isBaselineForOffice(office.id);
  const hasResults = races.length > 0 && !baseline;
  const source = shown?.pointer?.sources?.[0];
  const assembly = source?.feeds?.find((item) => item.office === office.id);
  const delayed = !isReplay() && !feed?.state.paused && source && ageSeconds(source.lastCheckedAt, now) >= 20 * 60;
  const failed = !isReplay() && (feed?.state.status === 'error' || assembly?.status === 'error');
  const beforeClose = now < Date.parse(VEC_POLLS_CLOSE);

  let status;
  if (isReplay()) status = T('Recorded snapshot', '历史快照');
  else if (shown?.snapshot.isSynthetic) status = T('Synthetic test data', '合成测试数据');
  else if (failed || delayed) status = hasResults ? T('Updates delayed', '更新延迟') : T('Feed unavailable', '暂时无法获取结果');
  else if (feed?.state.paused) status = T('Updates paused', '更新已暂停');
  else if (hasResults) status = T('Counting updates', '计票更新');
  else status = beforeClose ? `${L(event.dateLabel)} · ${L(event.pollsClose)}` : T('Polls closed', '投票已结束');

  const counting = races.filter((race) => race.counting.status !== 'no_votes' || race.decision.status === 'certified').length;
  const declared = races.filter((race) => race.decision.status === 'certified').length;
  const metrics = baseline
    ? `<span><b>${L(shown.snapshot.baselineLabel)}</b> · ${declared}/${office.seats} ${T('declared', '已宣布')}</span>`
    : hasResults
      ? `<span><b>${counting}</b>/${office.seats} ${T('districts reporting', '选区已报票')}</span><span><b>${declared}</b> ${T('declared', '已宣布')}</span>`
      : '';
  const officialHref = beforeClose && !hasResults ? 'https://www.vec.vic.gov.au/electoral-boundaries/state-districts' : event.officialUrl;
  const officialText = beforeClose && !hasResults ? T('VEC districts', 'VEC 选区') : T('VEC official', 'VEC 官方');
  return `<div class="el-tally-context" id="el-vic-summary">
    <span class="el-tally-badge${failed || delayed ? ' is-delayed' : ''}">${status}</span>
    ${metrics}
    <a id="el-vic-official" href="${officialHref}" target="_blank" rel="noopener noreferrer">${officialText} ↗</a>
  </div>`;
}

function renderTally(event, office, seats, unit, now = Date.now()) {
  const majorityAt = (office.majority / office.seats) * 100;
  const parties = partiesOf(event);
  const hasOfficeData = hasShownForOffice(office.id);
  const states = hasOfficeData ? currentStates() : NO_STATES;
  const counts = hasOfficeData ? partyTally(seats, states, parties) : null;
  const keys = parties.map((party) => {
    const count = counts?.[party.id];
    return `<li data-party="${party.id}">${renderPartyBadge(event.family, party.id)}${L(party)}<b>${count ? count.decided : DASH}</b>${count?.leading ? `<small>+${count.leading} ${T('leading', '领先')}</small>` : ''}</li>`;
  }).join('');
  const tally = tallySeats(seats, states, parties);
  const segment = (party, count, kind) => (count ? `<i class="el-tally-seg is-${kind}" data-party="${party.id}" data-kind="${kind}" style="width:${(count / office.seats) * 100}%;--seat:${party.color}"></i>` : '');
  const marker = (withLabel) => (office.heldSeatsUnknown ? '' : `<span class="el-tally-mark" style="left:${majorityAt}%">${withLabel ? `<span>${L(office.majorityLabel)}</span>` : ''}</span>`);
  const active = counts ? parties.filter((party) => counts[party.id].decided || counts[party.id].leading) : [];
  const bars = active.length
    ? `<div class="el-tally-rows">${active.map((party, index) => `<div class="el-tally-row" data-party-row="${party.id}"><span class="el-tally-name">${renderPartyBadge(event.family, party.id, 'sm')}<span>${L(party)}</span></span><div class="el-tally-bar">${segment(party, counts[party.id].decided, 'decided')}${segment(party, counts[party.id].leading, 'leading')}${marker(index === 0)}</div></div>`).join('')}</div>`
    : `<div class="el-tally-bar">${marker(true)}</div>`;
  const declaredRegion = hasOfficeData ? seats.filter((seat) => {
    const race = currentRaces().get(seat.seatId);
    return seat.onBallot && race?.seatIds.length > 1 && ['certified', 'provider_called'].includes(race.decision.status);
  }).length : 0;
  const unlisted = hasOfficeData ? seats.filter((seat) => seat.onBallot && states[seat.seatId]?.status !== 'unavailable' && states[seat.seatId] && seatMark(seat, states[seat.seatId], parties).status === 'neutral').length : 0;
  const open = hasOfficeData ? tally.neutral + tally.unavailable - unlisted - declaredRegion : office.seats - tally.off;
  const noteParts = [
    ...(office.heldSeatsUnknown ? [L(office.majorityLabel)] : []),
    ...(office.majorityNote ? [L(office.majorityNote)] : []),
  ];
  return `<section class="el-panel el-tally" id="el-tally" aria-label="${T('Seat tally', '席位统计')}">
    <div class="el-tally-sweep" id="el-tally-sweep" aria-hidden="true" hidden><i id="el-tally-sweep-bar"></i></div>
    ${renderVicContext(event, office, now)}
    <div class="el-tally-main">
      ${bars}
      <ul class="el-tally-keys">${keys}<li><i class="el-neutral"></i>${hasOfficeData ? T('No decision or lead', '无判定或领先') : L(NO_RESULT)}<b id="el-tally-open-count">${open}</b></li>${declaredRegion ? `<li><i class="el-neutral"></i>${T('Declared, not allocated to seats', '已宣布，未按席位分配')}<b>${declaredRegion}</b></li>` : ''}${unlisted ? `<li><i class="el-neutral"></i>${T('Decision or lead, no listed party', '有判定或领先，无所列党派')}<b>${unlisted}</b></li>` : ''}${tally.off ? `<li><i class="el-off"></i>${L(NOT_ON_BALLOT)}<b>${tally.off}</b></li>` : ''}</ul>
    </div>
    ${noteParts.length ? `<p class="el-note el-tally-note">${noteParts.join(' · ')}</p>` : ''}
    <p class="el-sr">${office.seats} ${unit}</p>
  </section>`;
}

function chamberMarkup(event, office, seats) {
  const bound = bindSeatCatalogue(event.id, office.id, seats);
  return chamberSvg(bound, {
    states: currentStates(),
    parties: partiesOf(event),
    label: (seat) => `${L(seat.label)} · ${seatStatus(seat)}`,
    ariaLabel: `${L(office.fullName)} · ${T('seat chart', '席位图')} · ${seats.length}`,
    chairLabel: L(CHAIR_LABELS[bound.chairLabel]),
    tag: (party) => L(party.tag),
  });
}

function renderChamber(event, office, seats) {
  if (!office.geometry) {
    return `<div class="el-chamber-slot"><p>${T('The Electoral College view is not built yet.', '选举人团视图尚未建成。')}</p></div>`;
  }
  const svg = chamberMarkup(event, office, seats);
  const key = tallySeats(seats, NO_STATES).off
    ? `<ul class="el-chamber-key"><li><i class="el-neutral"></i>${L(NO_RESULT)}</li><li><i class="el-off"></i>${L(NOT_ON_BALLOT)}</li></ul>`
    : '';
  return `<div class="el-chamber-chart">
    ${svg}
    <p class="el-chamber-readout" id="el-chamber-readout"></p>
    ${key}
  </div>`;
}

// Hover and focus preview a seat; otherwise show the selected seat, or leave quiet.
function showReadout(seatId) {
  const seat = seatId && seatCatalogue(state.event, state.office).find((item) => item.seatId === seatId);
  const updated = seat ? currentRaces().get(seat.seatId)?.provenance.sourceUpdatedAt : null;
  const text = seat ? `${L(seat.label)} · ${seatStatus(seat)}${updated ? ` · ${formatTime(updated)}` : ''}` : '';
  for (const host of [$('el-chamber-readout'), $('el-map-readout')]) {
    if (host) host.textContent = text;
  }
}

const exploreTitle = () => (state.geographyView === 'map' ? T('Map', '地图') : T('Seat blocks', '席位块'));

function renderExplore(event, office, seats) {
  if (!seats.length) return renderTiles(seats);
  const geography = geographyFor(event.id, office.id);
  const gap = geographyGap(event.id, office.id);
  if (state.geographyView === 'map' && geography) {
    return `<div class="el-map" id="el-map"><p class="el-note">${T('Loading the map…', '正在加载地图…')}</p></div>`;
  }
  return `${gap ? `<p class="el-geo-gap">${L(gap)}</p>` : ''}${renderTiles(seats)}`;
}

function refreshExplore() {
  activeMap = null;
  setExploreTitle();
  const body = $('el-explore-body');
  if (!body) return;
  body.innerHTML = renderExplore(eventById(state.event), officeById(eventById(state.event), state.office), seatCatalogue(state.event, state.office));
  syncStageButtons();
  syncMarks();
  showMap();
}

function setExploreTitle() {
  const title = $('el-explore-title');
  if (title) title.textContent = exploreTitle();
}

function loadMap(mapId) {
  if (!mapRequests.has(mapId)) {
    mapRequests.set(mapId, fetch(mapUrl(mapId)).then((response) => {
      if (!response.ok) throw new Error(`${response.status} ${mapId}`);
      return response.json();
    }).catch((error) => {
      mapRequests.delete(mapId);
      throw error;
    }));
  }
  return mapRequests.get(mapId);
}

// Phones keep the panel collapsed, so a closed panel costs no download.
function showMap() {
  const host = $('el-map');
  const body = $('el-explore-body');
  if (!host || !body || activeMap || getComputedStyle(body).display === 'none') return;
  const geography = geographyFor(state.event, state.office);
  if (!geography) return;
  const key = `${state.event}/${state.office}/${state.geographyView}`;
  const still = () => $('el-map') === host && key === `${state.event}/${state.office}/${state.geographyView}`;
  loadMap(geography.map).then((map) => {
    if (still()) renderMap(host, map);
  }).catch(() => {
    if (!still()) return;
    host.innerHTML = `<p class="el-geo-gap">${T('The map could not load. Every seat remains in the blocks, chamber and race list.', '地图未能加载。全部席位仍在席位块、议席图和比赛表中。')}</p>${renderTiles(seatCatalogue(state.event, state.office))}`;
    syncMarks();
  });
}

function mapLabel(level) {
  return (primary, members) => {
    if (level === 'district') return `${L(primary.label)} · ${seatStatus(primary)}`;
    if (level === 'region') return `${primary.group} · ${members.length} ${T('seats', '席')} · ${seatStatus(primary)}`;
    return `${primary.group} · ${seatStatus(primary)}`;
  };
}

function renderMissing(binding, seats) {
  if (!binding.missing.length) return '';
  const groups = new Map();
  for (const seat of binding.missing) {
    const key = seat.group || '';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(seat);
  }
  const rows = [...groups].map(([group, members]) => `<li>${group ? `<b>${group}</b> · ` : ''}${members.length} ${T('seats', '席')} · ${T('Coverage', '覆盖')} 0/${contestCount(members)}<span>${members.map((seat) => `<button type="button" class="el-seat-chip" data-seat="${seat.seatId}">${L(seat.label)}</button>`).join('')}</span></li>`).join('');
  return `<div class="el-geo-gap" id="el-map-gap"><p>${T(`${binding.missing.length} of ${seats.length} seats have no verified boundary on this map, so no shape is drawn for them.`, `${seats.length} 席中有 ${binding.missing.length} 席在此地图上没有经核验的边界，因此不画形状。`)}</p><ul>${rows}</ul></div>`;
}

function mapMarkup(event, office, geography, map, binding) {
  return mapSvg(map, binding, {
    states: currentStates(),
    parties: partiesOf(event),
    label: mapLabel(geography.level),
    ariaLabel: `${L(office.fullName)} · ${T('map', '地图')} · ${binding.bound.length}`,
    insetLabel: (code) => `${code}<tspan class="el-map-inset-word"> · ${T('inset', '插图')}</tspan>`,
  });
}

function renderMap(host, map) {
  const event = eventById(state.event);
  const office = officeById(event, state.office);
  const geography = geographyFor(event.id, office.id);
  const seats = seatCatalogue(event.id, office.id);
  const binding = bindFeatures(map.features, seats);
  activeMap = { map, binding, geography };
  const areas = geographyAreas(event.id, office.id);
  const hasOff = tallySeats(seats, NO_STATES).off > 0;
  host.innerHTML = `<div class="el-map-tools">
      <label for="el-area">${L(geography.areaLabel)}</label>
      <select id="el-area"><option value="">${T('All', '全部')}</option>${areas.map((area) => `<option value="${area.id}"${area.id === state.geographyArea ? ' selected' : ''}>${L(area.label)}</option>`).join('')}</select>
      <button type="button" class="el-btn el-btn-o" id="el-zoom-seat" disabled>${T('Zoom to seat', '缩放到席位')}</button>
      <span class="el-map-credit">${L(geography.credit)}</span>
    </div>
    ${mapMarkup(event, office, geography, map, binding)}
    <p class="el-chamber-readout" id="el-map-readout"></p>
    <p class="el-map-area" id="el-map-area" role="status"></p>
    ${hasOff ? `<ul class="el-chamber-key"><li><i class="el-neutral"></i>${L(NO_RESULT)}</li><li><i class="el-off"></i>${L(NOT_ON_BALLOT)}</li></ul>` : ''}
    ${renderMissing(binding, seats)}`;
  syncMarks();
  showAreaSummary();
  maybeStartTimelineSweep();
}

function showAreaSummary() {
  const host = $('el-map-area');
  if (!host) return;
  const seats = seatCatalogue(state.event, state.office);
  const area = geographyAreas(state.event, state.office).find((item) => item.id === state.geographyArea);
  const { seats: total, contests } = area ? areaSummary(seats, area.id) : { seats: 0, contests: 0 };
  if (!total) {
    host.textContent = '';
    return;
  }
  const covered = coveredSeats(areaMembers(seats, area.id), currentRaces());
  const counts = `${L(area.label)} · ${total} ${T('seats', '席')} · ${T('Coverage', '覆盖')} ${covered}/${contests}${covered ? '' : ` · ${L(NO_RESULT)}`}`;
  host.textContent = activeMap?.geography.map === 'us-house' ? `${counts} · ${T('Counts only: a state has no single House winner.', '仅为计数：一个州没有单一的众议院赢家。')}` : counts;
}

function applyMapView() {
  const svg = document.querySelector('.el-map-svg');
  if (!svg || !activeMap) return;
  const { map, binding } = activeMap;
  const selected = state.raceId ? seatFeature(binding, state.raceId) : null;
  const box = (zoomedSeat && seatFeature(binding, zoomedSeat)?.b) || (state.geographyArea && areaBox(map, binding, state.geographyArea));
  const viewBox = box ? zoomViewBox(box, map.viewBox) : map.viewBox;
  svg.setAttribute('viewBox', viewBox.join(' '));
  const unit = viewBox[2] / (svg.clientWidth || 1);
  svg.style.setProperty('--el-map-unit', unit);
  for (const outline of svg.querySelectorAll('.el-map-selected-halo, .el-map-selected-ring')) {
    outline.toggleAttribute('hidden', !selected);
    if (selected) outline.setAttribute('d', selected.d);
  }
  const ring = svg.querySelector('.el-map-locator');
  const small = selected && (selected.b[2] - selected.b[0]) / unit < 18;
  ring.toggleAttribute('hidden', !small);
  if (small) {
    ring.setAttribute('cx', selected.c[0]);
    ring.setAttribute('cy', selected.c[1]);
    ring.setAttribute('r', Math.round(14 * unit));
  }
}

const mapResize = typeof ResizeObserver === 'function' ? new ResizeObserver(() => applyMapView()) : null;

function tileLook(seat, compact) {
  if (!seat.onBallot) return { className: 'el-tile is-off', style: '', tag: '' };
  const mark = seatMark(seat, currentStates()[seat.seatId], partiesOf(eventById(state.event)));
  return {
    className: `el-tile${mark.status === 'neutral' ? '' : ` is-${mark.status}`}${mark.stale ? ' is-stale' : ''}`,
    style: mark.party ? `--seat:${mark.party.color}` : '',
    tag: mark.party && !compact ? `<span aria-hidden="true">${L(mark.party.tag)}</span>` : '',
  };
}

function renderTiles(seats) {
  if (!seats.length) return `<p class="el-empty">${T('No seat blocks for this office yet.', '此议院暂无席位块。')}</p>`;
  const groups = new Map();
  for (const seat of seats) {
    if (!groups.has(seat.group)) groups.set(seat.group, []);
    groups.get(seat.group).push(seat);
  }
  const compact = seats.length > 200;
  const blocks = [...groups].map(([group, members]) => `<div class="el-tile-group">
    ${group ? `<span class="el-tile-label">${group}</span>` : ''}
    <div class="el-tiles">${members.map((seat) => {
    const { className, style, tag } = tileLook(seat, compact);
    return `<button type="button" class="${className}"${style ? ` style="${style}"` : ''} data-seat="${seat.seatId}" tabindex="-1" aria-label="${L(seat.label)} · ${seatStatus(seat)}" title="${L(seat.label)}">${tag}</button>`;
  }).join('')}</div>
  </div>`).join('');
  return `<div class="el-tile-map${compact ? ' is-compact' : ''}${groups.size > 1 ? ' is-grouped' : ''}" data-roving>${blocks}</div>`;
}

function matchesQuery(seat, query) {
  if (!query) return true;
  const needle = query.toLowerCase();
  return seat.seatId.toLowerCase().includes(needle)
    || seat.label.en.toLowerCase().includes(needle)
    || seat.label.zh.toLowerCase().includes(needle)
    || (seat.group && seat.group.toLowerCase().includes(needle));
}

function renderRaces() {
  const event = eventById(state.event);
  const seats = seatCatalogue(event.id, state.office);
  const host = $('el-races-table');
  if (!seats.length) {
    host.innerHTML = `<p class="el-empty">${T('No contest list yet.', '暂无比赛列表。')}</p>`;
    return;
  }
  const sorted = sortSeats(seats, table.key, table.direction, tableStatus);
  const query = table.query.trim();
  const filtered = query ? sorted.filter((seat) => matchesQuery(seat, query)) : sorted;
  const selected = filtered.find((seat) => seat.seatId === state.raceId);
  const short = filtered.slice(0, INITIAL_ROWS);
  const rows = query || table.expanded ? filtered : selected && !short.includes(selected) ? [...short, selected] : short;

  if (!rows.length) {
    host.innerHTML = `<p class="el-empty">${T('No matching seats.', '无匹配席位。')}</p>`;
    return;
  }

  const us = event.family === 'us';
  const grouped = us ? seats.some((seat) => seat.group) : seats.some((seat) => seat.group && !seat.feature);
  const showTcp = !us && state.office !== 'council' && state.office !== 'senate';
  const parties = partiesOf(event);
  const races = currentRaces();
  const showUpdated = !isBaselineForOffice(state.office) && [...races.values()].some((race) => race.provenance?.sourceUpdatedAt);
  const heading = (key, label, optional = false) => {
    const active = table.key === key;
    const sortAttr = active ? ` aria-sort="${table.direction === 'asc' ? 'ascending' : 'descending'}"` : '';
    return `<th scope="col"${optional ? ' class="el-opt"' : ''}${sortAttr}><button type="button" data-sort="${key}">${label}<span aria-hidden="true">${active ? (table.direction === 'asc' ? ' ↑' : ' ↓') : ''}</span></button></th>`;
  };
  const textHeading = (label, optional = true) => `<th scope="col"${optional ? ' class="el-opt"' : ''}>${label}</th>`;
  const numHeading = (label, optional = true) => `<th scope="col" class="${optional ? 'el-opt ' : ''}el-num">${label}</th>`;
  const progressHeading = (label) => `<th scope="col" class="el-num el-col-progress">${label}</th>`;
  const auProgressCol = hasShownForOffice(state.office) && !isBaselineForOffice(state.office) ? T('Places', '投票点') : T('Counted', '已计');
  const head = us
    ? [
      heading('seat', T('Seat', '席位')),
      ...(grouped ? [heading('group', T('State', '州'), true)] : []),
      textHeading(T('Leader', '领先者')),
      numHeading(T('Margin', '差距')),
      progressHeading(T('Reporting', '已报告')),
      heading('status', T('Status', '状态')),
      ...(showUpdated ? [numHeading(T('Updated', '更新'))] : []),
    ]
    : [
      heading('seat', T('Electorate', '选区')),
      ...(grouped ? [heading('group', T('Region', '大区'), true)] : []),
      progressHeading(auProgressCol),
      textHeading(T('Primary', '第一优先')),
      ...(showTcp ? [textHeading(T('TCP', '两候选人'))] : []),
      heading('status', T('Status', '状态')),
      ...(showUpdated ? [numHeading(T('Updated', '更新'))] : []),
    ];
  const textCell = (text, optional = true, race = null) => (
    text === null
      ? `<td class="${optional ? 'el-opt ' : ''}el-col-text" title="${race ? NOT_PUBLISHED() : NOT_LOADED()}">${DASH}</td>`
      : `<td class="${optional ? 'el-opt ' : ''}el-col-text"><span title="${text}">${text}</span></td>`
  );
  const numCell = (text, optional = true, race = null) => (
    text === null
      ? `<td class="${optional ? 'el-opt ' : ''}el-num" title="${race ? NOT_PUBLISHED() : NOT_LOADED()}">${DASH}</td>`
      : `<td class="${optional ? 'el-opt ' : ''}el-num">${text}</td>`
  );
  const progressCell = (text, race = null) => (
    text === null
      ? `<td class="el-num el-col-progress" title="${race ? NOT_PUBLISHED() : NOT_LOADED()}">${DASH}</td>`
      : `<td class="el-num el-col-progress">${text}</td>`
  );

  const body = rows.map((seat) => {
    const race = races.get(seat.seatId);
    const mark = seat.onBallot ? seatMark(seat, currentStates()[seat.seatId], parties) : null;
    const badge = mark?.party ? renderPartyBadge(event.family, mark.party.id, 'xs') : '';
    const seatCell = `<th scope="row"><button type="button" class="el-seat-link" data-seat="${seat.seatId}">${L(seat.label)}</button></th>`;
    const fullStatus = seatStatus(seat);
    const shortStatus = tableStatus(seat);
    const status = `<td class="el-col-status"><span class="el-status${seat.onBallot ? '' : ' is-off'}" data-status="${esc(currentStates()[seat.seatId]?.status || 'neutral')}" title="${esc(fullStatus)}">${badge}<span>${shortStatus}</span></span></td>`;
    const age = showUpdated ? (race ? sourceAgeCell(race) : numCell(null, true, null)) : '';
    const cells = us
      ? [
        seatCell,
        ...(grouped ? [`<td class="el-opt el-col-code">${seat.group}</td>`] : []),
        textCell(race ? leaderName(race) : null, true, race),
        numCell(race ? marginText(race) : null, true, race),
        progressCell(race ? progressText(race, { short: true }) : null, race),
        status,
        age,
      ]
      : [
        seatCell,
        ...(grouped ? [`<td class="el-opt el-col-text" title="${esc(seat.group)}">${esc(seat.group)}</td>`] : []),
        progressCell(race ? progressText(race, { short: true }) : null, race),
        textCell(race ? leaderName(race, primaryLeader) : null, true, race),
        ...(showTcp ? [textCell(race ? tcpText(race) : null, true, race)] : []),
        status,
        age,
      ];
    return `<tr data-row="${seat.seatId}">${cells.join('')}</tr>`;
  }).join('');

  const canExpand = !query && seats.length > INITIAL_ROWS;
  host.innerHTML = `<div class="el-table-scroll" tabindex="0" role="region" aria-labelledby="el-table-caption"><table class="el-table">
      <caption class="el-sr" id="el-table-caption">${L(event.name)} · ${L(officeById(event, state.office).fullName)}</caption>
      <thead><tr>${head.join('')}</tr></thead><tbody>${body}</tbody>
    </table></div>
    <div class="el-races-foot">
      <span class="el-races-count" id="el-races-count">${rows.length} / ${seats.length}</span>
      ${canExpand ? `<button type="button" class="el-btn el-btn-o el-btn-sm" data-expand>${table.expanded ? T('Show fewer', '收起') : T(`Show all ${seats.length}`, `全部 ${seats.length} 项`)}</button>` : ''}
    </div>`;
  markSelected();
}

const leaderName = (race, pick = contestLeader) => {
  const leader = pick(race);
  return leader ? esc(leader.name) : null;
};

function marginText(race) {
  if (!contestLeader(race)) return null;
  const counted = race.candidates.map((candidate) => candidate.votes).filter((votes) => votes !== null).sort((a, b) => b - a);
  return counted.length > 1 ? (counted[0] - counted[1]).toLocaleString('en-AU') : null;
}

function progressText(race, { short = false } = {}) {
  const { unit, reported, total } = race.progress;
  if (reported === null || total === null) return null;
  if (unit === 'percent') return short ? `${reported}%` : T(`${reported}% reported (source estimate)`, `已报告 ${reported}%（来源估计）`);
  if (short) return `${reported}/${total}`;
  const words = { polling_places: T('places', '个投票点'), precincts: T('precincts', '个选区'), counties: T('counties', '个县'), localities: T('localities', '个地点'), expected_votes: T('expected votes', '预计票数') };
  return `${reported}/${total} ${words[unit] || ''}`;
}

function tcpText(race) {
  const two = race.twoCandidate;
  if (two?.status === 'withheld') return T('Withheld by source', '来源暂不公布');
  if (two?.status !== 'available') return null;
  const leader = contestLeader(race);
  const [first, second] = two.candidates;
  if (first.votes === null || second.votes === null) return null;
  if (!leader) return first.votes > 0 ? T('Tied', '持平') : null;
  const sum = first.votes + second.votes;
  const votes = two.candidates.find((item) => item.candidateId === leader.candidateId).votes;
  return `${((votes / sum) * 100).toFixed(1)}% ${esc(leader.name)}`;
}

function formatAge(seconds) {
  if (seconds === null) return DASH;
  if (seconds < 60) return T('under 1 min', '不到 1 分钟');
  if (seconds < 3600) return T(`${Math.floor(seconds / 60)} min`, `${Math.floor(seconds / 60)} 分钟`);
  if (seconds < 172800) return T(`${Math.floor(seconds / 3600)} h`, `${Math.floor(seconds / 3600)} 小时`);
  return T(`${Math.floor(seconds / 86400)} days`, `${Math.floor(seconds / 86400)} 天`);
}

const formatDay = (isoDate) => new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : 'en-AU', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${isoDate}T00:00:00Z`));

function formatTime(iso) {
  if (!iso) return DASH;
  const { family } = eventById(state.event);
  const timeZone = family === 'us' ? 'America/New_York' : 'Australia/Melbourne';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return DASH;
  const text = new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : 'en-AU', { timeZone, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
  return `${text} ${family === 'us' ? 'ET' : T('Melbourne', '墨尔本')}`;
}

function sourceAgeCell(race) {
  const age = formatAge(ageSeconds(race.provenance.sourceUpdatedAt, ageClock()));
  const stale = raceFreshness(race, shown.pointer) === 'stale';
  return `<td class="el-opt el-num${stale ? ' is-stale' : ''}" title="${esc(formatTime(race.provenance.sourceUpdatedAt))}">${age}${stale ? ` · ${T('stale', '已过时')}` : ''}</td>`;
}

const swingNote = (event, office) => geographyFor(event.id, office.id)?.swing || { en: 'Not computed: no verified baseline is loaded.', zh: '未计算：尚未加载经核验的基准。' };

function renderSourcesInner(event, seats) {
  const vocabulary = statusVocabulary(event);
  const office = officeById(event, state.office);
  const geography = geographyFor(event.id, office.id);
  const legend = [
    ['neutral', vocabulary.notStarted], ['neutral', vocabulary.counting], ['leading', vocabulary.leading],
    ['called', vocabulary.called], ['final', vocabulary.final], ['unavailable', vocabulary.unavailable],
  ].map(([kind, label]) => `<li><i class="el-sw el-sw-${kind}"></i>${L(label)}</li>`).join('');
  const feedSource = feed?.state.pointer?.sources?.[0];
  const source = isReplay() ? null : feedSource;
  return `<div class="el-sources-head">
      <h2 id="el-sources-title">${T('Sources & status', '来源与状态')}</h2>
      <button type="button" class="el-drawer-close" data-sources-close popovertarget="el-sources" popovertargetaction="hide" aria-label="${T('Close sources', '关闭来源说明')}">×</button>
    </div>
    <dl class="el-kv">
      <dt>${T('Mode', '模式')}</dt><dd>${L(modeLabel())}</dd>
      <dt>${T('Coverage', '覆盖')}</dt><dd>${seats.length ? `${coveredSeats(seats, currentRaces())} ${T('of', '/')} ${contestCount(seats)}` : DASH}</dd>
      <dt>${T('Feed', '数据源')}</dt><dd>${feedSource ? (feedSource.url ? `<a href="${esc(feedSource.url)}" target="_blank" rel="noopener noreferrer">${esc(feedSource.name)} ↗</a>` : esc(feedSource.name)) : L(event.feed)}</dd>
      ${isBaselineForOffice(office.id) ? `<dt>${T('Baseline', '上届基准')}</dt><dd>${L(shown.snapshot.baselineDetail)}</dd>` : ''}
      ${source ? `<dt>${T('Feed status', '数据源状态')}</dt><dd>${feedStatusText(source)}</dd>` : ''}
      <dt>${T('Geography', '地理')}</dt><dd>${geography ? L(geography.source) : T('Schematic only · no verified boundaries', '仅示意 · 无经核验的边界')}</dd>
      <dt>${T('Swing', '摆动')}</dt><dd>${L(swingNote(event, office))}</dd>
      <dt>${T('Polls', '投票')}</dt><dd>${L(event.dateLabel)} · ${L(event.pollsClose)}</dd>
      <dt>${T('Voting', '投票制度')}</dt><dd>${L(event.votingSystem)}</dd>
      ${isReplay() ? `<dt>${T('Recorded', '记录时间')}</dt><dd>${formatTime(shown.snapshot.publishedAt)}</dd>` : `<dt>${T('Last check', '上次检查')}</dt><dd>${source ? formatTime(source.lastCheckedAt) : DASH}</dd>`}
      ${source ? `<dt>${T('Newest source time', '最新来源时间')}</dt><dd>${formatTime(source.sourceUpdatedAt)}</dd>` : ''}
    </dl>
    <p class="el-note">${L(event.note)}</p>
    <details class="el-legend">
      <summary>${T('Status legend', '状态图例')}</summary>
      <ul>${legend}</ul>
    </details>
    <a class="el-link" href="${event.officialUrl}" target="_blank" rel="noopener noreferrer">${L(event.officialLabel)} ↗</a>`;
}

/* ---------- Feed, refresh and replay ---------- */

const CHANGE_WORDS = Object.freeze({
  new_batch: { en: 'New batch', zh: '新一批' },
  correction: { en: 'Correction', zh: '更正' },
  rcv_transition: { en: 'Round change', zh: '轮次变化' },
  call: { en: 'Called', zh: '判定' },
  call_rescinded: { en: 'Decision withdrawn', zh: '判定撤销' },
  decision_changed: { en: 'Decision changed', zh: '判定变更' },
  count_basis_change: { en: 'Different count', zh: '计票方式变化' },
  certification: { en: 'Declared', zh: '正式宣布' },
  source_switch: { en: 'Source switch', zh: '更换来源' },
  tcp_pair_change: { en: 'Two-candidate pair changed', zh: '两候选人组合变化' },
});
const ERROR_WORDS = Object.freeze({
  timeout: { en: 'timed out', zh: '超时' },
  rate_limited: { en: 'rate limited', zh: '被限流' },
  malformed: { en: 'malformed file', zh: '文件损坏' },
  schema_drift: { en: 'unexpected format', zh: '格式异常' },
  wrong_identity: { en: 'wrong election in file', zh: '文件不是本场选举' },
  gone: { en: 'file gone', zh: '文件消失' },
});

const localFeedBase = () => (isLocalHost(window.location.hostname) && window.__ELECTION_FEED_BASE__) || ELECTION_FEED_BASE;
const civicSource = sourceById('civicapi');
const browserFeed = (event) => (!localFeedBase() && event?.id === civicSource.eventId && civicSource.enabled && civicSource.browserDirect
  ? { base: CIVIC_BASE, fetchJson: createCivicReader({ fetchJson: fetchCivicJson }) }
  : null);

function modeLabel() {
  if (!hasShownForOffice()) return { en: 'Preview · no live results', zh: '预览 · 无实时结果' };
  if (isBaselineForOffice()) {
    return {
      en: `${shown.snapshot.baselineLabel.en} · official final results`,
      zh: `${shown.snapshot.baselineLabel.zh} · 官方最终结果`,
    };
  }
  const kind = shown.snapshot.isSynthetic ? { en: 'synthetic test data', zh: '合成测试数据' } : { en: 'unofficial count', zh: '非正式计票' };
  if (isReplay()) return { en: `Replay · ${kind.en}`, zh: `回放 · ${kind.zh}` };
  if (feed?.state.paused) return { en: `Paused · ${kind.en}`, zh: `已暂停 · ${kind.zh}` };
  if (feed?.state.status === 'error') return { en: `Last good data · ${kind.en}`, zh: `上次的有效数据 · ${kind.zh}` };
  return { en: `Refreshing · ${kind.en}`, zh: `自动刷新 · ${kind.zh}` };
}

function feedStatusText(source) {
  if (source.status === 'ok') return feed.state.status === 'error' ? T('OK at the last successful read', '上次成功读取时正常') : T('OK', '正常');
  const reason = ERROR_WORDS[source.lastError?.kind];
  return `${T('Failing, showing the last good data', '失败，显示上次的有效数据')}${reason ? ` · ${L(reason)}` : ''} · ${T('last good', '上次成功')} ${formatTime(source.lastSuccessAt)}`;
}

function footText() {
  if (shown?.snapshot.isSynthetic) return T('Synthetic test data on this computer only. No real results are loaded, and none of this is published.', '合成测试数据，只在本机显示。未加载任何真实结果，也没有对外发布。');
  if (isBaselineForOffice()) {
    const baseline = baselineFor(state.event);
    return `${baseline ? `${L(baseline.credit)} · ` : ''}${T('Seat numbers, dates and electorate names checked Nov 2026.', '席位数、日期和选区名称已于 2026 年 11 月对照官方来源核对。')}`;
  }
  if (shown?.snapshot.sourceIds.includes('civicapi')) return T('Unofficial counts and calls from civicAPI (civicapi.org), read directly by your browser. States certify official results later.', '非正式计票和判定来自 civicAPI（civicapi.org），由你的浏览器直接读取。正式结果由各州稍后认证。');
  if (hasShownForOffice()) return T('Unofficial counts from the named source. Check the official site for declared results.', '来自具名来源的非正式计票。正式结果以官方网站为准。');
  return T('Seat numbers, dates and electorate names checked against official sources Nov 2026.', '席位数、日期和选区名称已于 2026 年 11 月对照官方来源核对。');
}

// Surfaces live feed alerts and snapshot corrections inline; completely hidden in quiet preview.
function renderFeedBanner() {
  const note = feed?.state.pointer
    ? feed.state.status === 'error'
      ? T(`Could not refresh at ${formatTime(feed.state.lastAttemptAt)}. This is the last good data.`, `${formatTime(feed.state.lastAttemptAt)} 刷新失败，这是上次的有效数据。`)
      : feed.state.paused ? T(`Paused. Checked ${formatTime(feed.state.lastAttemptAt)}.`, `已暂停，上次检查 ${formatTime(feed.state.lastAttemptAt)}。`) : ''
    : '';
  const changes = shown?.snapshot.changes || [];
  if (!note && !changes.length) return '<div class="el-feed-banner" id="el-feed-banner" hidden></div>';
  const raceName = (raceId) => shown?.snapshot.races.find((race) => race.raceId === raceId)?.contestName || raceId;
  const delta = (change) => (change.delta ? ` ${change.delta > 0 ? '+' : ''}${esc(change.delta.toLocaleString('en-AU'))}` : '');
  return `<div class="el-feed-banner${feed?.state.status === 'error' ? ' is-error' : ''}" id="el-feed-banner">
    ${note ? `<p class="el-feed-note" id="el-feed-note">${note}</p>` : ''}
    ${changes.length ? `<ul class="el-changes">${changes.slice(0, 5).map((change) => `<li><b>${L(CHANGE_WORDS[change.type])}</b>${delta(change)} · ${esc(raceName(change.raceId))}</li>`).join('')}${changes.length > 5 ? `<li>+${changes.length - 5}</li>` : ''}</ul>` : ''}
  </div>`;
}

const replayHistory = () => feed?.state.pointer?.history || [];

function renderReplay() {
  const history = replayHistory();
  if (history.length < 2) {
    return '<section class="el-replay" id="el-replay" hidden></section>';
  }
  if (!isReplay()) {
    return `<section class="el-panel el-replay" id="el-replay" aria-labelledby="el-replay-title">
      <h2 id="el-replay-title"><button type="button" data-replay="start">${T('Replay election night', '回放开票夜')}</button></h2>
      <span class="el-note">${T(`${history.length} recorded snapshots`, `${history.length} 个已记录快照`)}</span>
    </section>`;
  }
  const entry = history[replayIndex];
  return `<section class="el-panel el-replay is-active" id="el-replay" aria-labelledby="el-replay-title">
      <h2 id="el-replay-title">${T('Replay', '回放')}</h2>
      <div class="el-replay-tools">
        <button type="button" class="el-btn el-btn-o el-btn-sm" data-replay="prev" ${replayIndex === 0 ? 'disabled' : ''}>${T('Earlier', '上一个')}</button>
        <input type="range" id="el-replay-range" min="0" max="${history.length - 1}" value="${replayIndex}" aria-label="${T('Recorded snapshot', '已记录的快照')}">
        <button type="button" class="el-btn el-btn-o el-btn-sm" data-replay="next" ${replayIndex === history.length - 1 ? 'disabled' : ''}>${T('Later', '下一个')}</button>
        <button type="button" class="el-btn el-btn-sm" data-replay="exit">${T('Back to latest', '回到最新')}</button>
      </div>
      <p class="el-note" id="el-replay-position">${T(`Snapshot ${replayIndex + 1} of ${history.length} · recorded ${formatTime(entry.publishedAt)}`, `第 ${replayIndex + 1} 个，共 ${history.length} 个 · 记录于 ${formatTime(entry.publishedAt)}`)}</p>
    </section>`;
}

function renderConsoleStrip(event, office, seats) {
  const strip = $('el-strip');
  const flag = $('el-strip-flag');
  const hasOfficeData = hasShownForOffice(office.id);
  const baseline = isBaselineForOffice(office.id);
  strip.dataset.mode = isReplay()
    ? 'replay'
    : baseline
      ? 'baseline'
      : hasOfficeData
        ? (shown.snapshot.isSynthetic ? 'synthetic' : 'live')
        : 'preview';
  if (!hasOfficeData) setText(flag, 'Preview', '预览');
  else if (isReplay()) setText(flag, 'Replay · not live', '回放 · 非实时');
  else if (baseline) setText(flag, shown.snapshot.baselineLabel.en, shown.snapshot.baselineLabel.zh);
  else if (shown.snapshot.isSynthetic) setText(flag, 'Synthetic test data', '合成测试数据');
  else setText(flag, 'Unofficial results', '非正式结果');

  const races = hasOfficeData ? officeRacesOf(office.id) : [];
  const stale = races.filter((race) => raceFreshness(race, shown.pointer) === 'stale').length;
  const source = shown?.pointer?.sources?.[0];
  const meta = [
    seats.length ? `${T('Coverage', '覆盖')} ${coveredSeats(seats, currentRaces())}/${contestCount(seats)}` : `${T('Coverage', '覆盖')} ${DASH}`,
    ...(source && !isReplay() ? [`${T('Checked', '检查')} ${formatAge(ageSeconds(source.lastCheckedAt, Date.now()))}`] : []),
    ...(stale ? [`<em>${T(`${stale} stale`, `${stale} 场已过时`)}</em>`] : []),
    event.timeLabel,
  ].map((item) => `<span>${item}</span>`).join('');
  $('el-strip-meta').innerHTML = `${meta}<button type="button" class="el-source-btn" id="el-source-btn" popovertarget="el-sources">${T('Sources', '来源')} <span aria-hidden="true">ⓘ</span></button>`;
}

function setShown(snapshot, pointer, { isBaseline = false } = {}) {
  shown = snapshot ? { snapshot, pointer, states: seatStates(snapshot, pointer), races: raceIndex(snapshot), isBaseline } : null;
}

function loadBaseline(file) {
  if (!baselineRequests.has(file)) {
    baselineRequests.set(file, fetch(baselineUrl(file)).then((response) => {
      if (!response.ok) throw new Error(`${response.status} ${file}`);
      return response.json();
    }).then((data) => {
      if (snapshotErrors(data).length) throw new Error(`Invalid baseline ${file}`);
      return data;
    }).catch((error) => {
      baselineRequests.delete(file);
      throw error;
    }));
  }
  return baselineRequests.get(file);
}

function fetchCivicJson(url) {
  return fetch(url, { cache: 'no-cache', credentials: 'omit', referrerPolicy: 'no-referrer' }).then((response) => {
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  });
}

function fetchFeedJson(url) {
  return fetch(url, { cache: 'no-cache', signal: AbortSignal.timeout(20000) }).then((response) => {
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  });
}

function syncFeed(event) {
  if (feedEventId === event?.id) return;
  stopTimelineSweep(false);
  feed?.stop();
  clearTimeout(vecStartTimer);
  feed = null;
  shown = null;
  replayIndex = null;
  feedEventId = event?.id ?? null;
  const direct = browserFeed(event);
  const local = localFeedBase();
  const vec = event?.id === 'vic-2026';
  const untilClose = Date.parse(VEC_POLLS_CLOSE) - Date.now();
  const base = direct?.base || local || (vec && untilClose <= 0 ? VEC_PUBLIC_FEED_BASE : null);
  if (vec && !base) {
    vecStartTimer = setTimeout(() => {
      feedEventId = null;
      syncFeed(event);
      refreshResults();
    }, Math.min(untilClose, 2147483647));
  }
  if (!event || !base) {
    const baseline = event ? baselineFor(event.id) : null;
    if (baseline) {
      loadBaseline(baseline.file).then((snapshot) => {
        if (feedEventId !== event.id || feed || isReplay() || shown?.snapshot) return;
        setShown(snapshot, null, { isBaseline: true });
        refreshResults();
      }).catch(() => {});
    }
    return;
  }
  feed = createFeedController({
    base,
    eventId: event.id,
    hostname: window.location.hostname,
    serverApprovedSource: vec && (!local || window.__VEC_PRIVATE_PREVIEW__ === true) ? 'vec-2026' : undefined,
    fetchJson: direct?.fetchJson || fetchFeedJson,
    isHidden: () => document.hidden,
    onChange: feedChanged,
  });
  feed.start();
}

function feedChanged({ snapshot, pointer }) {
  if (!state.event) return;
  const changed = !isReplay() && (snapshot !== shown?.snapshot || pointer !== shown?.pointer);
  const arrived = changed && snapshot && snapshot !== shown?.snapshot;
  if (changed) setShown(snapshot, pointer);
  refreshResults();
  if (arrived) $('el-live').textContent = T(`Updated. Recorded ${formatTime(snapshot.publishedAt)}.`, `已更新，记录于 ${formatTime(snapshot.publishedAt)}。`);
}

function repaintMarks(svg, markup) {
  if (!svg) return;
  const template = document.createElement('template');
  template.innerHTML = markup;
  const next = template.content.firstElementChild;
  const defs = next.querySelector(':scope > defs');
  svg.querySelector(':scope > defs')?.remove();
  if (defs) svg.prepend(defs);
  const tags = next.querySelector(':scope > .el-seat-tags');
  if (tags) svg.querySelector(':scope > .el-seat-tags')?.replaceWith(tags);
  const byId = new Map([...next.querySelectorAll('[data-seat]')].map((mark) => [mark.dataset.feature || mark.dataset.seat, mark]));
  for (const mark of svg.querySelectorAll('[data-seat]')) {
    const source = byId.get(mark.dataset.feature || mark.dataset.seat);
    if (!source) continue;
    mark.setAttribute('class', source.getAttribute('class'));
    mark.setAttribute('aria-label', source.getAttribute('aria-label'));
    mark.toggleAttribute('data-record', source.hasAttribute('data-record'));
    if (source.hasAttribute('style')) mark.setAttribute('style', source.getAttribute('style'));
    else mark.removeAttribute('style');
  }
}

function keepFocus(update) {
  const active = document.activeElement;
  const host = active?.closest?.('#el-races-table, #el-sources, #el-drawer, #el-replay, #el-tally, #el-hero-controls, #el-strip');
  const attribute = active && ['data-seat', 'data-sort', 'data-replay', 'data-close', 'data-expand', 'data-sources-close'].find((name) => active.hasAttribute?.(name));
  const name = !host || !active ? null
    : active.id ? `#${active.id}`
      : attribute ? `#${host.id} [${attribute}="${active.getAttribute(attribute)}"]` : null;
  update();
  if (name && !active.isConnected) document.querySelector(name)?.focus({ preventScroll: true });
}

function refreshResults() {
  stopTimelineSweep(true);
  const event = eventById(state.event);
  const office = officeById(event, state.office);
  const seats = seatCatalogue(event.id, office.id);
  const unit = office.unit ? L(office.unit) : T('seats', '席');
  keepFocus(() => {
    syncFeedButton();
    renderConsoleStrip(event, office, seats);
    $('el-feed-banner').outerHTML = renderFeedBanner();
    $('el-tally').outerHTML = renderTally(event, office, seats, unit);
    if (office.geometry) repaintMarks(document.querySelector('.el-chamber-svg'), chamberMarkup(event, office, seats));
    if (activeMap) repaintMarks(document.querySelector('.el-map-svg'), mapMarkup(event, office, activeMap.geography, activeMap.map, activeMap.binding));
    for (const tile of document.querySelectorAll('.el-tile')) {
      const seat = seats.find((item) => item.seatId === tile.dataset.seat);
      if (!seat) continue;
      const { className, style, tag } = tileLook(seat, Boolean(tile.closest('.is-compact')));
      tile.className = className;
      if (style) tile.setAttribute('style', style);
      else tile.removeAttribute('style');
      tile.innerHTML = tag;
      tile.setAttribute('aria-label', `${L(seat.label)} · ${seatStatus(seat)}`);
    }
    renderRaces();
    const sourcesEl = $('el-sources');
    const legendOpen = sourcesEl.querySelector('.el-legend')?.open;
    sourcesEl.innerHTML = renderSourcesInner(event, seats);
    if (legendOpen) sourcesEl.querySelector('.el-legend').open = true;
    $('el-replay').outerHTML = renderReplay();
    $('el-foot').textContent = footText();
    const drawer = $('el-drawer');
    const seat = seats.find((item) => item.seatId === state.raceId);
    if (seat && !drawer.hidden) {
      const { scrollTop } = drawer;
      drawer.innerHTML = renderDrawer(event, office, seat);
      drawer.scrollTop = scrollTop;
    }
    syncMarks();
    showAreaSummary();
  });
  maybeStartTimelineSweep();
}

function raceMarginRatio(race) {
  if (!race) return 0;
  if (race.twoCandidate?.status === 'available') {
    const [a, b] = race.twoCandidate.candidates;
    if (a?.votes !== null && b?.votes !== null && (a.votes + b.votes) > 0) {
      return Math.abs(a.votes - b.votes) / (a.votes + b.votes);
    }
  }
  const counted = (race.candidates || []).map((c) => c.votes).filter((v) => Number.isInteger(v) && v >= 0).sort((a, b) => b - a);
  const sum = counted.reduce((acc, v) => acc + v, 0);
  if (counted.length >= 2 && sum > 0) return (counted[0] - counted[1]) / sum;
  return counted.length === 1 && sum > 0 ? 1 : 0;
}

function orderSweepSeats(event, colored) {
  const races = currentRaces();
  const centroids = new Map();
  if (activeMap) {
    for (const item of colored) {
      const feature = seatFeature(activeMap.binding, item.seat.seatId);
      if (Array.isArray(feature?.c) && feature.c.length === 2) centroids.set(item.seat.seatId, feature.c);
    }
  }
  const xs = [...centroids.values()].map(([x]) => x).sort((a, b) => a - b);
  const ys = [...centroids.values()].map(([, y]) => y).sort((a, b) => a - b);
  const minX = xs[0] ?? 0;
  const maxX = xs[xs.length - 1] ?? 1;
  const spanX = Math.max(1, maxX - minX);
  const medX = xs.length ? xs[Math.floor(xs.length / 2)] : 0;
  const medY = ys.length ? ys[Math.floor(ys.length / 2)] : 0;
  const maxDist = Math.max(1, ...[...centroids.values()].map(([x, y]) => Math.hypot(x - medX, y - medY)));

  const scored = colored.map((item, idx) => {
    const race = races.get(item.seat.seatId);
    const decidedIso = race?.decision?.decidedAt || race?.provenance?.sourceUpdatedAt;
    const decidedMs = decidedIso ? Date.parse(decidedIso) : Number.NaN;
    const margin = raceMarginRatio(race);
    const marginRank = 1 - Math.min(1, margin * 2.6);
    const coords = centroids.get(item.seat.seatId);
    let geoRank = idx / Math.max(1, colored.length - 1);
    if (coords) {
      geoRank = event.family === 'us'
        ? (maxX - coords[0]) / spanX
        : Math.hypot(coords[0] - medX, coords[1] - medY) / maxDist;
    }
    const waveScore = event.family === 'us'
      ? (0.68 * geoRank) + (0.32 * marginRank)
      : (0.46 * geoRank) + (0.54 * marginRank);
    return { ...item, timeMs: Number.isFinite(decidedMs) ? decidedMs : null, waveScore };
  });

  const distinctTimes = new Set(scored.map((s) => s.timeMs).filter((t) => t !== null));
  scored.sort((a, b) => {
    if (distinctTimes.size > 1 && a.timeMs !== b.timeMs) {
      if (a.timeMs === null) return 1;
      if (b.timeMs === null) return -1;
      return a.timeMs - b.timeMs;
    }
    return a.waveScore - b.waveScore;
  });
  return scored;
}

function stopTimelineSweep(snapToFinal = true) {
  if (!activeSweep) return;
  const sweep = activeSweep;
  activeSweep = null;
  cancelAnimationFrame(sweep.rafId);
  if (snapToFinal) sweep.finish();
  else delete document.body.dataset.sweeping;
}

function maybeStartTimelineSweep() {
  if (!state.event || isReplay()) return;
  const viewKey = `${state.event}/${state.office}`;
  if (animatedViews.has(viewKey) || activeSweep?.viewKey === viewKey) return;
  const event = eventById(state.event);
  const office = officeById(event, state.office);
  if (!hasShownForOffice(office.id)) return;

  const geography = geographyFor(event.id, office.id);
  const exploreBody = $('el-explore-body');
  const waitingForMap = Boolean(
    geography
    && state.geographyView === 'map'
    && exploreBody
    && getComputedStyle(exploreBody).display !== 'none'
    && !activeMap,
  );
  if (waitingForMap) return;

  animatedViews.add(viewKey);
  if (REDUCED_MOTION_QUERY?.matches) return;

  const seats = seatCatalogue(event.id, office.id);
  const parties = partiesOf(event);
  const states = currentStates();
  const colored = seats.flatMap((seat) => {
    if (!seat.onBallot) return [];
    const mark = seatMark(seat, states[seat.seatId], parties);
    return mark.party ? [{ seat, mark }] : [];
  });
  if (!colored.length) return;

  const ordered = orderSweepSeats(event, colored);
  const mapSvgEl = document.querySelector('.el-map-svg');
  const chamberSvgEl = document.querySelector('.el-chamber-svg');
  const tagsGroup = chamberSvgEl?.querySelector(':scope > .el-seat-tags');
  const captureEl = (el, neutralClass, clearHtml = false) => {
    if (!el) return null;
    const saved = {
      el,
      cls: el.getAttribute('class') || '',
      style: el.getAttribute('style'),
      record: el.hasAttribute('data-record'),
      html: clearHtml ? el.innerHTML : null,
    };
    el.setAttribute('class', `${neutralClass}${holdsRace(el) ? ' is-selected' : ''}`);
    el.removeAttribute('style');
    el.removeAttribute('data-record');
    if (clearHtml) el.innerHTML = '';
    return saved;
  };
  const restoreEl = (saved) => {
    if (!saved) return;
    const baseCls = saved.cls.replace(/\bis-selected\b/g, '').trim();
    saved.el.setAttribute('class', `${baseCls}${holdsRace(saved.el) ? ' is-selected' : ''}`);
    if (saved.style) saved.el.setAttribute('style', saved.style);
    else saved.el.removeAttribute('style');
    saved.el.toggleAttribute('data-record', saved.record);
    if (saved.html !== null) saved.el.innerHTML = saved.html;
  };

  const targets = ordered.map(({ seat, mark }) => ({
    partyId: mark.party.id,
    kind: mark.status === 'leading' ? 'leading' : 'decided',
    map: captureEl(mapSvgEl?.querySelector(`[data-seat="${seat.seatId}"]`), 'el-feature is-neutral'),
    chamber: captureEl(chamberSvgEl?.querySelector(`[data-seat="${seat.seatId}"]`), 'el-seat is-neutral'),
    tile: captureEl(document.querySelector(`.el-tile-map [data-seat="${seat.seatId}"]`), 'el-tile', true),
  }));

  if (tagsGroup) {
    tagsGroup.style.opacity = '0';
    tagsGroup.style.transition = 'opacity 200ms ease-out';
  }

  const finalCounts = partyTally(seats, states, parties);
  const running = Object.fromEntries(parties.map((p) => [p.id, { decided: 0, leading: 0 }]));
  const keyEls = new Map(parties.map((p) => [p.id, document.querySelector(`#el-tally .el-tally-keys li[data-party="${p.id}"]`)]));
  const segEls = new Map();
  for (const p of parties) {
    for (const kind of ['decided', 'leading']) {
      const el = document.querySelector(`#el-tally .el-tally-seg[data-party="${p.id}"][data-kind="${kind}"]`);
      if (el) segEls.set(`${p.id}:${kind}`, el);
    }
  }
  const openCountEl = $('el-tally-open-count');
  const baseOpen = openCountEl ? Number.parseInt(openCountEl.textContent, 10) || 0 : 0;
  const sweepWrap = $('el-tally-sweep');
  const sweepBar = $('el-tally-sweep-bar');
  if (sweepWrap && sweepBar) {
    sweepWrap.hidden = false;
    sweepBar.style.transform = 'scaleX(0)';
  }
  document.body.dataset.sweeping = 'true';

  const syncTallyFrame = (countsObj, remaining) => {
    for (const p of parties) {
      const li = keyEls.get(p.id);
      const c = countsObj[p.id];
      const bEl = li?.querySelector('b');
      if (bEl) bEl.textContent = String(c.decided);
      const smEl = li?.querySelector('small');
      if (smEl) {
        smEl.hidden = c.leading === 0;
        if (c.leading > 0) smEl.textContent = `+${c.leading} ${T('leading', '领先')}`;
      }
      const decSeg = segEls.get(`${p.id}:decided`);
      if (decSeg) decSeg.style.width = `${(c.decided / office.seats) * 100}%`;
      const leadSeg = segEls.get(`${p.id}:leading`);
      if (leadSeg) leadSeg.style.width = `${(c.leading / office.seats) * 100}%`;
    }
    if (openCountEl) openCountEl.textContent = String(baseOpen + remaining);
  };

  syncTallyFrame(running, targets.length);

  let cursor = 0;
  const duration = targets.length <= 5 ? 300 : targets.length <= 100 ? 1360 : 1560;
  const start = performance.now();

  const finish = () => {
    while (cursor < targets.length) {
      const item = targets[cursor];
      restoreEl(item.map);
      restoreEl(item.chamber);
      restoreEl(item.tile);
      cursor += 1;
    }
    syncTallyFrame(finalCounts, 0);
    if (tagsGroup) tagsGroup.removeAttribute('style');
    if (sweepWrap) sweepWrap.hidden = true;
    delete document.body.dataset.sweeping;
  };

  const step = (now) => {
    const raw = Math.min(1, Math.max(0, (now - start) / duration));
    const eased = 1 - ((1 - raw) ** 3);
    const goal = raw >= 1 ? targets.length : Math.floor(eased * targets.length);
    while (cursor < goal) {
      const item = targets[cursor];
      restoreEl(item.map);
      restoreEl(item.chamber);
      restoreEl(item.tile);
      running[item.partyId][item.kind] += 1;
      cursor += 1;
    }
    syncTallyFrame(running, targets.length - cursor);
    if (sweepBar) sweepBar.style.transform = `scaleX(${eased.toFixed(4)})`;
    if (raw < 1) {
      activeSweep.rafId = requestAnimationFrame(step);
    } else {
      activeSweep = null;
      finish();
    }
  };

  activeSweep = { viewKey, rafId: requestAnimationFrame(step), finish };
}

async function stepReplay(index) {
  const history = replayHistory();
  const entry = history[index];
  if (!entry) return;
  try {
    const snapshot = await feed.loadSnapshot(entry.snapshotId);
    replayIndex = index;
    setShown(snapshot, null);
    refreshResults();
    $('el-live').textContent = T(`Showing snapshot ${index + 1} of ${history.length}.`, `正在显示第 ${index + 1} 个快照，共 ${history.length} 个。`);
  } catch {
    $('el-live').textContent = T('That snapshot could not be read. Replay did not move.', '无法读取该快照，回放没有移动。');
  }
}

function exitReplay() {
  replayIndex = null;
  setShown(feed.state.snapshot, feed.state.pointer);
  refreshResults();
}

/* ---------- Selection ---------- */

function renderCandidates(race, event) {
  const ordered = race.candidates.every((candidate) => candidate.ballotPosition !== null)
    ? [...race.candidates].sort((a, b) => a.ballotPosition - b.ballotPosition)
    : race.candidates;
  const formal = race.totals?.formal ?? null;
  const rows = ordered.map((candidate) => {
    const pct = formal && candidate.votes !== null ? (candidate.votes / formal) * 100 : null;
    const share = pct !== null ? `${pct.toFixed(1)}%` : DASH;
    const won = race.decision.candidateIds?.includes(candidate.candidateId);
    const barStyle = pct !== null ? ` style="--share:${Math.min(100, Math.max(0, pct)).toFixed(1)}%"` : '';
    const partyLabel = esc(candidate.party) || (candidate.independent ? T('Independent', '独立') : DASH);
    const badge = renderCandidatePartyBadge(event.family, candidate, 'sm');
    return `<tr${won ? ' class="is-winner"' : ''}${barStyle}><td>${esc(candidate.name) || DASH}${won ? ` <b>${esc(race.decision.status === 'certified' ? T('Elected', '当选') : T('Called', '已判定'))}</b>` : ''}</td><td><span class="el-cand-party">${badge}<span>${partyLabel}</span></span></td><td class="el-num">${candidate.votes === null ? DASH : candidate.votes.toLocaleString('en-AU')}</td><td class="el-num">${share}</td></tr>`;
  }).join('');
  return `<table class="el-cands">
      <thead><tr><th scope="col">${T('Candidate', '候选人')}</th><th scope="col">${T('Party', '党派')}</th><th scope="col" class="el-num">${T('Votes', '票数')}</th><th scope="col" class="el-num">%</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function renderTwoCandidate(race, event) {
  const two = race.twoCandidate;
  if (!two) return '';
  if (two.status === 'withheld') return `<p class="el-note">${T('The two-candidate count is withheld by the source for this seat.', '来源暂不公布此席位的两候选人计票。')}</p>`;
  if (two.status !== 'available') return '';
  const known = two.candidates.every((item) => item.votes !== null);
  const sum = known ? two.candidates.reduce((total, item) => total + item.votes, 0) : 0;
  const rows = two.candidates.map((item) => {
    const candidate = race.candidates.find((entry) => entry.candidateId === item.candidateId);
    const badge = candidate ? renderCandidatePartyBadge(event.family, candidate, 'sm') : '';
    return `<tr><td><span class="el-cand-party">${badge}<span>${esc(candidate?.name) || DASH}</span></span></td><td class="el-num">${item.votes === null ? DASH : esc(item.votes.toLocaleString('en-AU'))}</td><td class="el-num">${sum && item.votes !== null ? `${((item.votes / sum) * 100).toFixed(1)}%` : DASH}</td></tr>`;
  }).join('');
  return `<table class="el-cands el-cands-two">
      <caption>${T('Two-candidate count · indicative', '两候选人计票 · 仅供参考')}</caption>
      <thead><tr><th scope="col">${T('Candidate', '候选人')}</th><th scope="col" class="el-num">${T('Votes', '票数')}</th><th scope="col" class="el-num">%</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function decisionText(event, race) {
  const decision = race.decision;
  if (decision.status === 'call_rescinded') return T('A decision shown earlier has been withdrawn by the source.', '之前显示的判定已被来源撤销。');
  if (decision.status === 'certified' || decision.status === 'provider_called') {
    const when = shown?.isBaseline
      ? `${shown.snapshot.baselineYear} ${T('official return', '官方最终结果')}`
      : decision.decidedAt
        ? formatTime(decision.decidedAt)
        : decision.callTimeUnpublished
          ? T(`the source publishes no call time; first read by this page ${formatTime(decision.firstObservedAt)}`, `来源未公布判定时间；本页 ${formatTime(decision.firstObservedAt)} 首次读到`)
          : T(`first seen in the feed ${formatTime(decision.firstObservedAt)}; the feed gives no declaration date`, `${formatTime(decision.firstObservedAt)} 首次在数据中出现；数据未提供宣布日期`);
    return `${esc(decision.authority)} · ${when} · <a href="${esc(decision.evidenceUrl)}" target="_blank" rel="noopener noreferrer">${T('Evidence', '依据')} ↗</a>`;
  }
  return T('No decision yet.', '尚无判定。');
}

function renderRaceDrawer(event, office, seat, race) {
  const stale = raceFreshness(race, shown.pointer) === 'stale';
  const progress = progressText(race);
  const { provenance } = race;
  const baseline = shown?.isBaseline ? baselineFor(event.id) : null;
  const mark = seat.onBallot ? seatMark(seat, currentStates()[seat.seatId], partiesOf(event)) : null;
  const subBadge = mark?.party ? renderPartyBadge(event.family, mark.party.id, 'sm') : '';
  const baselineLater = Boolean(shown?.isBaseline && race.electionDate > `${shown.snapshot.baselineYear}-12-31`);
  const cycleLater = !shown?.isBaseline && race.electionDate !== event.pollDate;
  return `<div class="el-drawer-head">
      <div>
        <h3 id="el-drawer-title" tabindex="-1">${L(seat.label)}</h3>
        <p class="el-drawer-sub">${L(office.fullName)} · ${subBadge}<span>${seatStatus(seat)}</span></p>
      </div>
      <button type="button" class="el-drawer-close" data-close aria-label="${T('Close race details', '关闭比赛详情')}">×</button>
    </div>
    ${shown.snapshot.isSynthetic ? `<p class="el-drawer-flag">${T('Synthetic test data. Not a real result.', '合成测试数据，不是真实结果。')}</p>` : ''}
    ${baseline ? `<p class="el-drawer-baseline">${L(baseline.drawerNote)}</p>` : ''}
    ${stale ? `<p class="el-drawer-flag">${T(`Stale: last updated ${formatTime(provenance.sourceUpdatedAt)}. The source has not refreshed this contest since.`, `已过时：最后更新于 ${formatTime(provenance.sourceUpdatedAt)}，来源此后未刷新这场比赛。`)}</p>` : ''}
    ${seat.area && seat.feature ? `<p class="el-note">${T('This region elects five members together.', '这个大区一起选出五席。')}</p>` : ''}
    ${baselineLater ? `<p class="el-note">${T(`Supplementary election held on ${formatDay(race.electionDate)}.`, `${formatDay(race.electionDate)} 补选结果。`)}</p>` : ''}
    ${cycleLater ? `<p class="el-note">${T(`Held on ${formatDay(race.electionDate)}, after the main polling day.`, `于 ${formatDay(race.electionDate)} 举行，晚于主投票日。`)}</p>` : ''}
    ${renderCandidates(race, event)}
    ${renderTwoCandidate(race, event)}
    <dl class="el-kv">
      <dt>${T('Decided by', '判定方')}</dt><dd>${decisionText(event, race)}</dd>
      <dt>${T('Progress', '进度')}</dt><dd>${progress || (race.counting.status === 'recount' ? T('Recount: only contest totals are published', '重新计票：只发布比赛总数') : DASH)}</dd>
      <dt>${T('Swing', '摆动')}</dt><dd>${L(swingNote(event, office))}</dd>
      <dt>${T('Source time', '来源时间')}</dt><dd>${formatTime(provenance.sourceUpdatedAt)}</dd>
    </dl>
    <a class="el-link" href="${event.officialUrl}" target="_blank" rel="noopener noreferrer">${L(event.officialLabel)} ↗</a>`;
}

const electionYear = (event) => (event.pollDate || event.sortDate).slice(0, 4);

function renderDrawer(event, office, seat) {
  const race = currentRaces().get(seat.seatId);
  if (race) return renderRaceDrawer(event, office, seat, race);
  const onBallot = seat.onBallot;
  return `<div class="el-drawer-head">
      <div>
        <h3 id="el-drawer-title" tabindex="-1">${L(seat.label)}</h3>
        <p class="el-drawer-sub">${L(office.fullName)} · ${seatStatus(seat)}</p>
      </div>
      <button type="button" class="el-drawer-close" data-close aria-label="${T('Close race details', '关闭比赛详情')}">×</button>
    </div>
    ${seat.placeholder ? `<p class="el-note">${T('Placeholder electorate awaiting an official list.', '占位选区，等待官方名单。')}</p>` : ''}
    ${seat.area && seat.feature ? `<p class="el-note">${T('This region elects five members together.', '这个大区一起选出五席。')}</p>` : ''}
    ${seat.contest === 'special' ? `<p class="el-note">${T('Special contest in 2026.', '2026 年特别选举。')}</p>` : ''}
    ${!onBallot ? `<p class="el-note">${T(`This seat is not on the ${electionYear(event)} ballot.`, `此席位不在 ${electionYear(event)} 年改选之列。`)}</p>` : ''}
    <dl class="el-kv">
      ${onBallot ? `<dt>${T('Swing', '摆动')}</dt><dd>${L(swingNote(event, office))}</dd>` : ''}
      <dt>${T('Decided by', '判定方')}</dt><dd>${L(event.decision)}</dd>
    </dl>
    <a class="el-link" href="${event.officialUrl}" target="_blank" rel="noopener noreferrer">${L(event.officialLabel)} ↗</a>`;
}

function markSelected() {
  document.querySelectorAll('[data-row]').forEach((row) => row.classList.toggle('is-selected', row.dataset.row === state.raceId));
  document.querySelectorAll('.el-seat-link').forEach((link) => {
    if (link.dataset.seat === state.raceId) link.setAttribute('aria-current', 'true');
    else link.removeAttribute('aria-current');
  });
}

const holdsRace = (tile) => (tile.dataset.seats ? tile.dataset.seats.split(' ').includes(state.raceId) : tile.dataset.seat === state.raceId);

function syncMarks() {
  for (const roving of document.querySelectorAll('[data-roving]')) {
    const tiles = [...roving.querySelectorAll('[data-seat]')];
    const current = tiles.find(holdsRace) || tiles[0];
    for (const tile of tiles) {
      const selected = holdsRace(tile);
      tile.classList.toggle('is-selected', selected);
      tile.setAttribute('aria-pressed', String(selected));
      tile.tabIndex = tile === current ? 0 : -1;
    }
  }
  const zoom = $('el-zoom-seat');
  if (zoom) {
    zoom.textContent = zoomedSeat ? T('Reset zoom', '恢复缩放') : T('Zoom to seat', '缩放到席位');
    zoom.disabled = !zoomedSeat && !(state.raceId && activeMap && seatFeature(activeMap.binding, state.raceId));
  }
  showReadout(state.raceId);
  applyMapView();
  const svg = document.querySelector('.el-map-svg');
  if (svg && mapResize) {
    mapResize.disconnect();
    mapResize.observe(svg);
  }
}

function syncSelection() {
  markSelected();
  const event = eventById(state.event);
  const office = officeById(event, state.office);
  syncMarks();
  const drawer = $('el-drawer');
  const seat = seatCatalogue(event.id, office.id).find((item) => item.seatId === state.raceId);
  if (!seat) {
    drawer.hidden = true;
    drawer.innerHTML = '';
    document.body.classList.remove('el-sheet-open');
    return;
  }
  drawer.innerHTML = renderDrawer(event, office, seat);
  drawer.hidden = false;
  document.body.classList.add('el-sheet-open');
}

/* ---------- State changes ---------- */

function render() {
  const now = new Date();
  if (state.event) renderConsole(now);
  else renderHub(now);
}

function go(next, { push = true } = {}) {
  const url = `${window.location.pathname}${serializeState(next)}`;
  const moved = applyState(next);
  window.history[push ? 'pushState' : 'replaceState'](null, '', url);
  window.dispatchEvent(new Event('afflatus-locationchange'));
  if (moved) window.scrollTo({ top: 0 });
}

const HUB_TITLE = document.title;

function syncPageTitle() {
  const event = eventById(state.event);
  if (!event) {
    document.title = HUB_TITLE;
    return;
  }
  document.title = `${L(event.short)} · ${L(officeById(event, state.office).fullName)} · AFFLATUS`;
}

function focusViewTitle() {
  const title = $('el-title');
  title.setAttribute('tabindex', '-1');
  title.focus({ preventScroll: true });
}

function applyState(next) {
  const previous = state;
  state = next;
  if (next.event === previous.event && next.office === previous.office && previous.event) {
    if (next.geographyView !== previous.geographyView) {
      stopTimelineSweep(true);
      refreshExplore();
    }
    if (!document.querySelector(`[data-row="${state.raceId}"]`) && state.raceId) renderRaces();
    syncSelection();
    showAreaSummary();
    return false;
  }
  stopTimelineSweep(false);
  activeMap = null;
  zoomedSeat = null;
  table = { key: 'seat', direction: 'asc', expanded: false, query: '' };
  render();
  syncPageTitle();
  return true;
}

let returnFocus = null;

function selectSeat(seatId, trigger) {
  returnFocus = trigger || null;
  go(withRace(state, seatId), { push: !state.raceId });
  const beside = window.matchMedia('(min-width: 1024px)').matches;
  const phone = Boolean(PHONE_QUERY?.matches);
  const map = phone ? trigger?.closest?.('.el-map-svg') : null;
  $('el-drawer-title')?.focus({ preventScroll: beside || Boolean(map) });
  if (map) window.scrollTo({ top: window.scrollY + map.getBoundingClientRect().top - ($('afflatus-header')?.offsetHeight || 0) - 8 });
}

function searchSeat() {
  const input = $('el-search');
  const note = $('el-search-note');
  if (!input?.value.trim()) return;
  const seat = findSeat(seatCatalogue(state.event, state.office), input.value);
  note.textContent = seat ? '' : T('No single seat matches. Try the full name.', '没有唯一匹配的席位，请输入完整名称。');
  if (!seat) return;
  zoomedSeat = seat.seatId;
  input.value = '';
  table = { ...table, query: '' };
  renderRaces();
  selectSeat(seat.seatId, null);
}

function closeDrawer() {
  const seatId = returnFocus?.dataset.seat || state.raceId;
  const trigger = returnFocus?.isConnected ? returnFocus : null;
  go(withRace(state, null), { push: false });
  const target = trigger || document.querySelector(`.el-seat-link[data-seat="${seatId}"]`) || document.querySelector(`[data-roving] [data-seat="${seatId}"]`);
  target?.focus({ preventScroll: true });
}

function setStagePrimary(nextPrimary) {
  if (stagePrimary === nextPrimary) return;
  stagePrimary = nextPrimary;
  syncWorkbenchOrder();
  applyMapView();
}

document.addEventListener('click', (event) => {
  if (!SUPPORTS_POPOVER) {
    const btn = event.target.closest('#el-source-btn, [data-sources-close]');
    const sources = $('el-sources');
    if (btn && sources) {
      sources.classList.toggle('is-open', btn.id === 'el-source-btn' ? !sources.classList.contains('is-open') : false);
      return;
    }
    if (sources?.classList.contains('is-open') && !event.target.closest('#el-sources')) {
      sources.classList.remove('is-open');
    }
  }

  const target = event.target.closest('[data-nav], [data-office], [data-geo], [data-stage], #el-zoom-seat, [data-seat], [data-sort], [data-expand], [data-close], #el-explore-toggle, #el-feed-toggle, [data-replay]');
  if (!target) return;
  if (target.matches('[data-nav]')) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    go(parseState(new URL(target.href).search));
    focusViewTitle();
  } else if (target.matches('[data-office]')) {
    const { office } = target.dataset;
    go(withOffice(state, office));
    document.querySelector(`[data-office="${office}"]`)?.focus();
    $('el-live').textContent = L(officeById(eventById(state.event), office).fullName);
  } else if (target.matches('[data-geo]')) {
    setStagePrimary('explore');
    go(withGeography(state, { view: target.dataset.geo }), { push: false });
    syncStageButtons();
    $('el-stage-seg')?.querySelector(`[data-geo="${target.dataset.geo}"]`)?.focus();
  } else if (target.matches('[data-stage]')) {
    const desired = target.dataset.stage;
    setStagePrimary(desired);
    const focusSelector = desired === 'chamber'
      ? '#el-stage-seg [data-stage="chamber"]'
      : geographyFor(state.event, state.office)
        ? `#el-stage-seg [data-geo="${state.geographyView}"]`
        : '#el-stage-seg [data-stage="explore"]';
    document.querySelector(focusSelector)?.focus();
  } else if (target.matches('#el-zoom-seat')) {
    zoomedSeat = zoomedSeat ? null : state.raceId;
    syncMarks();
  } else if (target.matches('[data-seat]')) {
    selectSeat(target.dataset.seat, target);
  } else if (target.matches('[data-sort]')) {
    const same = table.key === target.dataset.sort;
    table = { ...table, key: target.dataset.sort, direction: same && table.direction === 'asc' ? 'desc' : 'asc' };
    renderRaces();
    document.querySelector(`[data-sort="${table.key}"]`)?.focus();
  } else if (target.matches('[data-expand]')) {
    table = { ...table, expanded: !table.expanded };
    renderRaces();
    document.querySelector('[data-expand]')?.focus();
  } else if (target.matches('[data-close]')) {
    closeDrawer();
  } else if (target.matches('#el-feed-toggle')) {
    if (feed.state.paused) feed.resume();
    else feed.pause();
  } else if (target.matches('[data-replay]')) {
    const step = target.dataset.replay;
    if (step === 'exit') exitReplay();
    else if (step === 'start') stepReplay(0);
    else stepReplay(replayIndex + (step === 'next' ? 1 : -1));
  } else if (target.matches('#el-explore-toggle')) {
    const body = $('el-explore-body');
    const open = body.classList.toggle('is-open');
    target.setAttribute('aria-expanded', String(open));
    target.textContent = open ? T('Hide', '收起') : T('Show', '展开');
    showMap();
    applyMapView();
  }
});

document.addEventListener('change', (event) => {
  if (event.target.id === 'el-replay-range') {
    stepReplay(Number(event.target.value));
  } else if (event.target.id === 'el-area') {
    zoomedSeat = null;
    go(withGeography(state, { area: event.target.value || null }), { push: false });
  } else if (event.target.id === 'el-search') {
    searchSeat();
  }
});

document.addEventListener('submit', (event) => {
  if (event.target.id !== 'el-search-form') return;
  event.preventDefault();
  searchSeat();
});

document.addEventListener('input', (event) => {
  if (event.target.id !== 'el-search') return;
  if (event.inputType === 'insertReplacementText') {
    searchSeat();
    return;
  }
  const note = $('el-search-note');
  if (note) note.textContent = '';
  table = { ...table, query: event.target.value };
  renderRaces();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && event.target.id === 'el-search') {
    event.preventDefault();
    searchSeat();
    return;
  }
  if (event.key === 'Escape') {
    if (!SUPPORTS_POPOVER && $('el-sources')?.classList.contains('is-open')) {
      $('el-sources').classList.remove('is-open');
      $('el-source-btn')?.focus();
      return;
    }
    if (state.raceId && !(SUPPORTS_POPOVER && $('el-sources')?.matches?.(':popover-open'))) {
      closeDrawer();
      return;
    }
  }
  const tile = event.target.closest?.('[data-roving] [data-seat]');
  if (!tile) return;
  if ((event.key === 'Enter' || event.key === ' ') && !tile.matches('button')) {
    event.preventDefault();
    selectSeat(tile.dataset.seat, tile);
    return;
  }
  const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
  if (!step) return;
  event.preventDefault();
  const tiles = [...tile.closest('[data-roving]').querySelectorAll('[data-seat]')];
  const next = tiles[(tiles.indexOf(tile) + step + tiles.length) % tiles.length];
  tile.tabIndex = -1;
  next.tabIndex = 0;
  next.focus();
});

for (const [type, preview] of [['mouseover', true], ['mouseout', false], ['focusin', true], ['focusout', false]]) {
  document.addEventListener(type, (event) => {
    if ((type === 'mouseover' || type === 'mouseout') && HOVER_QUERY && !HOVER_QUERY.matches) return;
    const mark = event.target.closest?.('.el-seat, .el-feature');
    if (mark) showReadout(preview ? mark.dataset.seat : state.raceId);
  });
}

PHONE_QUERY?.addEventListener?.('change', () => syncWorkbenchOrder());

window.addEventListener('popstate', () => {
  const hadRace = state.raceId;
  const trigger = returnFocus?.isConnected ? returnFocus : null;
  applyState(parseState(window.location.search));
  if (hadRace && !state.raceId) trigger?.focus({ preventScroll: true });
});

document.addEventListener('visibilitychange', () => feed?.visibilityChanged());

window.addEventListener('afflatus-lang', (event) => {
  stopTimelineSweep(false);
  lang = event.detail === 'zh' ? 'zh' : 'en';
  activeMap = null;
  render();
  syncPageTitle();
});

window.history.replaceState(null, '', `${window.location.pathname}${serializeState(state)}${window.location.hash}`);
render();
syncPageTitle();
