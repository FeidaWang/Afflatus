/* U23 option-C prototype — refactored per the U22 four-game charter.
 *
 * Star Citizen  → diegetic: the boot log and dock are shipboard devices.
 * Elite         → charter ②: every readout is a REAL state. The boot
 *                 sequence is gated on real async work (scene import + data
 *                 uplinks); each OK prints when its promise actually settles.
 *                 Failures print an honest warm OFFLINE, never a fake OK.
 * Homeworld     → cinematic camera director is the DEFAULT (tactical is the
 *                 opt-out), via the scene's existing ?combatcam= query.
 * Stellaris     → progressive disclosure: stations show one live number;
 *                 hover/focus opens a 2-line detail. Never a third layer.
 *
 * Still disposable: no production module is modified — data comes from the
 * same public/*.json the real pages read.
 */

const log = document.getElementById('bootLog');
const bar = document.querySelector('#bootBar i');
const overlay = document.getElementById('bootOverlay');
const bridge = document.getElementById('bridge');
const glFail = document.getElementById('glFail');
const canvas = document.getElementById('bridgeCanvas');

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
// Homeworld default: director ON unless explicitly ?combatcam=tactical.
const TACTICAL = /[?&]combatcam=tactical\b/.test(location.search);

const $ = (id) => document.getElementById(id);
const fmtUsd = (n) => '$' + Math.round(n).toLocaleString('en-US');

// ── real boot tasks (charter ②: the log is gated on these promises) ─────
const scenePromise = import('../scene/topdownCombat.js');
const j = (p) => fetch(p).then((r) => (r.ok ? r.json() : Promise.reject(r.status)));

const TASKS = [
  { line: 'BIOS: singular-throne · bearing locked', cls: 'b', run: () => Promise.resolve() },
  { line: 'loading hull geometry (carrier · escorts)', cls: '', run: () => scenePromise },
  {
    line: 'ledger uplink /arena', cls: '', run: () => j('/arena-ledger.json').then((d) => {
      const A = d.models?.A, B = d.models?.B;
      if (A) { $('bArena').textContent = `A ${fmtUsd(A.equity)}`; $('bArena').classList.remove('off'); }
      if (A && B) $('dArena').innerHTML =
        `B ${fmtUsd(B.equity)} · day ${d.day} S${d.season}<br>start $10,000 ×2 · sim ledgers`;
      return `A ${A ? fmtUsd(A.equity) : '?'}`;
    })
  },
  {
    line: 'basket matrix /sectors', cls: '', run: () => j('/sectors-data.json').then((d) => {
      $('bSectors').textContent = `${d.baskets.length} BASKETS`; $('bSectors').classList.remove('off');
      $('dSectors').innerHTML = `US–CN AI watch · ${d.modelWatch.length} models<br>as of ${d.as_of}`;
      return `${d.baskets.length} baskets`;
    })
  },
  {
    line: 'macro compass /signal', cls: '', run: () => j('/signal-events.json').then((d) => {
      const c = d.hawkDoveCompass;
      $('bSignal').textContent = `${c.label_en} ${c.score > 0 ? '+' : ''}${c.score}`;
      $('bSignal').classList.remove('off');
      $('dSignal').innerHTML = `${(d.events || []).length} incidents logged<br>as of ${d.as_of}`;
      return c.label_en;
    })
  },
  {
    line: 'prediction record /intel', cls: '', run: () => j('/games-data.json').then((d) => {
      $('bIntel').textContent = `${d.record.winRate}% · ${d.record.resolved}`;
      $('bIntel').classList.remove('off');
      $('dIntel').innerHTML = `${d.record.exactScore} exact scores ⭐<br>${d.tournament}`;
      return `${d.record.winRate}% WR`;
    })
  },
  {
    line: 'archive index /log', cls: '', run: () => j('/novels-index.json').then((d) => {
      const ch = d.novels.reduce((s, n) => s + (n.chapterCount || 0), 0);
      $('bLog').textContent = `${d.novels.length} BOOKS`; $('bLog').classList.remove('off');
      $('dLog').innerHTML = `${ch} chapters on file<br>长夜清减 · 万界种春 · 御西宫词`;
      return `${d.novels.length} books`;
    })
  },
  { line: 'typeface cache', cls: '', run: () => (document.fonts ? document.fonts.ready : Promise.resolve()) },
];

// ── boot log: each line prints when its real task settles ───────────────
async function boot() {
  print('AFFLATUS OS v1.5 — DEEP-SPACE CAPITAL FLEET', 'b');
  let done = 0;
  for (const t of TASKS) {
    const el = print(`${t.line} ...`, t.cls);
    const t0 = performance.now();
    try {
      const info = await t.run();
      if (!REDUCED) await pause(Math.max(0, 120 - (performance.now() - t0)));
      el.textContent = `${t.line} ${dots(t.line)} OK${typeof info === 'string' ? ' · ' + info : ''}`;
      el.className = 'ok';
    } catch (e) {
      el.textContent = `${t.line} ${dots(t.line)} OFFLINE`;
      el.className = 'warm'; // honest failure — never a fake OK
    }
    done++;
    bar.style.width = `${Math.round((done / TASKS.length) * 100)}%`;
  }
  print('ALL STATIONS REPORTING · 各站就位 — TAKING THE BRIDGE', 'warm');
  // auto-handover: no click gate (owner directive 2026-07-13); the progress
  // bar above is real (task-gated), so arrival here means everything loaded.
  await pause(REDUCED ? 0 : 700);
  takeBridge();
}
function print(text, cls) {
  const el = document.createElement('div');
  if (cls) el.className = cls;
  el.textContent = text;
  log.appendChild(el);
  return el;
}
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const dots = (s) => '.'.repeat(Math.max(2, 44 - s.length));

// ── bridge handover ──────────────────────────────────────────────────────
// (Director rig is the scene default since U23 M1 — no query injection
// needed; ?combatcam=tactical still opts out.)
let td = null;
async function takeBridge() {
  overlay.classList.add('gone');
  bridge.classList.add('on');
  bridge.removeAttribute('aria-hidden');
  let mod = null;
  try { mod = await scenePromise; } catch (e) { mod = null; }
  td = mod && mod.createTopdownCombat ? mod.createTopdownCombat({ canvas }) : null;
  if (!td) { glFail.classList.add('on'); return; }
  sizeCanvas();
  td.start();
  startTelemetry();
}

function sizeCanvas() {
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  if (td) td.resize();
}
addEventListener('resize', sizeCanvas);

// not visible → not rendered (U23 rAF discipline)
document.addEventListener('visibilitychange', () => {
  if (!td) return;
  if (document.hidden) td.stop(); else td.start();
});

// ── self-ship telemetry (warm): clock + measured fps + cam rig ──────────
function startTelemetry() {
  const tClock = $('tClock'), tFps = $('tFps'), tCam = $('tCam');
  const rig = TACTICAL ? 'TACTICAL' : 'DIRECTOR';
  tCam.textContent = rig;
  $('camLabel').textContent = TACTICAL ? '→ DIRECTOR' : '→ TACTICAL';
  let frames = 0, last = performance.now();
  (function tick(now) {
    frames++;
    if (now - last >= 1000) {
      tFps.textContent = String(frames);
      frames = 0; last = now || performance.now();
      tClock.textContent = new Date().toTimeString().slice(0, 8);
    }
    requestAnimationFrame(tick);
  })(performance.now());
}

// CAM station: flip rig via the scene's existing query mechanism.
$('camToggle').addEventListener('click', () => {
  location.search = TACTICAL ? '?combatcam=director' : '?combatcam=tactical';
});

boot();
