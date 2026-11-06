/* ============================================================
   ELECTIONS: calendar hub (Scheme B) and event console (Scheme A).
   DOM glue only: rules live in electionRules.js, the view state in
   electionState.js, seats in electionCatalogue.js, result meaning in
   electionResults.js. Every value below that would need a source is shown as an
   em dash plus a reason. With no cleared feed nothing fetches results, and no
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
  railPositions,
  statusVocabulary,
} from '../lib/electionRules.js';
import { seatCatalogue, sortSeats } from '../lib/electionCatalogue.js';
import { bindSeatCatalogue, chamberSvg, seatMark, tallySeats } from '../lib/chamberLayout.js';
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
import { ELECTION_FEED_BASE } from '../config/electionSources.js';
import { ageSeconds, contestLeader, coveredSeats, isLocalHost, partyTally, primaryLeader, raceFreshness, raceIndex, seatStates } from '../lib/electionResults.js';
import { createFeedController } from '../lib/electionFeed.js';
import { getLocale } from '../lib/localeStore.js';

const $ = (id) => document.getElementById(id);
const DASH = '—';
const INITIAL_ROWS = 12;
// With no feed on screen, every chart and tally gets an empty map: seats stay neutral.
const NO_STATES = Object.freeze({});
const NO_RACES = new Map();
const CHAIR_LABELS = Object.freeze({
  rostrum: { en: 'Rostrum', zh: '讲台' },
  speaker: { en: 'Speaker', zh: '议长' },
  president: { en: 'President', zh: '议长' },
});

let lang = window.AfflatusI18N ? window.AfflatusI18N.get() : getLocale('en');
const T = (en, zh) => (lang === 'zh' ? zh : en);
const L = (pair) => T(pair.en, pair.zh);

let state = parseState(window.location.search);
let table = { key: 'seat', direction: 'asc', expanded: false };
// The map on screen, and the seat the user asked to zoom to. Neither is part of the URL state.
let activeMap = null;
let zoomedSeat = null;
const mapRequests = new Map();
// The feed for the open event, what is on screen from it, and the replay position. All null without a feed.
let feed = null;
let feedEventId = null;
let shown = null;
let replayIndex = null;

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const currentStates = () => shown?.states || NO_STATES;
const currentRaces = () => shown?.races || NO_RACES;
const partiesOf = (event) => PARTIES[event.family];
const isReplay = () => replayIndex !== null;
// Ages in a replay are measured from when that snapshot was recorded, not from today.
const ageClock = () => (isReplay() ? Date.parse(shown.snapshot.publishedAt) : Date.now());

const NOT_LOADED = () => T('Not loaded: no verified source yet', '未加载：尚无经核验的来源');
const NOT_PUBLISHED = () => T('Not published by the source', '来源未发布');
const COUNTING_WORDS = Object.freeze({
  recount: { en: 'Recount', zh: '重新计票' },
  rcv_pending: { en: 'RCV pending', zh: '等待排序计票' },
  runoff: { en: 'Runoff', zh: '第二轮' },
});
const WITHDRAWN = Object.freeze({ en: 'Decision withdrawn', zh: '判定已撤销' });
// Contests the validator lets carry their own later date.
const LATER_CONTEST_WORDS = Object.freeze({
  runoff: { en: 'runoff', zh: '决选' },
  postponed: { en: 'postponed', zh: '延期' },
});

function raceStatusWords(seat, race, event) {
  const words = statusVocabulary(event);
  const mark = seatMark(seat, currentStates()[seat.seatId], partiesOf(event));
  // Party in words as well as colour, for anyone who cannot tell the colours apart.
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
// Coverage is measured in contests: a seat that is not on the ballot can never report.
const contestCount = (seats) => seats.filter((seat) => seat.onBallot).length;
const eventHref = (eventId) => serializeState(withEvent(eventId)) || window.location.pathname;
const hubHref = () => window.location.pathname;

// Keeps static-engine attributes in step, so i18n.apply() cannot revert a dynamic title.
function setText(element, en, zh) {
  element.setAttribute('data-en', en);
  element.setAttribute('data-zh', zh);
  element.textContent = T(en, zh);
}

function phaseLabel(event, now) {
  const phase = eventPhase(event, now);
  if (phase === 'past') return T('voted', '已投票');
  if (phase === 'undated') return T('date not set', '日期未定');
  if (nextEvent(now)?.id === event.id) {
    const days = daysUntil(event, now);
    return days === 0 ? T('today', '今天') : T(`in ${days} days`, `${days} 天后`);
  }
  return L(event.dateLabel);
}

function formatNow(now) {
  const options = { timeZone: 'Australia/Melbourne', day: 'numeric', month: 'short', year: 'numeric' };
  return new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : 'en-AU', options).format(now);
}

function renderStrip(left, right) {
  const leftEl = $('el-strip-context');
  leftEl.textContent = left;
  $('el-strip-meta').innerHTML = right.map((item) => `<span>${item}</span>`).join('');
}

/* ---------- Hub ---------- */

function renderHub(now) {
  syncFeed(null);
  const strip = document.querySelector('.el-strip');
  strip.dataset.mode = 'preview';
  setText(strip.querySelector('b'), 'Design preview — no live results', '设计预览 — 无实时结果');
  setText($('el-title-main'), 'ELECTIONS', '选举');
  setText($('el-title-sub'), '/ 2026–28', '/ 2026–28');
  setText($('el-sub'), 'A clear view of each count, one event at a time.', '一场一场，把每次计票看清楚。');
  $('el-hero-controls').innerHTML = '';
  renderStrip(T('Elections hub · 5 events', '选举枢纽 · 5 场'), [T('Coverage —', '覆盖 —'), T('Source age —', '来源时间 —'), 'AEDT · ET']);
  document.body.dataset.view = 'hub';

  const next = nextEvent(now);
  const others = ELECTION_EVENTS.filter((event) => event !== next);
  $('el-view').innerHTML = `${renderRail(now)}${next ? renderNextCard(next, now) : ''}
    <ul class="el-cards">${others.map((event) => renderCard(event, now)).join('')}</ul>
    <p class="el-foot">${T('Times shown in Australia/Melbourne and America/New_York. Seat numbers, dates and electorate names were checked against official sources in November 2026. No results are loaded.', '时间以澳大利亚墨尔本和美国纽约时区显示。席位数、日期和选区名称已于 2026 年 11 月对照官方来源核对。本页未加载任何结果。')}</p>`;
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
      <p class="el-eyebrow">${T('Next', '下一场')} · ${L(event.name)}</p>
      <h2 id="el-next-title">${L(event.headline)}</h2>
      <p class="el-next-facts">${L(event.pollsClose)} · ${officeFacts(event)} · ${L(event.extraFact)}</p>
      <dl class="el-kv">
        <dt>${T('Source', '来源')}</dt><dd>${L(event.feed)}</dd>
        <dt>${T('Mode on the night', '当晚模式')}</dt><dd>${T('Live only if the source passes verification and allows it. Otherwise this page shows no results: follow the official site. Never a fake LIVE.', '来源通过核验并获准才显示实时。否则本页不显示结果，请看官方网站。绝不冒充实时。')}</dd>
      </dl>
      <a class="el-btn" href="${eventHref(event.id)}" data-nav>${T(`Open the ${L(event.short)} console`, `打开${L(event.short)} 控制台`)} →</a>
    </div>
    <div class="el-countdown">
      ${days === null
    ? `<strong>${DASH}</strong><span>${L(event.dateLabel)}</span>`
    : `<strong>${days}</strong><span>${T('days to polling day', '天后投票')}</span>`}
    </div>
  </section>`;
}

function renderCard(event, now) {
  const phase = eventPhase(event, now);
  const pill = phase === 'past'
    ? T('Voted · no verified results loaded', '已投票 · 未加载经核验的结果')
    : phase === 'undated' ? T('Date not set', '日期未定') : T('Upcoming', '未开始');
  return `<li class="el-card">
    <a href="${eventHref(event.id)}" data-nav>
      <span class="el-eyebrow">${L(event.level)}</span>
      <h3>${L(event.region)}</h3>
      <span class="el-card-date">${L(event.dateLabel)}</span>
      <span class="el-card-facts">${officeFacts(event)} · ${L(event.extraFact)}</span>
      <span class="el-pill">${pill}</span>
    </a>
  </li>`;
}

/* ---------- Console ---------- */

function renderConsole(now) {
  const event = eventById(state.event);
  const office = officeById(event, state.office);
  const seats = seatCatalogue(event.id, office.id);
  const unit = office.unit ? L(office.unit) : T('seats', '席');

  setText($('el-title-main'), 'ELECTION', '选举');
  setText($('el-title-sub'), `/ ${event.short.en}`, `/ ${event.short.zh}`);
  setText(
    $('el-sub'),
    `${event.name.en} · ${office.fullName.en} · ${office.seats} ${office.unit ? office.unit.en : 'seats'} · ${office.majorityLabel.en}`,
    `${event.name.zh} · ${office.fullName.zh} · ${office.seats} ${office.unit ? office.unit.zh : '席'} · ${office.majorityLabel.zh}`,
  );
  $('el-hero-controls').innerHTML = `<div class="el-seg" role="group" aria-label="${T('Office', '议院')}">
    ${event.offices.map((item) => `<button type="button" data-office="${item.id}" aria-pressed="${item.id === office.id}">${L(item.name)}</button>`).join('')}
  </div>`;
  syncFeed(event);
  renderConsoleStrip(event, office, seats);
  document.body.dataset.view = 'console';

  $('el-view').innerHTML = `
    <nav class="el-events" aria-label="${T('Election', '选举')}">
      <a class="el-events-all" href="${hubHref()}" data-nav>← ${T('All elections', '全部选举')}</a>
      <ul>${ELECTION_EVENTS.map((item) => `<li><a href="${eventHref(item.id)}" data-nav ${item.id === event.id ? 'aria-current="page"' : ''}>${L(item.short)}<small>${phaseLabel(item, now)}</small></a></li>`).join('')}</ul>
    </nav>
    ${renderTally(event, office, seats, unit)}
    <div class="el-console">
      <div class="el-row el-row-top">
      <section class="el-panel el-chamber" aria-labelledby="el-chamber-title">
        <p class="el-eyebrow">${L(office.fullName)}</p>
        <h2 id="el-chamber-title">${T('Chamber', '议席')} · ${office.seats} ${unit}</h2>
        ${renderChamber(event, office, seats)}
      </section>
      <section class="el-explore" aria-labelledby="el-explore-title">
        <div class="el-panel">
          <div class="el-explore-head">
            <div>
              <p class="el-eyebrow">${T('Explore seats', '浏览席位')}</p>
              <h2 id="el-explore-title">${exploreTitle()}</h2>
            </div>
            <button type="button" class="el-explore-toggle" id="el-explore-toggle" aria-expanded="false" aria-controls="el-explore-body">${T('Show', '展开')}</button>
          </div>
          <div class="el-explore-body" id="el-explore-body">${renderExplore(event, office, seats)}</div>
        </div>
        <aside class="el-drawer" id="el-drawer" aria-label="${T('Race details', '比赛详情')}" hidden></aside>
      </section>
      </div>
      <div class="el-row el-row-lower">
      <section class="el-panel el-races" aria-labelledby="el-races-title">
        <p class="el-eyebrow" id="el-races-count"></p>
        <h2 id="el-races-title">${T('Races', '比赛')}</h2>
        <p class="el-note" id="el-races-note"></p>
        <div id="el-races-table"></div>
      </section>
      ${renderSources(event, seats)}
      </div>
    </div>
    ${renderReplay()}
    <p class="el-foot" id="el-foot">${footText()}</p>
    <p class="el-sr" id="el-live" role="status"></p>`;

  renderRaces();
  syncSelection();
  showMap();
}

function renderTally(event, office, seats, unit) {
  const majorityAt = (office.majority / office.seats) * 100;
  const parties = partiesOf(event);
  const states = currentStates();
  const counts = shown ? partyTally(seats, states, parties) : null;
  const keys = parties.map((party) => {
    const count = counts?.[party.id];
    return `<li><i class="el-party-key" style="background:${party.color}" aria-hidden="true">${L(party.tag)}</i>${L(party)}<b>${count ? count.decided : DASH}</b>${count?.leading ? `<small>+${count.leading} ${T('leading', '领先')}</small>` : ''}</li>`;
  }).join('');
  const tally = tallySeats(seats, states, parties);
  const segment = (party, count, kind) => (count ? `<i class="el-tally-seg is-${kind}" style="width:${(count / office.seats) * 100}%;--seat:${party.color}"></i>` : '');
  // One bar per party, each read against the line on its own. Stacked, parties together would cross a majority nobody holds.
  const marker = (withLabel) => (office.heldSeatsUnknown ? '' : `<span class="el-tally-mark" style="left:${majorityAt}%">${withLabel ? `<span>${L(office.majorityLabel)}</span>` : ''}</span>`);
  const active = counts ? parties.filter((party) => counts[party.id].decided || counts[party.id].leading) : [];
  const bars = active.length
    ? `<div class="el-tally-rows">${active.map((party, index) => `<div class="el-tally-row"><span class="el-tally-name">${L(party)}</span><div class="el-tally-bar">${segment(party, counts[party.id].decided, 'decided')}${segment(party, counts[party.id].leading, 'leading')}${marker(index === 0)}</div></div>`).join('')}</div>`
    : `<div class="el-tally-bar">${marker(true)}</div>`;
  // A declared region has no result per seat, so it has no colour. It is still not "no decision".
  const declaredRegion = shown ? seats.filter((seat) => {
    const race = currentRaces().get(seat.seatId);
    return seat.onBallot && race?.seatIds.length > 1 && ['certified', 'provider_called'].includes(race.decision.status);
  }).length : 0;
  // A decision or lead for someone with no listed party has no colour, but it is not "no decision".
  const unlisted = shown ? seats.filter((seat) => seat.onBallot && states[seat.seatId]?.status !== 'unavailable' && states[seat.seatId] && seatMark(seat, states[seat.seatId], parties).status === 'neutral').length : 0;
  const open = shown ? tally.neutral + tally.unavailable - unlisted - declaredRegion : office.seats - tally.off;
  return `<section class="el-tally" id="el-tally" aria-label="${T('Seat tally', '席位统计')}">
    ${bars}
    <ul class="el-tally-keys">${keys}<li><i class="el-neutral"></i>${shown ? T('No decision or lead', '无判定或领先') : L(NO_RESULT)}<b>${open}</b></li>${declaredRegion ? `<li><i class="el-neutral"></i>${T('Declared, not allocated to seats', '已宣布，未按席位分配')}<b>${declaredRegion}</b></li>` : ''}${unlisted ? `<li><i class="el-neutral"></i>${T('Decision or lead, no listed party', '有判定或领先，无所列党派')}<b>${unlisted}</b></li>` : ''}${tally.off ? `<li><i class="el-off"></i>${L(NOT_ON_BALLOT)}<b>${tally.off}</b></li>` : ''}</ul>
    ${office.majorityNote ? `<p class="el-note">${L(office.majorityNote)}</p>` : ''}
    ${shown ? `<p class="el-note">${T('Large numbers are seats with a named decision. Leads are counted apart. This page never declares who controls a chamber.', '大号数字是有具名判定的席位，领先单独计数。本页不宣布议院控制权。')}</p>` : ''}
    <p class="el-note el-sr">${office.seats} ${unit}</p>
  </section>`;
}

const chamberHint = () => T('Select a seat for details. The race list has every seat.', '选择席位查看详情。比赛列表包含全部席位。');

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
    return `<div class="el-chamber-slot"><p>${T('The Electoral College view is not built yet. No seat chart applies here.', '选举人团视图尚未建成，这里不适用席位图。')}</p></div>`;
  }
  const svg = chamberMarkup(event, office, seats);
  const key = tallySeats(seats, NO_STATES).off
    ? `<ul class="el-chamber-key"><li><i class="el-neutral"></i>${L(NO_RESULT)}</li><li><i class="el-off"></i>${L(NOT_ON_BALLOT)}</li></ul>`
    : '';
  return `<div class="el-chamber-chart">
    ${svg}
    <p class="el-chamber-readout" id="el-chamber-readout">${chamberHint()}</p>
    ${key}
    <p class="el-cap">${T('Chamber-inspired seat view · Each mark represents an electoral seat, not an assigned desk.', '参考议院形态的席位图；每个标记代表一个选举席位，并非议员实际座位。')}</p>
  </div>`;
}

// Hover and focus preview a seat. Otherwise the line shows the selected seat, or the hint.
function showReadout(seatId) {
  const seat = seatId && seatCatalogue(state.event, state.office).find((item) => item.seatId === seatId);
  for (const host of [$('el-chamber-readout'), $('el-map-readout')]) {
    if (host) host.textContent = seat ? `${L(seat.label)} · ${seatStatus(seat)} · ${T('Source time', '来源时间')} ${formatTime(currentRaces().get(seat.seatId)?.provenance.sourceUpdatedAt)}` : chamberHint();
  }
}

const exploreTitle = () => (state.geographyView === 'map' ? T('Map', '地图') : T('Seat blocks', '席位块'));

function renderExplore(event, office, seats) {
  if (!seats.length) return renderTiles(seats);
  const geography = geographyFor(event.id, office.id);
  const gap = geographyGap(event.id, office.id);
  const switcher = geography ? `<div class="el-seg el-seg-small" role="group" aria-label="${T('Seat view', '席位视图')}">
      <button type="button" data-geo="map" aria-pressed="${state.geographyView === 'map'}">${T('Map', '地图')}</button>
      <button type="button" data-geo="schematic" aria-pressed="${state.geographyView === 'schematic'}">${T('Seat blocks', '席位块')}</button>
    </div>` : '';
  const search = `<form class="el-search" id="el-search-form" role="search">
      <label for="el-search">${T('Find a seat', '查找席位')}</label>
      <input id="el-search" type="search" list="el-search-list" autocomplete="off" enterkeyhint="search">
      <datalist id="el-search-list">${seats.map((seat) => `<option value="${L(seat.label)}"></option>`).join('')}</datalist>
      <p class="el-note" id="el-search-note" role="status"></p>
    </form>`;
  const view = state.geographyView === 'map'
    ? `<div class="el-map" id="el-map"><p class="el-note">${T('Loading the map…', '正在加载地图…')}</p></div>`
    : `${gap ? `<p class="el-geo-gap">${L(gap)}</p>` : ''}${renderTiles(seats)}`;
  return `<div class="el-explore-tools">${search}${switcher}</div>${view}`;
}

function refreshExplore() {
  activeMap = null;
  setExploreTitle();
  $('el-explore-body').innerHTML = renderExplore(eventById(state.event), officeById(eventById(state.event), state.office), seatCatalogue(state.event, state.office));
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
  if (!host || activeMap || getComputedStyle($('el-explore-body')).display === 'none') return;
  const key = `${state.event}/${state.office}/${state.geographyView}`;
  const still = () => $('el-map') === host && key === `${state.event}/${state.office}/${state.geographyView}`;
  loadMap(geographyFor(state.event, state.office).map).then((map) => {
    if (still()) renderMap(host, map);
  }).catch(() => {
    if (!still()) return;
    host.innerHTML = `<p class="el-geo-gap">${T('The map could not load. Every seat is still in the blocks below, the chamber and the race list.', '地图未能加载。全部席位仍在下面的席位块、席位图和比赛表中。')}</p>${renderTiles(seatCatalogue(state.event, state.office))}`;
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
    </div>
    ${mapMarkup(event, office, geography, map, binding)}
    <p class="el-chamber-readout" id="el-map-readout">${chamberHint()}</p>
    <p class="el-map-area" id="el-map-area" role="status"></p>
    ${hasOff ? `<ul class="el-chamber-key"><li><i class="el-neutral"></i>${L(NO_RESULT)}</li><li><i class="el-off"></i>${L(NOT_ON_BALLOT)}</li></ul>` : ''}
    ${renderMissing(binding, seats)}
    <p class="el-cap">${T('Map area is not seat weight. Use the chamber or the race list to compare seats; small districts are easiest to reach by search.', '地图面积不代表席位权重。比较席位请看席位图或比赛表；小选区用搜索最容易找到。')}${geography.insets ? ` ${T('Alaska and Hawaii are labelled insets at their own scale, not true positions.', '阿拉斯加和夏威夷是单独比例的插图，并非实际位置。')}` : ''}</p>
    <p class="el-cap">${L(geography.source)}</p>`;
  syncMarks();
  showAreaSummary();
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
  // A locator ring keeps a selected district visible when it is too small to see on its own.
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

// Big blocks carry the party letter as well as its colour. The 435 compact blocks are too small for one.
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
  return `<div class="el-tile-map${compact ? ' is-compact' : ''}${groups.size > 1 ? ' is-grouped' : ''}" data-roving>${blocks}</div>
    <p class="el-cap">${T('Schematic · one block per seat · not geography.', '示意图 · 一席一格 · 不是地理边界。')}</p>`;
}

function renderRaces() {
  const event = eventById(state.event);
  const seats = seatCatalogue(event.id, state.office);
  const host = $('el-races-table');
  const count = $('el-races-count');
  if (!seats.length) {
    count.textContent = T('No race list yet', '暂无比赛列表');
    host.innerHTML = `<p class="el-empty">${T('No contest list is available for this office yet.', '此议院暂无比赛列表。')}</p>`;
    return;
  }
  const sorted = sortSeats(seats, table.key, table.direction, seatStatus);
  // A race selected outside the short list joins it, so a deep link never unrolls 435 rows.
  const selected = sorted.find((seat) => seat.seatId === state.raceId);
  const short = sorted.slice(0, INITIAL_ROWS);
  const rows = table.expanded ? sorted : selected && !short.includes(selected) ? [...short, selected] : short;
  count.textContent = `${rows.length} ${T('of', '/')} ${seats.length} · ${T('stable order', '顺序稳定')}`;

  const us = event.family === 'us';
  // A region column only where the catalogue has regions; a column that can only ever show a dash says nothing.
  const grouped = seats.some((seat) => seat.group);
  const swing = `<td class="el-opt el-num" title="${esc(L(swingNote(event, officeById(event, state.office))))}">${DASH}</td>`;
  const heading = (key, label, optional = false) => {
    const active = table.key === key;
    const sort = active ? (table.direction === 'asc' ? 'ascending' : 'descending') : 'none';
    return `<th scope="col" ${optional ? 'class="el-opt" ' : ''}aria-sort="${sort}"><button type="button" data-sort="${key}">${label}<span aria-hidden="true">${active ? (table.direction === 'asc' ? ' ↑' : ' ↓') : ''}</span></button></th>`;
  };
  const plain = (label, optional = true) => `<th scope="col" class="${optional ? 'el-opt' : ''} el-num">${label}</th>`;
  const head = us
    ? [heading('seat', T('Seat', '席位')), heading('group', T('State', '州'), true), plain(T('Leader', '领先者')), plain(T('Margin', '差距')), plain(T('% reporting', '已报告'), false), heading('status', T('Status', '状态')), plain(T('Source age', '来源时间'))]
    : [heading('seat', T('Electorate', '选区')), ...(grouped ? [heading('group', T('Region', '大区'), true)] : []), plain(shown ? T('Places', '投票点') : T('% counted', '已计'), false), plain(T('Primary leader', '第一优先票领先')), plain(T('TCP', '两候选人')), plain(T('Swing', '摆动')), heading('status', T('Status', '状态')), plain(T('Source age', '来源时间'))];
  const races = currentRaces();
  const dash = (optional = true, race = null) => `<td class="${optional ? 'el-opt' : ''} el-num" title="${race ? NOT_PUBLISHED() : NOT_LOADED()}">${DASH}</td>`;
  const value = (text, optional, race) => (text === null ? dash(optional, race) : `<td class="${optional ? 'el-opt' : ''} el-num">${text}</td>`);

  const body = rows.map((seat) => {
    const race = races.get(seat.seatId);
    const seatCell = `<th scope="row"><button type="button" class="el-seat-link" data-seat="${seat.seatId}">${L(seat.label)}</button></th>`;
    const status = `<td><span class="el-status${seat.onBallot ? '' : ' is-off'}" data-status="${esc(currentStates()[seat.seatId]?.status || 'neutral')}">${seatStatus(seat)}</span></td>`;
    const age = race ? sourceAgeCell(race) : dash();
    const cells = us
      ? [seatCell, `<td class="el-opt">${seat.group}</td>`, value(race ? leaderName(race) : null, true, race), value(race ? marginText(race) : null, true, race), value(race ? progressText(race) : null, false, race), status, age]
      : [seatCell, ...(grouped ? [`<td class="el-opt">${seat.group}</td>`] : []), value(race ? progressText(race, { short: true }) : null, false, race), value(race ? leaderName(race, primaryLeader) : null, true, race), value(race ? tcpText(race) : null, true, race), swing, status, age];
    return `<tr data-row="${seat.seatId}">${cells.join('')}</tr>`;
  }).join('');

  const canExpand = seats.length > INITIAL_ROWS;
  $('el-races-note').textContent = shown
    ? T('— means the source has not published this value. It is not a zero.', '「—」表示来源尚未发布此数值，不等于零。')
    : T('— means no verified data is loaded. It is not a zero.', '「—」表示未加载经核验的数据，不等于零。');
  host.innerHTML = `<div class="el-table-scroll"><table class="el-table">
      <caption class="el-sr">${L(event.name)} · ${L(officeById(event, state.office).fullName)}</caption>
      <thead><tr>${head.join('')}</tr></thead><tbody>${body}</tbody>
    </table></div>
    ${canExpand ? `<button type="button" class="el-btn el-btn-o" data-expand>${table.expanded ? T('Show fewer', '收起') : T(`Show all ${seats.length}`, `显示全部 ${seats.length} 项`)}</button>` : ''}`;
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
  // The Australian column is headed "Places returned", so its cells need only the numbers.
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
  return `${esc(leader.name)} ${((votes / sum) * 100).toFixed(1)}%`;
}

function formatAge(seconds) {
  if (seconds === null) return DASH;
  if (seconds < 60) return T('under 1 min', '不到 1 分钟');
  if (seconds < 3600) return T(`${Math.floor(seconds / 60)} min`, `${Math.floor(seconds / 60)} 分钟`);
  if (seconds < 172800) return T(`${Math.floor(seconds / 3600)} h`, `${Math.floor(seconds / 3600)} 小时`);
  return T(`${Math.floor(seconds / 86400)} days`, `${Math.floor(seconds / 86400)} 天`);
}

// A calendar date, as written: no time zone can move it.
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

// Each race carries its own age, so a fresh national check cannot hide one stale contest.
function sourceAgeCell(race) {
  const age = formatAge(ageSeconds(race.provenance.sourceUpdatedAt, ageClock()));
  const stale = raceFreshness(race, shown.pointer) === 'stale';
  return `<td class="el-opt el-num${stale ? ' is-stale' : ''}" title="${esc(formatTime(race.provenance.sourceUpdatedAt))}">${age}${stale ? ` · ${T('stale', '已过时')}` : ''}</td>`;
}

const swingNote = (event, office) => geographyFor(event.id, office.id)?.swing || { en: 'Not computed: no verified baseline is loaded.', zh: '未计算：尚未加载经核验的基准。' };

function renderSources(event, seats) {
  const vocabulary = statusVocabulary(event);
  const office = officeById(event, state.office);
  const geography = geographyFor(event.id, office.id);
  const legend = [
    ['neutral', vocabulary.notStarted], ['neutral', vocabulary.counting], ['leading', vocabulary.leading],
    ['called', vocabulary.called], ['final', vocabulary.final], ['unavailable', vocabulary.unavailable],
  ].map(([kind, label]) => `<li><i class="el-sw el-sw-${kind}"></i>${L(label)}</li>`).join('');
  // In a replay, the feed's current health and check times would describe another moment, so they are left out.
  const feedSource = feed?.state.pointer?.sources?.[0];
  const source = isReplay() ? null : feedSource;
  return `<section class="el-panel el-sources" id="el-sources" aria-labelledby="el-sources-title">
    <p class="el-eyebrow">${T('Sources & status', '来源与状态')}</p>
    <h2 id="el-sources-title" class="el-sr">${T('Sources & status', '来源与状态')}</h2>
    <dl class="el-kv">
      <dt>${T('Mode', '模式')}</dt><dd>${L(modeLabel())}</dd>
      <dt>${T('Coverage', '覆盖')}</dt><dd>${seats.length ? `${coveredSeats(seats, currentRaces())} ${T('of', '/')} ${contestCount(seats)}` : DASH}</dd>
      <dt>${T('Feed', '数据源')}</dt><dd>${feedSource ? esc(feedSource.name) : L(event.feed)}</dd>
      ${source ? `<dt>${T('Feed status', '数据源状态')}</dt><dd>${feedStatusText(source)}</dd>` : ''}
      <dt>${T('Geography', '地理')}</dt><dd>${geography ? L(geography.short) : T('Schematic only · no verified boundaries', '仅示意 · 无经核验的边界')}</dd>
      <dt>${T('Swing', '摆动')}</dt><dd>${L(swingNote(event, office))}</dd>
      <dt>${T('Polls', '投票')}</dt><dd>${L(event.dateLabel)} · ${L(event.pollsClose)}</dd>
      <dt>${T('Voting', '投票制度')}</dt><dd>${L(event.votingSystem)}</dd>
      ${isReplay() ? `<dt>${T('Recorded', '记录时间')}</dt><dd>${formatTime(shown.snapshot.publishedAt)}</dd>` : `<dt>${T('Last check', '上次检查')}</dt><dd>${source ? formatTime(source.lastCheckedAt) : DASH}</dd>`}
      ${source ? `<dt>${T('Newest source time', '最新来源时间')}</dt><dd>${formatTime(source.sourceUpdatedAt)}</dd>` : ''}
    </dl>
    ${renderFeedControls()}
    ${renderChanges()}
    <p class="el-note">${L(event.note)}</p>
    <details class="el-legend">
      <summary>${T('Status words for this election', '本场选举的状态词')}</summary>
      <ul>${legend}</ul>
      <p class="el-note">${shown ? T('Solid party colour is reserved for evidence-backed results.', '实心党色只用于有证据的结果。') : T('Solid party colour is reserved for evidence-backed results. None are loaded.', '实心党色只用于有证据的结果。目前没有加载任何结果。')}</p>
    </details>
    <a class="el-link" href="${event.officialUrl}" target="_blank" rel="noopener noreferrer">${L(event.officialLabel)} ↗</a>
  </section>`;
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

const feedBase = () => (isLocalHost(window.location.hostname) && window.__ELECTION_FEED_BASE__) || ELECTION_FEED_BASE;

function modeLabel() {
  if (!shown) return { en: 'Preview · no live results', zh: '预览 · 无实时结果' };
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
  if (shown) return T('Unofficial counts from the named source. Check the official site for declared results.', '来自具名来源的非正式计票。正式结果以官方网站为准。');
  return T('Seat numbers, dates and electorate names were checked against official sources in November 2026. No results are loaded.', '席位数、日期和选区名称已于 2026 年 11 月对照官方来源核对。本页未加载任何结果。');
}

function renderFeedControls() {
  if (!feed?.state.pointer) return '';
  const { paused, status, lastAttemptAt } = feed.state;
  const note = status === 'error'
    ? T(`Could not refresh at ${formatTime(lastAttemptAt)}. This is the last good data.`, `${formatTime(lastAttemptAt)} 刷新失败，这是上次的有效数据。`)
    : paused ? T(`Paused. Checked ${formatTime(lastAttemptAt)}.`, `已暂停，上次检查 ${formatTime(lastAttemptAt)}。`) : '';
  return `<div class="el-feed-controls">
      <button type="button" class="el-btn el-btn-o" id="el-feed-toggle" ${isReplay() ? 'disabled' : ''}>${paused ? T('Resume updates', '恢复更新') : T('Pause updates', '暂停更新')}</button>
      ${note ? `<p class="el-note" id="el-feed-note">${note}</p>` : ''}
    </div>`;
}

function renderChanges() {
  const changes = shown?.snapshot.changes || [];
  if (!shown) return '';
  const raceName = (raceId) => shown.snapshot.races.find((race) => race.raceId === raceId)?.contestName || raceId;
  const delta = (change) => (change.delta ? ` ${change.delta > 0 ? '+' : ''}${esc(change.delta.toLocaleString('en-AU'))}` : '');
  return `<div class="el-changes">
      <p class="el-eyebrow">${T('Changes in this snapshot', '本快照的变化')}</p>
      ${changes.length ? `<ul>${changes.slice(0, 6).map((change) => `<li><b>${L(CHANGE_WORDS[change.type])}</b>${delta(change)} · ${esc(raceName(change.raceId))}</li>`).join('')}</ul>${changes.length > 6 ? `<p class="el-note">${T(`And ${changes.length - 6} more.`, `另有 ${changes.length - 6} 项。`)}</p>` : ''}` : `<p class="el-note">${T('None recorded.', '没有记录。')}</p>`}
    </div>`;
}

const replayHistory = () => feed?.state.pointer?.history || [];

function renderReplay() {
  const history = replayHistory();
  if (history.length < 2) {
    const reason = history.length === 1
      ? T('Disabled · only one recorded snapshot, so there is nothing to step through', '已禁用 · 只有一个已记录的快照，无法逐步查看')
      : T('Disabled · no timestamped snapshots yet', '已禁用 · 尚无带时间戳的快照');
    return `<section class="el-replay" id="el-replay" aria-labelledby="el-replay-title">
      <h2 id="el-replay-title"><button type="button" disabled>${T('Replay election night', '回放开票夜')}</button></h2>
      <span class="el-note">${reason}</span>
    </section>`;
  }
  if (!isReplay()) {
    return `<section class="el-replay" id="el-replay" aria-labelledby="el-replay-title">
      <h2 id="el-replay-title"><button type="button" data-replay="start">${T('Replay election night', '回放开票夜')}</button></h2>
      <span class="el-note">${T(`${history.length} recorded snapshots. Nothing between them is interpolated.`, `${history.length} 个已记录的快照，之间不做任何插值。`)}</span>
    </section>`;
  }
  const entry = history[replayIndex];
  return `<section class="el-replay is-active" id="el-replay" aria-labelledby="el-replay-title">
      <h2 id="el-replay-title">${T('Replay', '回放')}</h2>
      <div class="el-replay-tools">
        <button type="button" class="el-btn el-btn-o" data-replay="prev" ${replayIndex === 0 ? 'disabled' : ''}>${T('Earlier', '上一个')}</button>
        <input type="range" id="el-replay-range" min="0" max="${history.length - 1}" value="${replayIndex}" aria-label="${T('Recorded snapshot', '已记录的快照')}">
        <button type="button" class="el-btn el-btn-o" data-replay="next" ${replayIndex === history.length - 1 ? 'disabled' : ''}>${T('Later', '下一个')}</button>
        <button type="button" class="el-btn" data-replay="exit">${T('Back to latest', '回到最新')}</button>
      </div>
      <p class="el-note" id="el-replay-position">${T(`Snapshot ${replayIndex + 1} of ${history.length} · recorded ${formatTime(entry.publishedAt)}`, `第 ${replayIndex + 1} 个，共 ${history.length} 个 · 记录于 ${formatTime(entry.publishedAt)}`)}</p>
    </section>`;
}

function renderConsoleStrip(event, office, seats) {
  const strip = document.querySelector('.el-strip');
  const flag = strip.querySelector('b');
  strip.dataset.mode = isReplay() ? 'replay' : shown ? (shown.snapshot.isSynthetic ? 'synthetic' : 'live') : 'preview';
  if (!shown) setText(flag, 'Design preview — no live results', '设计预览 — 无实时结果');
  else if (isReplay()) setText(flag, 'Replay of recorded snapshots — not live', '回放已记录的快照 — 非实时');
  else if (shown.snapshot.isSynthetic) setText(flag, 'Synthetic test data — not a real result', '合成测试数据 — 不是真实结果');
  else setText(flag, 'Unofficial results', '非正式结果');
  const races = shown ? shown.snapshot.races.filter((race) => race.office === office.id) : [];
  const stale = races.filter((race) => raceFreshness(race, shown.pointer) === 'stale').length;
  const source = shown?.pointer?.sources?.[0];
  renderStrip(`${L(event.short)} · ${L(office.fullName)}`, [
    seats.length ? `${T('Coverage', '覆盖')} ${coveredSeats(seats, currentRaces())}/${contestCount(seats)}` : T('Coverage —', '覆盖 —'),
    ...(shown ? [] : [T('Source age —', '来源时间 —')]),
    ...(source && !isReplay() ? [`${T('Checked', '检查')} ${formatAge(ageSeconds(source.lastCheckedAt, Date.now()))}`] : []),
    ...(stale ? [`<em>${T(`${stale} stale`, `${stale} 场已过时`)}</em>`] : []),
    event.timeLabel,
  ]);
}

function setShown(snapshot, pointer) {
  shown = snapshot ? { snapshot, pointer, states: seatStates(snapshot, pointer), races: raceIndex(snapshot) } : null;
}

function fetchFeedJson(url) {
  return fetch(url, { cache: 'no-cache' }).then((response) => {
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  });
}

// One controller per event. Nothing is created without a cleared base URL, which production does not have.
function syncFeed(event) {
  if (feedEventId === event?.id) return;
  feed?.stop();
  feed = null;
  shown = null;
  replayIndex = null;
  feedEventId = event?.id ?? null;
  const base = feedBase();
  if (!event || !base) return;
  feed = createFeedController({
    base,
    eventId: event.id,
    hostname: window.location.hostname,
    fetchJson: fetchFeedJson,
    isHidden: () => document.hidden,
    onChange: feedChanged,
  });
  feed.start();
}

function feedChanged({ snapshot, pointer }) {
  if (!state.event) return;
  // New data never moves a replay: it only extends the history behind it.
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

// Marks stay the same nodes, so focus on them is untouched. Whatever is rebuilt gets focus back by name.
function keepFocus(update) {
  const active = document.activeElement;
  const host = active?.closest?.('#el-races-table, #el-sources, #el-drawer, #el-replay, #el-tally');
  const attribute = active && ['data-seat', 'data-sort', 'data-replay', 'data-close', 'data-expand'].find((name) => active.hasAttribute?.(name));
  const name = !host || !active ? null
    : active.id ? `#${active.id}`
      : attribute ? `#${host.id} [${attribute}="${active.getAttribute(attribute)}"]` : null;
  update();
  if (name && !active.isConnected) document.querySelector(name)?.focus({ preventScroll: true });
}

/** Applies what is in `shown` without touching the selection, the scroll position or the URL. */
function refreshResults() {
  const event = eventById(state.event);
  const office = officeById(event, state.office);
  const seats = seatCatalogue(event.id, office.id);
  const unit = office.unit ? L(office.unit) : T('seats', '席');
  keepFocus(() => {
    renderConsoleStrip(event, office, seats);
    $('el-tally').outerHTML = renderTally(event, office, seats, unit);
    if (office.geometry) repaintMarks(document.querySelector('.el-chamber-svg'), chamberMarkup(event, office, seats));
    if (activeMap) repaintMarks(document.querySelector('.el-map-svg'), mapMarkup(event, office, activeMap.geography, activeMap.map, activeMap.binding));
    for (const tile of document.querySelectorAll('.el-tile')) {
      const seat = seats.find((item) => item.seatId === tile.dataset.seat);
      if (!seat) continue;
      const { className, style, tag } = tileLook(seat, Boolean(tile.closest('.is-compact')));
      tile.className = className;
      tile.setAttribute('style', style);
      tile.innerHTML = tag;
      tile.setAttribute('aria-label', `${L(seat.label)} · ${seatStatus(seat)}`);
    }
    renderRaces();
    const legendOpen = document.querySelector('.el-legend')?.open;
    $('el-sources').outerHTML = renderSources(event, seats);
    if (legendOpen) document.querySelector('.el-legend').open = true;
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

function renderCandidates(race) {
  // Upper-house groups have no ballot position, so a mixed list keeps the source's own order.
  const ordered = race.candidates.every((candidate) => candidate.ballotPosition !== null)
    ? [...race.candidates].sort((a, b) => a.ballotPosition - b.ballotPosition)
    : race.candidates;
  const formal = race.totals?.formal ?? null;
  const rows = ordered.map((candidate) => {
    const share = formal && candidate.votes !== null ? `${((candidate.votes / formal) * 100).toFixed(1)}%` : DASH;
    const won = race.decision.candidateIds?.includes(candidate.candidateId);
    return `<tr${won ? ' class="is-winner"' : ''}><td>${esc(candidate.name) || DASH}${won ? ` <b>${esc(race.decision.status === 'certified' ? T('Elected', '当选') : T('Called', '已判定'))}</b>` : ''}</td><td>${esc(candidate.party) || (candidate.independent ? T('Independent', '独立') : DASH)}</td><td class="el-num">${candidate.votes === null ? DASH : candidate.votes.toLocaleString('en-AU')}</td><td class="el-num">${share}</td></tr>`;
  }).join('');
  return `<table class="el-cands">
      <thead><tr><th scope="col">${T('Candidate', '候选人')}</th><th scope="col">${T('Party', '党派')}</th><th scope="col" class="el-num">${T('Votes', '票数')}</th><th scope="col" class="el-num">%</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="el-note">${T('% of formal votes in this count. Listed in ballot order, which does not change as votes arrive.', '百分比以本次计票的有效票为分母。按选票顺序排列，不随票数变化。')}</p>`;
}

function renderTwoCandidate(race) {
  const two = race.twoCandidate;
  if (!two) return '';
  if (two.status === 'withheld') return `<p class="el-note">${T('The two-candidate count is withheld by the source for this seat. First preferences are unaffected.', '来源暂不公布此席位的两候选人计票。第一优先票不受影响。')}</p>`;
  if (two.status !== 'available') return `<p class="el-note">${T('No two-candidate count has been published for this seat yet.', '此席位尚未发布两候选人计票。')}</p>`;
  const known = two.candidates.every((item) => item.votes !== null);
  const sum = known ? two.candidates.reduce((total, item) => total + item.votes, 0) : 0;
  const rows = two.candidates.map((item) => {
    const candidate = race.candidates.find((entry) => entry.candidateId === item.candidateId);
    return `<tr><td>${esc(candidate?.name) || DASH}</td><td class="el-num">${item.votes === null ? DASH : esc(item.votes.toLocaleString('en-AU'))}</td><td class="el-num">${sum && item.votes !== null ? `${((item.votes / sum) * 100).toFixed(1)}%` : DASH}</td></tr>`;
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
    const when = decision.decidedAt
      ? formatTime(decision.decidedAt)
      : T(`first seen in the feed ${formatTime(decision.firstObservedAt)}; the feed gives no declaration date`, `${formatTime(decision.firstObservedAt)} 首次在数据中出现；数据未提供宣布日期`);
    // The validator only admits an http(s) address here, so the link cannot run script.
    return `${esc(decision.authority)} · ${when} · <a href="${esc(decision.evidenceUrl)}" target="_blank" rel="noopener noreferrer">${T('Evidence', '依据')} ↗</a>`;
  }
  return T('No decision yet. A lead is not a decision.', '尚无判定。领先不等于判定。');
}

function renderRaceDrawer(event, office, seat, race) {
  const stale = raceFreshness(race, shown.pointer) === 'stale';
  const progress = progressText(race);
  const { provenance } = race;
  return `<div class="el-drawer-head">
      <div>
        <p class="el-eyebrow">${T('Race details', '比赛详情')} · ${L(office.fullName)}</p>
        <h3 id="el-drawer-title" tabindex="-1">${L(seat.label)}</h3>
      </div>
      <button type="button" class="el-drawer-close" data-close aria-label="${T('Close race details', '关闭比赛详情')}">×</button>
    </div>
    ${shown.snapshot.isSynthetic ? `<p class="el-drawer-flag">${T('Synthetic test data. Not a real result.', '合成测试数据，不是真实结果。')}</p>` : ''}
    ${stale ? `<p class="el-drawer-flag">${T(`Stale: last updated ${formatTime(provenance.sourceUpdatedAt)}. The source has not refreshed this contest since.`, `已过时：最后更新于 ${formatTime(provenance.sourceUpdatedAt)}，来源此后未刷新这场比赛。`)}</p>` : ''}
    ${seat.area && seat.feature ? `<p class="el-note">${T('This region elects five members together. The number only counts them.', '这个大区一起选出五席，编号只用于计数。')}</p>` : ''}
    ${race.electionDate !== event.pollDate ? `<p class="el-note">${T(`Held on ${formatDay(race.electionDate)}, after the main polling day.`, `于 ${formatDay(race.electionDate)} 举行，晚于主投票日。`)}</p>` : ''}
    ${renderCandidates(race)}
    ${renderTwoCandidate(race)}
    <dl class="el-kv">
      <dt>${T('Status', '状态')}</dt><dd>${seatStatus(seat)}</dd>
      <dt>${T('Decided by', '判定方')}</dt><dd>${decisionText(event, race)}</dd>
      <dt>${T('Progress', '进度')}</dt><dd>${progress || (race.counting.status === 'recount' ? T('Recount: only contest totals are published', '重新计票：只发布比赛总数') : DASH)}</dd>
      <dt>${T('Swing', '摆动')}</dt><dd>${L(swingNote(event, office))}</dd>
      <dt>${T('Source time', '来源时间')}</dt><dd>${formatTime(provenance.sourceUpdatedAt)}</dd>
      <dt>${T('File published', '文件发布')}</dt><dd>${formatTime(provenance.publishedAt)}</dd>
      <dt>${T('Retrieved', '获取时间')}</dt><dd>${formatTime(provenance.fetchedAt)}</dd>
    </dl>
    <a class="el-btn" href="${event.officialUrl}" target="_blank" rel="noopener noreferrer">${L(event.officialLabel)} ↗</a>`;
}

const electionYear = (event) => (event.pollDate || event.sortDate).slice(0, 4);

function renderDrawer(event, office, seat) {
  const race = currentRaces().get(seat.seatId);
  if (race) return renderRaceDrawer(event, office, seat, race);
  const us = event.family === 'us';
  const progress = us ? T('% reporting (unit named by the source)', '已报告比例（单位以来源为准）') : T(`% counted (${event.authority} measure)`, `已计比例（${event.authority} 口径）`);
  const contest = us ? T('Margin', '差距') : T('TCP', '两候选人优先票');
  const onBallot = seat.onBallot;
  return `<div class="el-drawer-head">
      <div>
        <p class="el-eyebrow">${T('Race details', '比赛详情')} · ${L(office.fullName)}</p>
        <h3 id="el-drawer-title" tabindex="-1">${L(seat.label)}</h3>
      </div>
      <button type="button" class="el-drawer-close" data-close aria-label="${T('Close race details', '关闭比赛详情')}">×</button>
    </div>
    ${seat.placeholder ? `<p class="el-note">${T('Placeholder. The electorate name needs an official list.', '占位。选区名称需要官方名单。')}</p>` : ''}
    ${seat.area && seat.feature ? `<p class="el-note">${T('This region elects five members together. The number only counts them.', '这个大区一起选出五席，编号只用于计数。')}</p>` : ''}
    ${seat.contest === 'special' ? `<p class="el-note">${T('Special contest in 2026.', '2026 年特别选举。')}</p>` : ''}
    ${onBallot ? `<table class="el-cands">
        <thead><tr><th scope="col">${T('Candidate', '候选人')}</th><th scope="col">${T('Party', '党派')}</th><th scope="col" class="el-num">${T('Votes', '票数')}</th><th scope="col" class="el-num">%</th></tr></thead>
        <tbody><tr><td>${DASH}</td><td>${DASH}</td><td class="el-num">${DASH}</td><td class="el-num">${DASH}</td></tr></tbody>
      </table>
      <p class="el-note">${T('Candidates are not loaded. Every candidate will be listed, including independents and same-party contests.', '候选人未加载。接入后会列出全部候选人，包括独立候选人和同党对决。')}</p>`
    : `<p class="el-note">${T(`This seat is not on the ${electionYear(event)} ballot. Held-seat and caucus data are not loaded.`, `此席位不在 ${electionYear(event)} 年改选之列。在任与党团数据未加载。`)}</p>`}
    <dl class="el-kv">
      <dt>${T('Status', '状态')}</dt><dd>${seatStatus(seat)}</dd>
      ${onBallot ? `<dt>${progress}</dt><dd>${DASH}</dd>
      <dt>${contest}</dt><dd>${DASH}</dd>
      <dt>${T('Swing', '摆动')}</dt><dd>${L(swingNote(event, office))}</dd>` : ''}
      <dt>${T('Source time', '来源时间')}</dt><dd>${DASH}</dd>
      <dt>${T('Retrieved', '获取时间')}</dt><dd>${DASH}</dd>
      <dt>${T('Decided by', '判定方')}</dt><dd>${L(event.decision)}</dd>
    </dl>
    <p class="el-note">— ${NOT_LOADED()}</p>
    <a class="el-btn" href="${event.officialUrl}" target="_blank" rel="noopener noreferrer">${L(event.officialLabel)} ↗</a>`;
}

function markSelected() {
  document.querySelectorAll('[data-row]').forEach((row) => row.classList.toggle('is-selected', row.dataset.row === state.raceId));
  document.querySelectorAll('.el-seat-link').forEach((link) => {
    if (link.dataset.seat === state.raceId) link.setAttribute('aria-current', 'true');
    else link.removeAttribute('aria-current');
  });
}

// A map feature can hold several seats, so selection is by membership.
const holdsRace = (tile) => (tile.dataset.seats ? tile.dataset.seats.split(' ').includes(state.raceId) : tile.dataset.seat === state.raceId);

function syncMarks() {
  // The chart, the map and the seat blocks each keep one Tab stop.
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
  // The header's language link carries the query string, so it must follow every move.
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

// A whole view was redrawn, so the control that was pressed may be gone. Put focus somewhere that says where we are.
function focusViewTitle() {
  const title = $('el-title');
  title.setAttribute('tabindex', '-1');
  title.focus({ preventScroll: true });
}

// Returns true when the whole console was redrawn for another event or office.
function applyState(next) {
  const previous = state;
  state = next;
  if (next.event === previous.event && next.office === previous.office && previous.event) {
    if (next.geographyView !== previous.geographyView) refreshExplore();
    if (!document.querySelector(`[data-row="${state.raceId}"]`) && state.raceId) renderRaces();
    syncSelection();
    showAreaSummary();
    return false;
  }
  activeMap = null;
  zoomedSeat = null;
  table = { key: 'seat', direction: 'asc', expanded: false };
  render();
  syncPageTitle();
  return true;
}

let returnFocus = null;

// Opening the drawer adds a history entry, so Back closes it. Moving between seats does not.
function selectSeat(seatId, trigger) {
  returnFocus = trigger || null;
  go(withRace(state, seatId), { push: !state.raceId });
  const beside = window.matchMedia('(min-width: 1280px)').matches;
  const phone = window.matchMedia('(max-width: 640px)').matches;
  // The sheet covers the lower page on a phone, so bring the map above it. Between the two, the details sit below the map.
  const map = phone ? trigger?.closest?.('.el-map-svg') : null;
  $('el-drawer-title')?.focus({ preventScroll: beside || Boolean(map) });
  // Computed by hand: WebKit misplaces scrollIntoView on an SVG element.
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
  selectSeat(seat.seatId, null);
}

function closeDrawer() {
  const seatId = returnFocus?.dataset.seat || state.raceId;
  const trigger = returnFocus?.isConnected ? returnFocus : null;
  go(withRace(state, null), { push: false });
  const target = trigger || document.querySelector(`.el-seat-link[data-seat="${seatId}"]`) || document.querySelector(`[data-roving] [data-seat="${seatId}"]`);
  target?.focus({ preventScroll: true });
}

document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-nav], [data-office], [data-geo], #el-zoom-seat, [data-seat], [data-sort], [data-expand], [data-close], #el-explore-toggle, #el-feed-toggle, [data-replay]');
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
    go(withGeography(state, { view: target.dataset.geo }), { push: false });
    document.querySelector(`[data-geo="${target.dataset.geo}"]`)?.focus();
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
  } else {
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
  // A datalist pick arrives as a whole value, unlike typing.
  if (event.target.id === 'el-search' && event.inputType === 'insertReplacementText') searchSeat();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && event.target.id === 'el-search') {
    event.preventDefault();
    searchSeat();
    return;
  }
  if (event.key === 'Escape' && state.raceId) {
    closeDrawer();
    return;
  }
  const tile = event.target.closest?.('[data-roving] [data-seat]');
  if (!tile) return;
  // Chart marks are SVG, so Enter and Space do not click them the way they do a button.
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
    const mark = event.target.closest?.('.el-seat, .el-feature');
    if (mark) showReadout(preview ? mark.dataset.seat : state.raceId);
  });
}

window.addEventListener('popstate', () => {
  const hadRace = state.raceId;
  const trigger = returnFocus?.isConnected ? returnFocus : null;
  applyState(parseState(window.location.search));
  if (hadRace && !state.raceId) trigger?.focus({ preventScroll: true });
});

document.addEventListener('visibilitychange', () => feed?.visibilityChanged());

window.addEventListener('afflatus-lang', (event) => {
  lang = event.detail === 'zh' ? 'zh' : 'en';
  activeMap = null;
  render();
  syncPageTitle();
});

// A URL that named an invalid event, office or race is corrected rather than echoed.
window.history.replaceState(null, '', `${window.location.pathname}${serializeState(state)}${window.location.hash}`);
render();
syncPageTitle();
