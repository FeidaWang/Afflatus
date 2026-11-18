/** Render the calendar without downloading the results workbench. */
import '../lib/i18n.js';
import '../lib/nav.js';
import { eventById } from '../lib/electionRules.js';
import { getLocale } from '../lib/localeStore.js';
import { renderElectionHub } from './electionsHub.js';

const paintHub = () => renderElectionHub(new Date(), window.AfflatusI18N?.get() ?? getLocale('en'));
const event = eventById(new URLSearchParams(window.location.search).get('event'));

if (event) {
  import('./elections.js').catch(paintHub);
} else {
  if (window.location.search) {
    window.history.replaceState(null, '', window.location.pathname + window.location.hash);
  }
  paintHub();
  const hubListeners = new AbortController();
  const options = { signal: hubListeners.signal };
  let navigation = 0;
  window.addEventListener('afflatus-lang', paintHub, options);
  document.getElementById('el-view').addEventListener('click', async (click) => {
    const link = click.target.closest?.('a[data-nav]');
    if (!link || click.defaultPrevented || click.button !== 0 ||
        click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) return;
    click.preventDefault();
    const request = ++navigation;
    const workbench = await import('./elections.js').catch(() => null);
    if (request !== navigation) return;
    if (!workbench) {
      window.location.assign(link.href);
      return;
    }
    hubListeners.abort();
    workbench.openElectionWorkbench(new URL(link.href).search);
  }, options);
}
