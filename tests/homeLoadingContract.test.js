import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync('index.html', 'utf8');
const entry = readFileSync('src/main.js', 'utf8');
const experience = readFileSync('src/homeExperience.js', 'utf8');

describe('home loading contract', () => {
  it('keeps the LCP shell static and defers the combat runtime until idle or intent', () => {
    expect(entry).toContain("import('./homeExperience.js')");
    expect(entry).toContain('requestIdleCallback');
    expect(entry).toContain('HOME_INTENT_SELECTOR');
    expect(entry).not.toMatch(/^import .*homeExperience/m);
    expect(html).toContain('<main id="mainContent">');
    expect(html).toContain('<h1 class="hero-title"');
  });

  it('loads Three.js forge work only near its stage', () => {
    expect(entry).toContain("import('./scene/alphardForge.js')");
    expect(entry).toContain("rootMargin: '240px 0px'");
    expect(html).not.toContain('src="/src/scene/alphardForge.js"');
  });

  it('uses the local static poster before the optional observatory iframe', () => {
    expect(html).toContain('class="blackhole-poster"');
    expect(html).toContain('data-src="/vendor/black-hole/background.html"');
    expect(html).not.toMatch(/\s(?:src)="\/vendor\/black-hole\/background\.html"/u);
    expect(entry).toContain('navigator.connection?.saveData');
    expect(entry).toContain('prefers-reduced-motion: reduce');
  });

  it('splits market and voyage features from the combat experience', () => {
    expect(experience).toContain("import('./ui/marketDeck.js')");
    expect(experience).toContain("import('./ui/voyageLogConsole.js')");
    expect(experience).not.toMatch(/^import .*marketDeck/m);
    expect(experience).not.toMatch(/^import .*voyageLogConsole/m);
  });

  it('retains a meaningful no-JavaScript holdings path', () => {
    const fallback = html.match(/<noscript>[\s\S]*?<ol class="no-js-holdings"[\s\S]*?<\/ol>[\s\S]*?<\/noscript>/u)?.[0] || '';
    expect(fallback.match(/<li>/g)).toHaveLength(10);
    expect(fallback).toContain('<strong>NVDA</strong>');
    expect(fallback).toContain('<strong>AMD</strong>');
  });
});
