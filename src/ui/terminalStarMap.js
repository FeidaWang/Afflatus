/**
 * Commander Terminal panel: STAR MAP <-> LOGIN.
 * The map page is the enhanced Alphard star map (starMapScene): rotating
 * field, nebulae, Earth->Alphard route pulse, radar sweep, glowing labels.
 * Login form and toggle behavior unchanged.
 */
import { createStarMapScene } from '../scene/starMapScene.js';
// shipHologram (three.js) is dynamically imported on first login-open so three
// is code-split out of the main bundle.

export function initTerminalStarMap({ getLang = () => 'en' } = {}) {
  const panel = document.getElementById('terminalStarMapPanel');
  const canvas = document.getElementById('terminalStarMap');
  const toggle = document.getElementById('starmapToggle');
  const login = document.querySelector('.notebook-login');
  if (!panel || !canvas || !toggle) return null;

  let holoUnit = null, holoCanvasRef = null, holoLoading = false;
  const modeLabel = active => {
    if (active) return getLang() === 'zh' ? '登录' : 'LOGIN';
    return getLang() === 'zh' ? '星图' : 'STAR MAP';
  };
  const setMode = active => {
    panel.classList.toggle('active', active);
    login?.classList.toggle('starmap-hidden', active);
    toggle.textContent = modeLabel(active);
    toggle.dataset.mode = active ? 'map' : 'login';
    if (holoUnit) {
      holoUnit.setActive(!active);                 // hologram runs only on the login screen
    } else if (!active && !holoLoading && holoCanvasRef) {
      holoLoading = true;                          // first login-open → load three.js + ship hologram
      import('../scene/shipHologram.js')
        .then(m => { holoUnit = m.createShipHologram(holoCanvasRef); if (holoUnit) holoUnit.setActive(true); })
        .catch(() => {});
    }
  };

  // Holographic top-down mothership (line-art): central armoured hull, cockpit,
  // raised twin rear engine nacelles with ribs + bell glow, side wing-pods with
  // guns, and a forward main-gun spine. Reliable 2D (the full 3D model is the
  // main-gun cinematic).
  const MOTHERSHIP_SVG = `
    <svg viewBox="0 0 150 168" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="afHullL" x1="0" y1="0" x2="1" y2="0.2">
          <stop offset="0" stop-color="#cdefff" stop-opacity=".34"/>
          <stop offset="1" stop-color="#1f5e87" stop-opacity=".10"/>
        </linearGradient>
        <linearGradient id="afHullR" x1="1" y1="0" x2="0" y2="0.2">
          <stop offset="0" stop-color="#173f5e" stop-opacity=".30"/>
          <stop offset="1" stop-color="#2a6f9c" stop-opacity=".06"/>
        </linearGradient>
      </defs>
      <ellipse cx="75" cy="156" rx="30" ry="6" fill="#6fe0ff" opacity=".30"/>
      <!-- faceted hull: lit left facet + shaded right facet for depth -->
      <polygon points="75,10 75,90 62,90 60,40" fill="url(#afHullL)" stroke="#9af0ff" stroke-width="1.2"/>
      <polygon points="75,10 75,90 88,90 90,40" fill="url(#afHullR)" stroke="#9af0ff" stroke-width="1.2"/>
      <polygon points="62,90 75,90 75,150 100,140 88,90" fill="url(#afHullR)" stroke="#8fe6ff" stroke-width="1.2"/>
      <polygon points="62,90 75,90 75,150 50,140" fill="url(#afHullL)" stroke="#8fe6ff" stroke-width="1.2"/>
      <!-- nose tip + main gun -->
      <line x1="75" y1="10" x2="75" y2="2" stroke="#dffaff" stroke-width="2.4"/>
      <circle cx="75" cy="3" r="2" fill="#eafdff"/>
      <!-- bridge -->
      <polygon points="68,52 82,52 79,76 71,76" fill="rgba(205,247,255,.26)" stroke="#cdf6ff" stroke-width="1"/>
      <circle cx="75" cy="64" r="2.6" fill="#eafdff"/>
      <!-- panel lines -->
      <line x1="62" y1="70" x2="88" y2="70" stroke="#7fe0ff" stroke-width=".6" opacity=".5"/>
      <line x1="60" y1="100" x2="90" y2="100" stroke="#7fe0ff" stroke-width=".6" opacity=".5"/>
      <line x1="58" y1="122" x2="92" y2="122" stroke="#7fe0ff" stroke-width=".6" opacity=".5"/>
      <!-- swept wings + guns -->
      <polygon points="60,96 30,108 35,122 62,112" fill="url(#afHullL)" stroke="#7fe0ff" stroke-width="1"/>
      <polygon points="90,96 120,108 115,122 88,112" fill="url(#afHullR)" stroke="#7fe0ff" stroke-width="1"/>
      <line x1="32" y1="108" x2="28" y2="86" stroke="#9af0ff" stroke-width="1.4"/>
      <line x1="118" y1="108" x2="122" y2="86" stroke="#9af0ff" stroke-width="1.4"/>
      <!-- rear engine bank: triple thrusters -->
      <polygon points="56,136 94,136 90,154 60,154" fill="url(#afHullR)" stroke="#7fe0ff" stroke-width="1.2"/>
      <circle cx="65" cy="148" r="3.2" fill="#eafdff"/>
      <circle cx="75" cy="148" r="3.8" fill="#eafdff"/>
      <circle cx="85" cy="148" r="3.2" fill="#eafdff"/>
    </svg>`;

  // Build the PC from scratch inside a fresh .afpc container with unique class
  // names, so NONE of the dozen stacked .notebook-login rules can touch it. The
  // old login content is hidden via CSS (.notebook-login > *:not(.afpc)).
  if (login && !login.querySelector('.afpc')) {
    const make = (tag, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };
    const zh = getLang() === 'zh';
    const pc = make('div', 'afpc');

    // title bar: name (left) + STAR MAP control (right)
    const head = make('div', 'afpc-head');
    const title = make('span', 'afpc-title');
    title.textContent = 'AFFLATUS OS · SECURE SHELL';
    const mapBtn = make('button', 'afpc-map');
    mapBtn.type = 'button';
    mapBtn.textContent = zh ? '星图 ▸' : 'STAR MAP ▸';
    mapBtn.addEventListener('click', e => { e.stopPropagation(); setMode(true); });
    head.append(title, mapBtn);

    // body: mothership hologram (left, fills the dead space) + fields (right)
    const body = make('div', 'afpc-body');
    const holo = make('div', 'afpc-holo');
    holo.innerHTML = MOTHERSHIP_SVG;     // reliable 2D holographic projection
    const holoLabel = make('div', 'afpc-holo-label');
    holoLabel.textContent = 'ENFORCER · MOTHERSHIP';
    holo.appendChild(holoLabel);

    const fields = make('div', 'afpc-fields');
    const mkField = (lab, type, ph) => {
      const f = make('label', 'afpc-field');
      const s = make('span', 'afpc-flabel'); s.textContent = lab;
      const inp = make('input', 'afpc-input'); inp.type = type; inp.placeholder = ph; inp.autocomplete = 'off';
      f.append(s, inp); return f;
    };
    const loginBtn = make('button', 'afpc-login');
    loginBtn.type = 'button';
    loginBtn.textContent = 'LOGIN';
    // ACCOUNT / PASSWORD / LOGIN stacked in the right column → LOGIN never
    // overlaps the password field.
    fields.append(mkField('ACCOUNT', 'text', 'BRUCE.WANG'), mkField('PASSWORD', 'password', '••••••••'), loginBtn);
    body.append(holo, fields);

    const foot = make('div', 'afpc-foot');
    foot.textContent = zh ? '● 访问受限 · 需要凭证 · 私人航行日志' : '● ACCESS RESTRICTED · CREDENTIALS REQUIRED · PRIVATE VOYAGE LOG';

    const scan = make('div', 'afpc-scan');
    pc.append(head, body, foot, scan);
    for (const c of ['tl', 'tr', 'bl', 'br']) pc.appendChild(make('i', 'afpc-corner ' + c));
    login.appendChild(pc);
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
