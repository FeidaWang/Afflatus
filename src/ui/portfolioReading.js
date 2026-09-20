import { initMediaComparisons } from './mediaCompare.js';
import { COPY } from '../data/content.js';
import { getLocale } from '../lib/localeStore.js';
import { mountTermGlossary } from '../lib/termGlossary.js';

// Reading enhancements have no dependency on combat or its render loop.
export function initPortfolioReading() {
  initMediaComparisons();
  const lang = getLocale('en');
  const c = COPY[lang];
  const STRIP_TERMS = [null, 'sharpe', 'drawdown', 'beta'];
  const termGlossaryCtl = mountTermGlossary({ getLang: () => lang });
  document.getElementById('heroNum').innerHTML=c.heroNum; document.getElementById('heroTitle').innerHTML=c.heroTitle; document.getElementById('heroDesc').textContent=c.heroDesc; document.getElementById('coord').textContent=c.coord; document.getElementById('scrollHint').textContent=c.scrollHint;
  c.sl.forEach((t,i)=>{
    const el=document.getElementById('sl'+i); if(!el) return;
    const term=STRIP_TERMS[i];
    el.innerHTML=term?`<button type="button" class="term" data-term="${term}">${t}</button>`:t;
  });
  termGlossaryCtl.close();
  c.sf.forEach((t,i)=>document.getElementById('sf'+i).textContent=t);
  document.getElementById('s2num').innerHTML=c.s2num; document.getElementById('s2title').innerHTML=c.s2title; document.getElementById('s2desc').textContent=c.s2desc;
  const chartSub=document.getElementById('chartSub'); if(chartSub) chartSub.textContent=c.chartSub;
  document.querySelectorAll('body [data-en][data-zh]').forEach(el=>{
    if(el.hasAttribute('data-i18n-html')) el.innerHTML=el.dataset[lang];
    else el.textContent=el.dataset[lang];
  });
  document.querySelectorAll('body [data-aria-en][data-aria-zh]').forEach(el=>{
    el.setAttribute('aria-label',el.dataset[lang==='zh'?'ariaZh':'ariaEn']);
  });
  document.getElementById('s3num').innerHTML=c.s3num; document.getElementById('s3title').innerHTML=c.s3title; document.getElementById('s3desc').textContent=c.s3desc; document.getElementById('footnoteEl').textContent=c.footnote;
  document.getElementById('f1').textContent=c.f1; document.getElementById('f2').textContent=c.f2; document.getElementById('f3').textContent=c.f3;

  let deckPromise;
  const load = () => {
    if (deckPromise) return deckPromise;
    deckPromise = import('./marketDeck.js').then(({ initMarketDeck }) => {
      const deck = initMarketDeck({ getLang: () => lang });
      deck.updatePeriodUI();
      deck.renderPicks(c.picks);
    });
    return deckPromise;
  };
  const targets = ['fy2026Performance', 'portfolioConvoy'].map(id => document.getElementById(id)).filter(Boolean);
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      void load().catch(() => {});
    }, { rootMargin: '640px 0px' });
    targets.forEach(target => observer.observe(target));
  } else if (targets.length) void load().catch(() => {});
}
