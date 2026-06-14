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
    <svg viewBox="0 0 140 182" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <ellipse cx="70" cy="170" rx="36" ry="7" fill="#6fe0ff" opacity=".30"/>
      <!-- dagger hull, blunt armoured nose -->
      <path d="M58 18 L82 18 L96 72 L100 132 L86 164 L54 164 L40 132 L44 72 Z" fill="rgba(96,200,245,.12)" stroke="#7fe0ff" stroke-width="1.5"/>
      <rect x="61" y="11" width="18" height="9" rx="1.5" fill="rgba(120,216,255,.2)" stroke="#9af0ff" stroke-width="1"/>
      <line x1="70" y1="11" x2="70" y2="3" stroke="#cdf6ff" stroke-width="2.2"/>
      <circle cx="70" cy="3" r="2.2" fill="#eafdff"/>
      <!-- segment + spine lines -->
      <line x1="70" y1="20" x2="70" y2="158" stroke="#9af0ff" stroke-width="1" opacity=".45"/>
      <line x1="46" y1="58" x2="94" y2="58" stroke="#7fe0ff" stroke-width=".7" opacity=".5"/>
      <line x1="44" y1="86" x2="96" y2="86" stroke="#7fe0ff" stroke-width=".7" opacity=".5"/>
      <line x1="43" y1="114" x2="97" y2="114" stroke="#7fe0ff" stroke-width=".7" opacity=".5"/>
      <line x1="42" y1="140" x2="98" y2="140" stroke="#7fe0ff" stroke-width=".7" opacity=".5"/>
      <!-- bridge tower -->
      <path d="M60 70 L80 70 L76 96 L64 96 Z" fill="rgba(190,243,255,.18)" stroke="#bdf3ff" stroke-width="1"/>
      <circle cx="70" cy="82" r="3" fill="#eafdff"/>
      <!-- weapon turrets -->
      <circle cx="50" cy="102" r="3.4" fill="rgba(110,216,255,.16)" stroke="#9af0ff" stroke-width=".8"/>
      <circle cx="90" cy="102" r="3.4" fill="rgba(110,216,255,.16)" stroke="#9af0ff" stroke-width=".8"/>
      <circle cx="52" cy="128" r="2.8" fill="rgba(110,216,255,.16)" stroke="#9af0ff" stroke-width=".8"/>
      <circle cx="88" cy="128" r="2.8" fill="rgba(110,216,255,.16)" stroke="#9af0ff" stroke-width=".8"/>
      <!-- side wing-pods -->
      <path d="M44 96 L23 104 L27 119 L46 112 Z" fill="rgba(110,216,255,.10)" stroke="#7fe0ff" stroke-width="1"/>
      <path d="M96 96 L117 104 L113 119 L94 112 Z" fill="rgba(110,216,255,.10)" stroke="#7fe0ff" stroke-width="1"/>
      <line x1="25" y1="104" x2="21" y2="84" stroke="#9af0ff" stroke-width="1.3"/>
      <line x1="115" y1="104" x2="119" y2="84" stroke="#9af0ff" stroke-width="1.3"/>
      <!-- rear engine bank: four thrusters -->
      <rect x="47" y="150" width="46" height="16" rx="4" fill="rgba(110,216,255,.14)" stroke="#7fe0ff" stroke-width="1.2"/>
      <circle cx="56" cy="162" r="3.4" fill="#eafdff"/>
      <circle cx="66" cy="162" r="3.4" fill="#eafdff"/>
      <circle cx="74" cy="162" r="3.4" fill="#eafdff"/>
      <circle cx="84" cy="162" r="3.4" fill="#eafdff"/>
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
