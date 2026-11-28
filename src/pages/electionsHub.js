import { ELECTION_EVENTS, PARTIES, daysUntil, eventById, eventPhase, nextEvent, railPositions } from '../lib/electionRules.js';
import { createChamberLayout } from '../lib/chamberLayout.js';
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
let hubCountLoad = null;

/** Reads the published pointer and snapshot through the same gate as the workbench. Null when nothing is cleared. */
async function loadHubCount(event) {
  const [results, { seatCatalogue }] = await Promise.all([import('../lib/electionResults.js'), import('../lib/electionCatalogue.js')]);
  const read = async (path) => {
    const response = await fetch(`${VEC_PUBLIC_FEED_BASE}${event.id}/${path}`, { cache: 'no-cache', signal: AbortSignal.timeout(20000) });
    return response.ok ? response.json() : null;
  };
  const pointer = await read('latest.json');
  if (!pointer || results.pointerErrors(pointer).length) return null;
  const snapshot = await read(`snapshots/${pointer.snapshotId}.json`);
  if (!snapshot || results.snapshotErrors(snapshot).length || snapshot.snapshotId !== pointer.snapshotId) return null;
  if (!results.feedAllowed(snapshot, window.location.hostname, { serverApprovedSource: 'vec-2026' })) return null;
  const office = event.offices[0];
  const tally = results.partyTally(seatCatalogue(event.id, office.id), results.seatStates(snapshot, pointer), PARTIES[event.family]);
  return { tally, publishedAt: snapshot.publishedAt };
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
  const eventHref = (event) => `?${new URLSearchParams({ event: event.id, office: event.offices[0].id })}`;

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
    const declared = parties.reduce((sum, party) => sum + hubCount.tally[party.id].decided, 0);
    const time = new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : 'en-AU', { timeZone: 'Australia/Melbourne', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(hubCount.publishedAt));
    const segment = (party, count, kind) => (count ? `<i class="el-tally-seg is-${kind}" style="width:${(count / office.seats) * 100}%;--seat:${party.color}"></i>` : '');
    const rows = parties.map((party, index) => {
      const { decided, leading } = hubCount.tally[party.id];
      const mark = `<span class="el-tally-mark" style="left:${(office.majority / office.seats) * 100}%">${index === 0 ? `<span>${L(office.majorityLabel)}</span>` : ''}</span>`;
      return `<div class="el-tally-row"><span class="el-tally-name">${L(party)}</span><div class="el-tally-bar">${segment(party, decided, 'decided')}${segment(party, leading, 'ahead')}${mark}</div><b>${decided + leading}</b></div>`;
    }).join('');
    return `<div class="el-tally-rows">${rows}</div>
      <p class="el-next-facts">${T(`Seats won or ahead on the current count · ${declared} declared · unofficial · ${time} Melbourne`, `已宣布或按当前计票领先的席位 · 已宣布 ${declared} 席 · 非正式结果 · 墨尔本时间 ${time}`)}</p>`;
  }

  function renderResultsCard(event) {
    const night = isVecElectionNight(now.getTime());
    return `<section class="el-next el-next-live" aria-labelledby="el-next-title">
      <div class="el-next-body">
        <p class="el-live-flag">${night ? T('Counting now', '正在计票') : T('Latest count', '最新计票')}</p>
        <h2 id="el-next-title">${night ? T('Victoria is counting', '维多利亚州正在计票') : T('Victoria: the count so far', '维多利亚州：目前计票结果')}</h2>
        <p class="el-next-facts">${officeFacts(event)} · ${L(event.extraFact)}</p>
        <div class="el-hub-count" id="el-hub-count">${renderHubCount(event)}</div>
        <a class="el-btn" href="${eventHref(event)}" data-nav>${night ? T('See live results', '查看实时结果') : T('See results', '查看结果')} →</a>
      </div>
    </section>`;
  }

  function renderCard(event, wide = false) {
    const phase = eventPhase(event, now);
    const pill = phase === 'past'
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
  strip.dataset.mode = lead ? 'live' : 'preview';
  if (lead) setText($('el-strip-flag'), 'Unofficial results', '非正式结果');
  else setText($('el-strip-flag'), 'Preview', '预览');
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
  if (lead && !hubCountLoad) {
    hubCountLoad = loadHubCount(lead).catch(() => null).then((count) => {
      hubCount = count;
      const host = $('el-hub-count');
      if (count && host) renderElectionHub(new Date(), electionLocale());
    });
  }
  $('el-view').innerHTML = `${renderRail()}
    <div class="el-bento">
      ${lead ? renderResultsCard(lead) : next ? renderNextCard(next) : ''}
      <ul class="el-cards">${others.map((event, index) => renderCard(event, index === 0)).join('')}</ul>
    </div>
    <p class="el-foot">${T('Australia/Melbourne & America/New_York · Checked against official sources Nov 2026.', '墨尔本与纽约时区 · 2026 年 11 月对照官方来源核对。')}</p>`;
}
