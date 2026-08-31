import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SITE_MANIFEST } from '../src/config/siteManifest.js';

const adaptiveRoutes = SITE_MANIFEST.filter((route) => (
  route.build && route.status !== 'prototype' && !['main', 'serial'].includes(route.id)
));
const i18nSource = readFileSync('src/lib/i18n.js', 'utf8');

function prepaintSource(file) {
  const html = readFileSync(file, 'utf8');
  return html.match(/<script>([^<]*afflatus:locale:v1[^<]*)<\/script>/i)?.[1] || '';
}

describe('adaptive locale pre-paint', () => {
  it('uses one parsing-time translator across every adaptive route', () => {
    const sources = adaptiveRoutes.map((route) => prepaintSource(route.file));
    expect(sources.every(Boolean)).toBe(true);
    expect(new Set(sources)).toHaveLength(1);

    const source = sources[0];
    expect(source).toContain("if(v==='zh')");
    expect(source).toContain("document.documentElement.lang.toLowerCase().indexOf('zh')===0?'zh':'en'");
    expect(source).toContain('if(!v)v=f');
    expect(source).toContain('new MutationObserver');
    expect(source).toContain("'[data-en],[data-en-ph],[data-aria-en],.lang-toggle'");
    expect(source).toContain('p(x,false)');
    expect(source).toContain('p(document,true)');
    expect(source).toContain("e.textContent='EN'");
    expect(source).toContain("d.style.visibility='hidden'");
    expect(source).toContain('setTimeout(u,1500)');
    expect(source).toContain('finally{clearTimeout(t);o.disconnect();u()}');
  });

  it('preserves each route default when no locale preference exists', () => {
    expect(readFileSync('stats.html', 'utf8')).toContain('<html lang="zh-CN">');
    expect(i18nSource).toContain("document.documentElement.lang.toLowerCase().startsWith('zh') ? 'zh' : 'en'");
    expect(i18nSource).toContain('getLocale(routeLocale)');
  });
});
