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
    <svg viewBox="0 0 150 178" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <ellipse cx="55" cy="158" rx="11" ry="6" fill="#9af0ff" opacity=".45"/>
      <ellipse cx="95" cy="158" rx="11" ry="6" fill="#9af0ff" opacity=".45"/>
      <path d="M75 14 L92 60 L98 120 L88 152 L62 152 L52 120 L58 60 Z" fill="rgba(110,216,255,.12)" stroke="#7fe0ff" stroke-width="1.4"/>
      <line x1="75" y1="22" x2="75" y2="148" stroke="#9af0ff" stroke-width="1" opacity=".55"/>
      <line x1="58" y1="76" x2="92" y2="76" stroke="#7fe0ff" stroke-width=".8" opacity=".5"/>
      <line x1="56" y1="100" x2="94" y2="100" stroke="#7fe0ff" stroke-width=".8" opacity=".5"/>
      <line x1="56" y1="124" x2="94" y2="124" stroke="#7fe0ff" stroke-width=".8" opacity=".5"/>
      <ellipse cx="75" cy="48" rx="9" ry="13" fill="rgba(190,243,255,.22)" stroke="#bdf3ff" stroke-width="1"/>
      <rect x="43" y="118" width="22" height="42" rx="8" fill="rgba(110,216,255,.14)" stroke="#7fe0ff" stroke-width="1.2"/>
      <rect x="85" y="118" width="22" height="42" rx="8" fill="rgba(110,216,255,.14)" stroke="#7fe0ff" stroke-width="1.2"/>
      <line x1="45" y1="130" x2="63" y2="130" stroke="#7fe0ff" stroke-width=".7" opacity=".6"/>
      <line x1="45" y1="142" x2="63" y2="142" stroke="#7fe0ff" stroke-width=".7" opacity=".6"/>
      <line x1="87" y1="130" x2="105" y2="130" stroke="#7fe0ff" stroke-width=".7" opacity=".6"/>
      <line x1="87" y1="142" x2="105" y2="142" stroke="#7fe0ff" stroke-width=".7" opacity=".6"/>
      <path d="M52 90 L30 100 L34 112 L54 108 Z" fill="rgba(110,216,255,.10)" stroke="#7fe0ff" stroke-width="1"/>
      <path d="M98 90 L120 100 L116 112 L96 108 Z" fill="rgba(110,216,255,.10)" stroke="#7fe0ff" stroke-width="1"/>
      <line x1="31" y1="100" x2="27" y2="78" stroke="#9af0ff" stroke-width="1.4"/>
      <line x1="119" y1="100" x2="123" y2="78" stroke="#9af0ff" stroke-width="1.4"/>
      <line x1="75" y1="22" x2="75" y2="5" stroke="#cdf6ff" stroke-width="2"/>
      <circle cx="75" cy="5" r="2.6" fill="#eafdff"/>
      <circle cx="55" cy="159" r="4" fill="#eafdff"/>
      <circle cx="95" cy="159" r="4" fill="#eafdff"/>
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
    foot.textContent = zh ? '● 访问受限 · 需要凭证 · 私人航行日志' : '● ACCESS RESTRICTED · CREDENTIALS REQUIRED · 私人航行日志';

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
