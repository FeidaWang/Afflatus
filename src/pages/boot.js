/* U23 option-C prototype — full game boot (boot.html).
 *
 * Disposable experiment: boots like a ship OS, then hands the whole viewport
 * to the existing self-contained 3D battle scene (topdownCombat). Zero code
 * shared INTO production paths — this file only consumes existing modules.
 * The scene module (and three.js vendor chunk) is imported in parallel with
 * the boot animation so the wait is hidden behind the typing sequence.
 *
 * Camera: topdownCombat reads ?combatcam=director from location.search on its
 * own; the CAM station just reloads with the query toggled.
 */

const log = document.getElementById('bootLog');
const bar = document.querySelector('#bootBar i');
const enter = document.getElementById('bootEnter');
const overlay = document.getElementById('bootOverlay');
const bridge = document.getElementById('bridge');
const glFail = document.getElementById('glFail');
const canvas = document.getElementById('bridgeCanvas');

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const DIRECTOR = /[?&]combatcam=director\b/.test(location.search);

const LINES = [
  ['AFFLATUS OS v1.5 — DEEP-SPACE CAPITAL FLEET', 'b'],
  ['BIOS: singular-throne · bearing locked', ''],
  ['mount /dev/alphard .......................... OK', 'ok'],
  ['loading hull geometry (carrier · escorts) ... OK', 'ok'],
  ['spinning up reactor ......................... 100%', 'ok'],
  ['calibrating weapon clocks ................... OK', 'ok'],
  ['uplink: fleet telemetry ..................... SYNCED', 'ok'],
  ['星图引擎在线 · 防御矩阵待命', 'warm'],
  ['ALL SYSTEMS NOMINAL', 'b'],
];

// ── kick off the heavy import immediately (hidden behind the boot log) ──
const scenePromise = import('../scene/topdownCombat.js');

// ── boot log typing ──────────────────────────────────────────────────────
let li = 0;
function typeLines() {
  if (li >= LINES.length) { armEnter(); return; }
  const [text, cls] = LINES[li];
  const el = document.createElement('div');
  if (cls) el.className = cls;
  el.textContent = text;
  log.appendChild(el);
  li++;
  bar.style.width = `${Math.round((li / LINES.length) * 100)}%`;
  setTimeout(typeLines, REDUCED ? 0 : 140 + Math.random() * 220);
}

function armEnter() {
  enter.classList.add('on');
  enter.addEventListener('click', takeBridge, { once: true });
  addEventListener('keydown', takeBridge, { once: true });
}

// ── bridge handover ──────────────────────────────────────────────────────
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

// pause when tab hidden — no rendering you can't see (U23 rAF discipline)
document.addEventListener('visibilitychange', () => {
  if (!td) return;
  if (document.hidden) td.stop(); else td.start();
});

// ── live telemetry (real data only: clock + measured fps) ───────────────
function startTelemetry() {
  const tClock = document.getElementById('tClock');
  const tFps = document.getElementById('tFps');
  const tCam = document.getElementById('tCam');
  tCam.textContent = DIRECTOR ? 'DIRECTOR' : 'TACTICAL';
  let frames = 0, last = performance.now();
  function tick(now) {
    frames++;
    if (now - last >= 1000) {
      tFps.textContent = String(frames);
      frames = 0; last = now;
      const d = new Date();
      tClock.textContent = d.toTimeString().slice(0, 8);
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// ── CAM station: toggle the existing camera-director query and reload ───
document.getElementById('camToggle').addEventListener('click', () => {
  location.search = DIRECTOR ? '' : '?combatcam=director';
});

typeLines();
