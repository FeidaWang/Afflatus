import { INSTRUMENTS } from '../../lib/vibeMarketContract.js';
import { mountQuant } from './quant.js';

/** Public assumption-only UI; no history/provider requests on mount. */
export function mountAssumptionModels(root, {locale='en'}={}) {
  const zh=locale==='zh';
  root.classList.add('vibe-markets');
  const heading=document.createElement('h2');heading.textContent=zh?'假设模型':'Assumption models';
  const label=document.createElement('label');label.textContent=zh?'标的':'Instrument';
  const select=document.createElement('select');select.setAttribute('aria-label',label.textContent);
  for(const [id,item] of INSTRUMENTS) {
    const option=document.createElement('option');option.value=id;
    option.textContent=id.startsWith('CRYPTO:') ? id : (item.symbol || id);select.append(option);
  }
  label.append(select);
  const controls=document.createElement('div');controls.className='vibe-markets__controls';controls.append(label);
  const calculations=document.createElement('div');
  root.replaceChildren(heading,controls,calculations);
  let dispose;
  const mount=()=>{dispose?.();dispose=mountQuant(calculations,select.value,{locale,modelsOnly:true});};
  select.addEventListener('change',mount);mount();
  return ()=>{dispose?.();select.removeEventListener('change',mount);root.replaceChildren();};
}
