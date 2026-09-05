import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync('portfolio.html', 'utf8');
const entry = readFileSync('src/main.js', 'utf8');
const experience = readFileSync('src/homeExperience.js', 'utf8');

describe('home loading contract', () => {
  it('keeps the LCP shell static and defers the combat runtime until visibility or intent', () => {
    expect(entry).toContain("import('./homeExperience.js')");
    expect(entry).toContain('installVisibilityLoaders');
    expect(entry).toContain("rootMargin: '240px 0px'");
    expect(entry).toContain("matchMedia('(max-width: 860px), (pointer: coarse)')");
    expect(entry).toContain('HOME_INTENT_SELECTOR');
    expect(entry).not.toMatch(/^import .*homeExperience/m);
    expect(html).toContain('<main id="mainContent">');
    expect(html).toContain('<h1 class="hero-title"');
  });

  it('loads Three.js forge work only near its stage', () => {
    expect(entry).toContain("import('./scene/alphardForge.js')");
    expect(entry).toContain("rootMargin: '80px 0px'");
    expect(html).not.toContain('src="/src/scene/alphardForge.js"');
  });

  it('uses the local static poster before the optional observatory iframe', () => {
    expect(html).toContain('class="blackhole-poster"');
    expect(html).toContain('href="/vendor/black-hole/source-poster.jpg" as="image" fetchpriority="high"');
    expect(html).toContain('data-src="/vendor/black-hole/background.html"');
    expect(html).not.toMatch(/\s(?:src)="\/vendor\/black-hole\/background\.html"/u);
    expect(entry).toContain('navigator.connection?.saveData');
    expect(entry).toContain('prefers-reduced-motion: reduce');
    expect(entry).toContain('function loadHomeExperience()');
    expect(entry).toContain('experienceObserver.observe(portfolio)');
  });

  it('splits market and voyage features from the combat experience', () => {
    expect(experience).toContain("import('./ui/marketDeck.js')");
    expect(experience).toContain("import('./ui/voyageLogConsole.js')");
    expect(experience).toContain("import { getLocale, setLocale } from './lib/localeStore.js'");
    expect(experience).not.toMatch(/^import .*marketDeck/m);
    expect(experience).not.toMatch(/^import .*voyageLogConsole/m);
  });

  it('renders all holdings before or without the dynamic experience', () => {
    const fallback = html.match(/<ol class="holdings-fallback"[\s\S]*?<\/ol>/u)?.[0] || '';
    expect(fallback.match(/<li>/g)).toHaveLength(10);
    expect(fallback).toContain('<strong>NVDA</strong>');
    expect(fallback).toContain('<strong>AMD</strong>');
    expect(html).toMatch(/<div class="pick-grid" id="pickGrid">\s*<ol class="holdings-fallback"/u);
  });

  it('keeps locale switch URLs available without loading combat', () => {
    expect(html).toMatch(/<a class="lang-mini-toggle" id="langMiniToggle" href="\/zh\/"/u);
    expect(html).toMatch(/<a[^>]*id="langBtn"[^>]*href="\/zh\/"/u);
    expect(html).toContain('<style id="home-language-visibility">');
    expect(html).toContain('@media(max-width:860px){#langBtn{display:none}#langMiniToggle{display:inline-flex}}');
    expect(entry.match(/HOME_INTENT_SELECTOR[\s\S]*?\.join\(','\)/u)?.[0] || '').not.toContain('#langBtn');
    expect(entry).toContain('localeSwitchHref(location, next)');
    expect(entry).toContain("link.addEventListener('click', () => { setLocale(next); })");
    expect(experience).not.toContain("querySelectorAll('#langBtn, #langMiniToggle')");
    expect(experience).not.toContain("event.preventDefault();\n  event.stopPropagation();\n  clearTimeout(langSetTimer)");
  });
});
