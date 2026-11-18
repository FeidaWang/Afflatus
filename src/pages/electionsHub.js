import { ELECTION_EVENTS, daysUntil, eventPhase, nextEvent, railPositions } from '../lib/electionRules.js';
import { createChamberLayout } from '../lib/chamberLayout.js';

const $ = (id) => document.getElementById(id);
const DASH = '—';
const keepDate = (text) => text.replace(/\d+ [年月日](?: \d+ [月日])*/g, (date) => date.replaceAll(' ', '\u00a0'));

export const electionLabel = (pair, lang) => (lang === 'zh' ? keepDate(pair.zh) : pair.en);

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
  $('el-view').innerHTML = `${renderRail()}
    <div class="el-bento">
      ${next ? renderNextCard(next) : ''}
      <ul class="el-cards">${others.map((event, index) => renderCard(event, index === 0)).join('')}</ul>
    </div>
    <p class="el-foot">${T('Australia/Melbourne & America/New_York · Checked against official sources Nov 2026.', '墨尔本与纽约时区 · 2026 年 11 月对照官方来源核对。')}</p>`;
}
