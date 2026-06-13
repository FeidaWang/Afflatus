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

    // body: mothership hologram (left) + credential fields (right)
    const body = make('div', 'afpc-body');
    const holo = make('div', 'afpc-holo');
    const holoCanvas = make('canvas', 'afpc-holo-canvas');
    holoCanvasRef = holoCanvas;          // hologram created lazily on first login-open
    holo.appendChild(holoCanvas);
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
    fields.append(mkField('ACCOUNT', 'text', 'BRUCE.WANG'), mkField('PASSWORD', 'password', '••••••••'));
    body.append(holo, fields);

    const loginBtn = make('button', 'afpc-login');
    loginBtn.type = 'button';
    loginBtn.textContent = 'LOGIN';

    const foot = make('div', 'afpc-foot');
    foot.textContent = zh ? '● 访问受限 · 需要凭证 · 私人航行日志' : '● ACCESS RESTRICTED · CREDENTIALS REQUIRED · 私人航行日志';

    const scan = make('div', 'afpc-scan');
    pc.append(head, body, loginBtn, foot, scan);
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
