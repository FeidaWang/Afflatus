/**
 * Commander Terminal panel: STAR MAP <-> LOGIN.
 * The map page is the enhanced Alphard star map (starMapScene): rotating
 * field, nebulae, Earth->Alphard route pulse, radar sweep, glowing labels.
 * Login form and toggle behavior unchanged.
 */
import { createStarMapScene } from '../scene/starMapScene.js';

export function initTerminalStarMap({ getLang = () => 'en' } = {}) {
  const panel = document.getElementById('terminalStarMapPanel');
  const canvas = document.getElementById('terminalStarMap');
  const toggle = document.getElementById('starmapToggle');
  const login = document.querySelector('.notebook-login');
  if (!panel || !canvas || !toggle) return null;

  const modeLabel = active => {
    if (active) return getLang() === 'zh' ? '登录' : 'LOGIN';
    return getLang() === 'zh' ? '星图' : 'STAR MAP';
  };
  const setMode = active => {
    panel.classList.toggle('active', active);
    login?.classList.toggle('starmap-hidden', active);
    toggle.textContent = modeLabel(active);
    toggle.dataset.mode = active ? 'map' : 'login';
  };

  // Build the login "desktop" chrome once: a title bar (with the return-to-map
  // control), an AR hologram of the Blade Unit on the left, the credential form
  // on the right, a footer, a sweeping scan line and corner brackets. The old
  // top status row + toggle are removed (hidden via CSS). The star map is now a
  // full-panel live wallpaper you click anywhere to enter the computer.
  const HOLO_SVG = `
    <svg viewBox="0 0 120 168" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="bladeHolo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#cdf6ff" stop-opacity=".9"/>
          <stop offset="1" stop-color="#2f93cc" stop-opacity=".55"/>
        </linearGradient>
      </defs>
      <ellipse cx="60" cy="158" rx="38" ry="7" fill="#6fe9ff" opacity=".22"/>
      <line x1="98" y1="6" x2="66" y2="74" stroke="#6fe9ff" stroke-width="12" stroke-linecap="round" opacity=".3"/>
      <line x1="98" y1="6" x2="66" y2="74" stroke="#eafdff" stroke-width="4.5" stroke-linecap="round" opacity=".95"/>
      <rect x="60" y="72" width="11" height="15" rx="2.5" fill="url(#bladeHolo)" stroke="#9af0ff"/>
      <path d="M50 28 l10 -6 10 6 v11 l-10 6 -10 -6 z" fill="url(#bladeHolo)" stroke="#cdf6ff"/>
      <rect x="53" y="31" width="14" height="3.4" rx="1" fill="#eafdff"/>
      <path d="M42 45 l8 -2 v11 l-11 3 z" fill="url(#bladeHolo)" stroke="#9af0ff"/>
      <path d="M78 45 l-8 -2 v11 l11 3 z" fill="url(#bladeHolo)" stroke="#9af0ff"/>
      <path d="M47 46 h26 l-4 36 h-18 z" fill="url(#bladeHolo)" stroke="#cdf6ff" opacity=".92"/>
      <circle cx="60" cy="60" r="4.2" fill="#eafdff" opacity=".95"/>
      <path d="M73 50 l-3 9 -4 14" fill="none" stroke="#bdf3ff" stroke-width="5.2" stroke-linecap="round"/>
      <path d="M47 51 l-7 13 4 8" fill="none" stroke="#bdf3ff" stroke-width="5.2" stroke-linecap="round"/>
      <path d="M51 82 h18 l-2 9 h-14 z" fill="url(#bladeHolo)" stroke="#9af0ff"/>
      <path d="M54 91 l-7 31 -2 16" fill="none" stroke="#bdf3ff" stroke-width="6.4" stroke-linecap="round"/>
      <path d="M66 91 l7 31 2 16" fill="none" stroke="#bdf3ff" stroke-width="6.4" stroke-linecap="round"/>
    </svg>`;

  if (login && !login.querySelector('.term-form')) {
    const make = (tag, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };

    // title bar: name + return-to-map control
    const head = make('div', 'term-head');
    const title = make('span', 'term-title');
    title.textContent = '▸ AFFLATUS OS · SECURE SHELL · ENCRYPTED';
    const back = make('button', 'term-back');
    back.type = 'button';
    back.textContent = getLang() === 'zh' ? '◂ 星图' : '◂ STAR MAP';
    back.addEventListener('click', e => { e.stopPropagation(); setMode(true); });
    head.append(title, back);

    // AR hologram (left) — Blade Unit projection
    const holo = make('div', 'term-hologram');
    holo.innerHTML = HOLO_SVG;
    const holoLabel = make('div', 'term-holo-label');
    holoLabel.textContent = 'BLADE UNIT · LV 34';
    holo.appendChild(holoLabel);

    // credential form (right)
    const form = make('div', 'term-form');
    login.querySelectorAll('label').forEach(l => form.appendChild(l));
    const loginBtn = login.querySelector('#terminalLoginBtn');
    if (loginBtn) form.appendChild(loginBtn);

    const foot = make('div', 'term-foot');
    foot.textContent = '● ACCESS RESTRICTED · CREDENTIALS REQUIRED · 私人航行日志';

    const scan = make('div', 'term-scan');
    login.append(head, holo, form, foot, scan);
    for (const c of ['tl', 'tr', 'bl', 'br']) login.appendChild(make('i', 'term-corner ' + c));
  }

  setMode(true);   // default: the star-map wallpaper
  panel.style.cursor = 'pointer';
  panel.addEventListener('click', () => setMode(false));   // click anywhere on the map -> computer
  toggle.addEventListener('click', e => { e.stopPropagation(); setMode(true); });

  const scene = createStarMapScene();
  const ctx = canvas.getContext('2d');

  (function drawMap(now) {
    if (!document.hidden && panel.classList.contains('active')) {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(devicePixelRatio || 1, 2);
      if (rect.width > 2 && rect.height > 2) {
        const ww = Math.floor(rect.width * dpr);
        const hh = Math.floor(rect.height * dpr);
        if (canvas.width !== ww || canvas.height !== hh) {
          canvas.width = ww;
          canvas.height = hh;
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        scene.draw(ctx, rect.width, rect.height, now, getLang());
      }
    }
    requestAnimationFrame(drawMap);
  })(performance.now());

  return { setMode };
}
