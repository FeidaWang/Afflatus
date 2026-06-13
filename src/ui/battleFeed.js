import { safeText } from '../utils/dom.js';

export function createBattleFeed({ getLang = () => 'en', timestamp }) {
  let cursor = 0;
  let timer = null;

  function battleSeverity(msg) {
    const text = String(msg || '').toLowerCase();
    if (/核|nuke|fusion|auth|impact|brace|catastrophic|critical|warning|alert|警报|灾难|冲击/.test(text)) return 'critical';
    if (/enforcer|main cannon|main gun|主炮|charge|spool|cool|reload|装填|冷却|large|giant|halley|彗星|proximity|目标|target/.test(text)) return 'warning';
    if (/destroyed|eliminated|ready|recharged|armed|nominal|摧毁|击毁|就绪|恢复|清澈|确认/.test(text)) return 'success';
    return 'info';
  }

  function ensureKillMeter() {
    const feed = document.getElementById('battleFeed');
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

  function syncBattleFeedDisplay(reset = false) {
    const feed = document.getElementById('battleFeed');
    if (!feed) return;
    const items = [...feed.querySelectorAll('.toast')];
    if (reset) cursor = 0;
    if (items.length) {
      cursor = ((cursor % items.length) + items.length) % items.length;
      items.forEach((el, i) => el.classList.toggle('active', i === cursor));
    }
    ensureKillMeter();
    if (!timer) {
      timer = setInterval(() => {
        const latestFeed = document.getElementById('battleFeed');
        if (!latestFeed) return;
        const latest = [...latestFeed.querySelectorAll('.toast')];
        if (latest.length < 2) return;
        cursor = (cursor + 1) % latest.length;
        syncBattleFeedDisplay(false);
      }, 3200);
    }
  }

  function pushBattleToast(msg, severity, opts = {}) {
    const feed = document.getElementById('battleFeed');
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
    el.className = `toast sev-${sev}`;
    el.innerHTML = `<span class="sev-dot" aria-hidden="true"></span><span class="msg">${safeText(msg)}</span>`;
    feed.prepend(el);
    [...feed.querySelectorAll('.toast')].slice(9).forEach(node => node.remove());
    syncBattleFeedDisplay(true);
    setTimeout(() => el.classList.add('stale'), opts.persist ? 9000 : 5200);
  }

  function seedBattleFeed() {
    const feed = document.getElementById('battleFeed');
    if (!feed || feed.dataset.seeded === '1') return;
    feed.dataset.seeded = '1';
    ensureKillMeter();
    const zh = getLang() === 'zh';
    const rows = zh ? [
      ['航线锁定 · 引力井边缘', 'info'],
      ['导弹阵列 A-D 待命', 'success'],
      ['侦测到哈雷型彗星进入武器射程', 'warning'],
      ['损管组派出 · 12名船员', 'info'],
      ['护盾回充至 74% · 标称', 'success'],
      ['执法者主炮预热 · 充能40%', 'warning'],
      ['1P/HALLEY 接近 +4.2 km/s', 'critical'],
    ] : [
      ['Navigation locked on gravity-well edge', 'info'],
      ['Missile batteries A-D armed and ready', 'success'],
      ['Comet entering weapon range · 340 LS', 'warning'],
      ['Damage control dispatched · 12 crew', 'info'],
      ['Shields recharged to 74% · nominal', 'success'],
      ['Enforcer cannon spooling · charge 40%', 'warning'],
      ['1P/HALLEY closing +4.2 km/s', 'critical'],
    ];
    rows.forEach((row, i) => pushBattleToast(row[0], row[1], { persist: true, offsetSec: (rows.length - i) * 17 }));
  }

  return {
    battleSeverity,
    ensureKillMeter,
    pushBattleToast,
    seedBattleFeed,
    syncBattleFeedDisplay,
  };
}
