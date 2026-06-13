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

  // Build the login "desktop" chrome once, as clean non-overlapping rows:
  //   [ title bar | STAR MAP ] / [ mothership hologram | credential fields ] /
  //   [ LOGIN ] / [ footer ]. The old top status row + toggle are hidden via
  //   CSS; the star map is a full-panel wallpaper you click to enter here.
  if (login && !login.querySelector('.term-body')) {
    const make = (tag, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };

    const head = make('div', 'term-head');
    const title = make('span', 'term-title');
    title.textContent = '▸ AFFLATUS OS · SECURE SHELL';
    const back = make('button', 'term-back');
    back.type = 'button';
    back.textContent = getLang() === 'zh' ? '◂ 星图' : '◂ STAR MAP';
    back.addEventListener('click', e => { e.stopPropagation(); setMode(true); });
    head.append(title, back);

    // mothership hologram (left of the body row)
    const body = make('div', 'term-body');
    const holo = make('div', 'term-hologram');
    const holoCanvas = make('canvas', 'term-holo-canvas');
    holoCanvasRef = holoCanvas;          // hologram is created lazily on first login-open
    holo.appendChild(holoCanvas);
    const holoLabel = make('div', 'term-holo-label');
    holoLabel.textContent = 'ENFORCER · MOTHERSHIP';
    holo.appendChild(holoLabel);

    const fields = make('div', 'term-fields');
    login.querySelectorAll('label').forEach(l => fields.appendChild(l));
    body.append(holo, fields);

    const loginBtn = login.querySelector('#terminalLoginBtn');
    const foot = make('div', 'term-foot');
    foot.textContent = '● ACCESS RESTRICTED · CREDENTIALS REQUIRED · 私人航行日志';
    const scan = make('div', 'term-scan');

    login.append(head, body);
    if (loginBtn) login.appendChild(loginBtn);   // direct grid item → grid-area: login
    login.append(foot, scan);
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
