import { safeText } from '../utils/dom.js';

export function createBattleFeed({ feed: feedRoot = null, getLang = () => 'en', timestamp }) {
  let cursor = 0;
  let timer = null;
  const getFeed = () => feedRoot || document.getElementById('cicBattleFeed') || document.getElementById('battleFeed');

  function battleSeverity(msg) {
    const text = String(msg || '').toLowerCase();
    if (/核|nuke|fusion|auth|impact|brace|catastrophic|critical|warning|alert|警报|灾难|冲击/.test(text)) return 'critical';
    if (/enforcer|main cannon|main gun|主炮|charge|spool|cool|reload|装填|冷却|large|giant|halley|彗星|proximity|目标|target/.test(text)) return 'warning';
    if (/destroyed|eliminated|ready|recharged|armed|nominal|摧毁|击毁|就绪|恢复|清澈|确认/.test(text)) return 'success';
    return 'info';
  }

  function ensureKillMeter() {
    const existing = document.getElementById('killCounter')?.closest('.cic-kill-meter, .combat-kill-meter');
    if (existing) return existing;
    const feed = getFeed();
    if (!feed) return null;
    let meter = feed.querySelector('.combat-kill-meter');
    if (!meter) {
      meter = document.createElement('output');
      meter.className = 'combat-kill-meter';
      meter.setAttribute('aria-label', 'Confirmed kills');
      meter.innerHTML = '<b id="killCounter">0</b>';
      feed.appendChild(meter);
    }
    return meter;
  }

  function ensureFeedLine() {
    const feed = getFeed();
    if (!feed) return null;
    let line = feed.querySelector('.cic-feed-line');
    if (!line) {
      line = document.createElement('div');
      line.className = 'cic-feed-line';
      feed.appendChild(line);
    }
    return line;
  }

  function syncBattleFeedDisplay(reset = false) {
    const feed = getFeed();
    if (!feed) return;
    const items = [...feed.querySelectorAll('.cic-toast')];
    if (reset) cursor = 0;
    if (items.length) {
      cursor = ((cursor % items.length) + items.length) % items.length;
      items.forEach((el, i) => el.classList.toggle('active', i === cursor));
      const line = ensureFeedLine();
      if (line) {
        const cur = items[cursor];
        const sev = (cur.className.match(/sev-(\w+)/) || [])[1] || 'info';
        line.textContent = cur.querySelector('.msg')?.textContent || '';
        line.dataset.severity = sev;
      }
    }
    ensureKillMeter();
    if (!timer) {
      timer = setInterval(() => {
        const latestFeed = getFeed();
        if (!latestFeed) return;
        const latest = [...latestFeed.querySelectorAll('.cic-toast')];
        if (latest.length < 2) return;
        cursor = (cursor + 1) % latest.length;
        syncBattleFeedDisplay(false);
      }, 3200);
    }
  }

  function pushBattleToast(msg, severity, opts = {}) {
    const feed = getFeed();
    if (!feed || !msg) return;
    const now = performance.now();
    if (pushBattleToast.last === msg && now - (pushBattleToast.at || 0) < 1300) return;
    pushBattleToast.last = msg;
    pushBattleToast.at = now;
    const el = document.createElement('div');
    const sev = severity || battleSeverity(msg);
    // Timestamp prefix removed: the per-toast <time> read like a second clock
    // and stole horizontal space from the live combat message. The feed is a
    // real-time ticker now — newest event is prepended and shown immediately.
    el.className = `cic-toast sev-${sev}`;
    el.innerHTML = `<span class="sev-dot" aria-hidden="true"></span><span class="msg">${safeText(msg)}</span>`;
    feed.prepend(el);
    [...feed.querySelectorAll('.cic-toast')].slice(9).forEach(node => node.remove());
    syncBattleFeedDisplay(true);
    setTimeout(() => el.classList.add('stale'), opts.persist ? 9000 : 5200);
  }

  function seedBattleFeed() {
    const feed = getFeed();
    if (!feed || feed.dataset.seeded === '1') return;
    feed.dataset.seeded = '1';
    ensureKillMeter();
    const zh = getLang() === 'zh';
    pushBattleToast(
      zh ? 'CIC 事件总线在线 · 等待传感器实况' : 'CIC EVENT BUS ONLINE · AWAITING SENSOR CONTACT',
      'info',
      { persist: true },
    );
  }

  return {
    battleSeverity,
    ensureKillMeter,
    pushBattleToast,
    seedBattleFeed,
    syncBattleFeedDisplay,
  };
}
