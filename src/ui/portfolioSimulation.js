import './portfolioSimulation.css';
import { getLocale } from '../lib/localeStore.js';
import { getRenderBudgetCoordinator } from '../lib/renderBudgetCoordinator.js';

// Only a frame created by the explicit entry can bootstrap the game. A copied
// query URL in a normal tab remains a reading page.
export function isSimulationFrame() {
  return window.parent !== window && window.frameElement?.id === 'simulationFrame';
}

export function installSimulationEntry(loadExperience) {
  const zh = getLocale('en') === 'zh';
  if (isSimulationFrame()) {
    document.documentElement.dataset.simulationFrame = 'true';
    // Legacy nav has !important display rules. A hidden wrapper keeps its
    // runtime button references available without exposing a second navigation.
    const chrome = document.querySelector('body > nav.site-header--follow');
    if (chrome) {
      const holder = document.createElement('div');
      holder.hidden = true;
      chrome.before(holder);
      holder.append(chrome);
    }
    const send = type => parent.postMessage({ type: `afflatus:simulation:${type}` }, location.origin);
    let disposed = false;
    window.addEventListener('afflatus:simulation-dispose', () => { disposed = true; }, { once: true });
    void loadExperience().then(module => {
      if (disposed) { module.disposeSimulation(); return; }
      document.getElementById('commandModeBtn')?.click();
      document.body.tabIndex = -1;
      document.body.focus({ preventScroll: true });
      window.addEventListener('afflatus:command-mode', () => {
        if (document.body.classList.contains('hud-off')) send('exit');
      });
      send('ready');
    }).catch(() => send('failed'));
    return;
  }

  let active = false;
  const open = event => {
    event.preventDefault();
    if (active) return;
    active = true;
    const trigger = event.currentTarget;
    const y = scrollY;
    const overflow = document.documentElement.style.overflow;
    const dialog = document.createElement('dialog');
    dialog.id = 'simulationDialog';
    dialog.setAttribute('aria-labelledby', 'simulationTitle');
    const bar = document.createElement('header');
    const title = document.createElement('h2');
    title.id = 'simulationTitle';
    title.textContent = zh ? '可选模拟' : 'Optional simulation';
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = zh ? '退出模拟 · 返回阅读' : 'Exit simulation · return to reading';
    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    status.textContent = zh ? '模拟正在加载…' : 'Loading simulation…';
    const frame = document.createElement('iframe');
    frame.id = 'simulationFrame';
    frame.title = zh ? '交互模拟' : 'Interactive simulation';
    const url = new URL(location.href);
    url.hash = '';
    // The standalone development harness must not start a second renderer.
    url.searchParams.delete('combat');
    url.searchParams.set('simulation', '1');
    frame.src = url.href;
    bar.append(title, close);
    dialog.append(bar, status, frame);
    const abort = new AbortController();
    let timer;
    const finish = () => {
      if (!active) return;
      active = false;
      clearTimeout(timer);
      abort.abort();
      // Explicit GPU teardown first, then discard the entire browsing context:
      // its timers, pending imports, document listeners and module state die here.
      try { frame.contentWindow?.dispatchEvent(new Event('afflatus:simulation-dispose')); } catch {}
      frame.remove();
      dialog.close();
      dialog.remove();
      document.documentElement.style.overflow = overflow;
      document.documentElement.dataset.simulation = 'closed';
      getRenderBudgetCoordinator().setSuspended(false);
      trigger.setAttribute('aria-pressed', 'false');
      window.scrollTo({ top: y, behavior: 'instant' });
      trigger.focus({ preventScroll: true });
    };
    close.addEventListener('click', finish);
    dialog.addEventListener('cancel', event => { event.preventDefault(); finish(); });
    const fail = () => {
      status.textContent = zh ? '模拟暂不可用，请返回阅读后重试。' : 'Simulation unavailable. Return to reading and try again.';
      dialog.dataset.state = 'failed';
      close.focus({ preventScroll: true });
    };
    window.addEventListener('message', event => {
      if (event.origin !== location.origin || event.source !== frame.contentWindow) return;
      if (event.data?.type === 'afflatus:simulation:exit') finish();
      if (event.data?.type === 'afflatus:simulation:failed') { clearTimeout(timer); fail(); }
      if (event.data?.type === 'afflatus:simulation:ready') {
        clearTimeout(timer);
        dialog.dataset.state = 'ready';
        status.hidden = true;
      }
    }, { signal: abort.signal });
    window.addEventListener('pagehide', finish, { once: true, signal: abort.signal });
    document.body.append(dialog);
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.dataset.simulation = 'open';
    getRenderBudgetCoordinator().setSuspended(true);
    trigger.setAttribute('aria-pressed', 'true');
    dialog.showModal();
    close.focus();
    timer = setTimeout(fail, 20000);
  };
  document.querySelectorAll('#commandModeBtn, #heroCommandCta').forEach(button => button.addEventListener('click', open));
}
