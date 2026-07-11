/**
 * Commander Terminal panel: STAR MAP <-> LOGIN.
 * The map page is the enhanced Alphard star map (starMapScene): rotating
 * field, nebulae, Earth->Alphard route pulse, radar sweep, glowing labels.
 * Login form and toggle behavior unchanged.
 *
 * The login-screen ship hologram is a WebGL model (scene/shipHologram.js,
 * dynamically imported so three stays code-split out of the main bundle).
 * 2026-07-08: briefly swapped to a static image + CSS rotation, reverted
 * back to WebGL per user request (see shipHologram.js / carrierHull.js for
 * the current default hull, a hand-built approximation of the user's
 * reference image).
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

  // Ship hologram: lazily loaded (code-split, three.js only fetched once the
  // login panel is actually shown) and paused whenever the login panel isn't
  // visible, so it never renders off-screen.
  let holoCanvasRef = null, holoUnit = null, holoLoading = false;
  const setMode = active => {
    panel.classList.toggle('active', active);
    login?.classList.toggle('starmap-hidden', active);
    toggle.textContent = modeLabel(active);
    toggle.dataset.mode = active ? 'map' : 'login';
    if (!active) {
      if (holoUnit) holoUnit.setActive(true);
      else if (holoCanvasRef && !holoLoading) {
        holoLoading = true;
        import('../scene/shipHologram.js').then(({ createShipHologram }) => {
          holoLoading = false;
          holoUnit = createShipHologram(holoCanvasRef);
          holoUnit?.setActive(true);
        });
      }
    } else {
      holoUnit?.setActive(false);
    }
  };

  // Build the PC once as a macOS-style window inside a fresh .afpc container
  // (unique class names, so no old .notebook-login rule can touch it). Title
  // bar: × close (-> star map) at the left + window name. Body: ship
  // hologram image (left) + credential fields (right). Thin border, no footer.
  if (login && !login.querySelector('.afpc')) {
    const make = (tag, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };
    const pc = make('div', 'afpc');

    const head = make('div', 'afpc-head');
    const close = make('button', 'afpc-close');
    close.type = 'button';
    close.textContent = '✕';
    close.setAttribute('aria-label', getLang() === 'zh' ? '关闭 · 返回星图' : 'Close · Star Map');
    close.addEventListener('click', e => { e.stopPropagation(); setMode(true); });
    const title = make('span', 'afpc-title');
    title.textContent = 'Private Voyage Log';
    head.append(close, title);

    const body = make('div', 'afpc-body');
    const holo = make('div', 'afpc-holo');
    const holoCanvas = make('canvas', 'afpc-holo-canvas');
    holoCanvasRef = holoCanvas;
    holo.appendChild(holoCanvas);
    const holoLabel = make('div', 'afpc-holo-label');
    holoLabel.textContent = getLang() === 'zh' ? '执法者 · 母舰' : 'CONDOR · MOTHERSHIP';
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
    fields.append(mkField('ACCOUNT', 'text', 'BRUCE.WANG'), mkField('PASSWORD', 'password', '••••••••'), loginBtn);
    body.append(holo, fields);

    const scan = make('div', 'afpc-scan');
    pc.append(head, body, scan);
    login.appendChild(pc);
  }

  setMode(true);   // default: the star-map wallpaper
  // U13b (2026-07-11): trigger moved from "click the star map" to "click
  // Combat View" (#pilotFeed, a different panel entirely now that the
  // radar has merged into it) — the star map itself no longer opens the
  // terminal on click, only the toggle button (✕ / STAR MAP) closes it.
  const pilotFeed = document.getElementById('pilotFeed');
  if (pilotFeed) {
    pilotFeed.style.cursor = 'pointer';
    pilotFeed.addEventListener('click', () => setMode(false));
  }
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
