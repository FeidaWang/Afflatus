"""Optional in-memory Chromium DOM check with synthetic data, NOT a host/Vite build.

Run: python tests/browser_smoke.py
Requires: playwright Python package and a local Chromium executable.
No browser network requests are made. Source imports/exports are removed only
in this test harness; original function bodies and stylesheet are preserved.
The host build pipeline and ES-module resolution are NOT tested here.
"""
from __future__ import annotations
import json
import os
from pathlib import Path
import shutil
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
UI=ROOT/'overlay/src/features/vibe-markets'
registry={x['id']:x for x in json.loads((ROOT/'overlay/services/vibe-bridge/bridge/instruments.json').read_text())}

def main():
    executable=os.getenv('CHROMIUM_EXECUTABLE') or shutil.which('chromium') or shutil.which('google-chrome')
    if not executable:raise RuntimeError('No Chromium executable; set CHROMIUM_EXECUTABLE')
    checks=[];errors=[];out=ROOT/'validation';out.mkdir(exist_ok=True)
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=executable,headless=True,args=['--no-sandbox'])
        page=browser.new_page(viewport={'width':1280,'height':1000})
        page.set_default_timeout(4000)
        page.on('pageerror',lambda e:errors.append(str(e)))
        css=(UI/'styles.css').read_text()
        page.set_content('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Isolated smoke test</title><style>body{font-family:system-ui,sans-serif;margin:24px;line-height:1.5}main{max-width:1000px;margin:auto}.test-note{font-size:14px}*{box-sizing:border-box}'+css+'</style><main><p class="test-note">ISOLATED TEST · SYNTHETIC DATA · NOT LIVE MARKET INFORMATION</p><section id="root"></section></main></html>')
        fake_fetch = """
window.smokeFail=false;window.smokeRequests=[];
const registry = REGISTRY;
window.fetch = async function(url, options) {
  if(options?.signal?.aborted)throw new DOMException('Aborted','AbortError');
  const params=new URL(url,'https://fixture.invalid').searchParams;
  window.smokeRequests.push(Object.fromEntries(params));
  if(window.smokeFail)return Response.json({error:{code:'PRIVATE_RESEARCH_ONLY'}},{status:403});
  const item=registry[params.get('instrument')],end=Date.parse(params.get('end'));
  const bars=Array.from({length:30},(_,i)=>{const c=100+i/2+Math.sin(i/2)*3;return {date:new Date(end-(30-i)*86400000).toISOString().slice(0,10),open:c-.2,high:c+1,low:c-1,close:c,volume:1000+i};});
  return Response.json({schema_version:1,instrument:item,bars,provenance:{source:item.source,last_bar_date:bars.at(-1).date,observed_at:'2026-01-01T00:00:00Z'}});
};
""".replace('REGISTRY',json.dumps(registry))
        source=(UI/'client.js').read_text().replace('export async function','async function')+'\n'+(UI/'index.js').read_text().replace("import { getDailyBars } from './client.js';",'').replace("import './styles.css';",'').replace('export function','function')
        page.add_script_tag(content=fake_fetch+'\n'+source+"\nwindow.mount=mountVibeMarkets;window.dispose=mountVibeMarkets(document.querySelector('#root'));")
        page.locator('.vibe-markets__chart svg').wait_for()
        assert page.get_by_role('status').inner_text()=='Daily bars · not a live quote';checks.append('English US daily chart and non-live label')
        assert 'USD' in page.locator('.vibe-markets__value').inner_text();checks.append('US quote currency')
        page.get_by_label('Market',exact=True).select_option('crypto')
        page.wait_for_function("document.querySelector('.vibe-markets__value').textContent.includes('USDT')")
        assert 'okx' in page.locator('.vibe-markets__muted').nth(1).inner_text();checks.append('Crypto switch, OKX source and USDT identity')
        page.get_by_label('History',exact=True).select_option('365')
        page.wait_for_function("document.querySelector('.vibe-markets__chart svg') !== null")
        page.get_by_text('Inspect daily bars',exact=True).click()
        assert page.locator('tbody tr').count()==30;checks.append('30 inspectable data rows')
        page.screenshot(path=str(out/'browser-desktop.png'),full_page=True)
        page.set_viewport_size({'width':390,'height':844})
        page.evaluate("() => { window.dispose();window.dispose=window.mount(document.querySelector('#root'),{locale:'zh'}); }")
        page.locator('.vibe-markets__chart svg').wait_for()
        assert page.get_by_role('status').inner_text()=='日线数据 · 非实时价格';checks.append('Chinese mobile rendering')
        assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth');checks.append('390px mobile no page overflow')
        page.screenshot(path=str(out/'browser-mobile.png'),full_page=True)
        page.keyboard.press('Tab');assert page.evaluate("document.activeElement.tagName==='SELECT'");checks.append('Keyboard-focusable control')
        page.evaluate('window.smokeFail=true')
        page.get_by_label('历史区间',exact=True).select_option('180')
        page.wait_for_function("document.querySelector('[role=status]').textContent.includes('PRIVATE_RESEARCH_ONLY')")
        assert page.locator('.vibe-markets__chart svg').count()==0;checks.append('403 has explicit unavailable state and no fake chart')
        page.evaluate('window.dispose()');assert page.locator('#root').inner_html()=='';checks.append('Cleanup unmount')
        assert not errors;checks.append('No browser JavaScript errors')
        browser.close()
    report={'harness':'in-memory Chromium DOM, module imports/exports removed in harness; not Vite or Afflatus build; no networking','data':'synthetic fixtures only','checks':checks,'passed':len(checks),'page_errors':errors}
    (out/'browser-tests.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print(json.dumps(report,ensure_ascii=False,indent=2))

if __name__=='__main__':main()
