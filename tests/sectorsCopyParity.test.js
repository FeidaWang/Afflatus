import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderPage } from '../src/sectors/observatory/render.js';

const html = readFileSync('sectors.html', 'utf8');
const data = JSON.parse(readFileSync('src/sectors/observatory/data.json', 'utf8'));

describe('sectors generated copy parity', () => {
  it('publishes the complete replacement from its dated evidence snapshot', () => {
    // October's brief replaces the September page and its survey shell.
    // Protect the complete new content rather than requiring deleted legacy copy.
    const generated = html.split('<!-- observatory:start -->\n')[1]?.split('\n<!-- observatory:end -->')[0];
    expect(generated).toBe(renderPage(data));
    expect(html).not.toContain('id="researchArchive"');
    expect(html).not.toContain('id="rivalryHero"');
  });
  it('keeps en/zh paired on every element', () => {
    expect((html.match(/\sdata-en="/g) ?? []).length).toBe((html.match(/\sdata-zh="/g) ?? []).length);
  });
});
