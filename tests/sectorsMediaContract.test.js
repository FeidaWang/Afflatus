import { existsSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MEDIA_MANIFEST } from '../src/sectors/brandAssets.js';

const expectedVendors = [
  'NVDA', 'AVGO', 'MU', 'SKHY', 'TSM', 'ASML', 'SSNLF', 'PSTG', 'SNDK',
  'RMBS', 'ALAB', 'MRVL', 'TER', 'anthropic', 'openai', 'zhipu', 'alibaba',
  'google', 'xai', 'meta', 'cohere', 'deepseek', 'moonshot', 'minimax',
];

describe('sectors media contract', () => {
  it('gives every vendor an intentional photo or editorial poster', () => {
    expectedVendors.forEach((vendor) => {
      expect(MEDIA_MANIFEST[vendor], vendor).toBeTruthy();
      expect(['photo', 'poster']).toContain(MEDIA_MANIFEST[vendor].kind);
      expect(MEDIA_MANIFEST[vendor].alt.length).toBeGreaterThan(8);
    });
  });

  it('only references local photo assets that exist', () => {
    Object.values(MEDIA_MANIFEST)
      .filter((media) => media.kind === 'photo')
      .forEach((media) => {
        expect(media.src.startsWith('/assets/sectors/media/')).toBe(true);
        expect(existsSync(`public${media.src}`), media.src).toBe(true);
      });
  });

  it('keeps the full card-photo payload under the audit budget', () => {
    const totalBytes = Object.values(MEDIA_MANIFEST)
      .filter((media) => media.kind === 'photo')
      .reduce((sum, media) => sum + statSync(`public${media.src}`).size, 0);
    expect(totalBytes).toBeLessThan(1.2 * 1024 * 1024);
  });

  it('reserves the mobile header and model-war hero and defers the graph visualizer', () => {
    const css = readFileSync('public/styles/sectors.css', 'utf8');
    const entry = readFileSync('src/pages/sectors.js', 'utf8');
    expect(css).toContain('@media(min-width:371px) and (max-width:440px){.top{height:137px}}');
    expect(css).toContain('.rivalryHero{');
    expect(css).toContain('@media(max-width:560px)');
    expect(entry).toContain("import('../sectors/graphController.js')");
    expect(entry).toContain("import { initSectorsRivalryController } from '../sectors/rivalryController.js'");
    expect(entry).not.toMatch(/^import .*graphController/m);
  });

  it('keeps the Sectors command bar full-width and the graph below it', () => {
    const css = readFileSync('public/styles/sectors.css', 'utf8');
    expect(css).toContain('.sectors-page .top.site-header--follow{');
    expect(css).toContain('width:100vw;');
    expect(css).toContain('top:var(--sectors-header-h,89px);');
    expect(css).toMatch(/\.mwDetail\{\s*position:fixed;/);
  });

  it('removes the letter audit and source-ledger sections while preserving an updateable post-memory register', () => {
    const html = readFileSync('sectors.html', 'utf8');
    const controller = readFileSync('src/sectors/rivalryController.js', 'utf8');
    const rivalry = JSON.parse(readFileSync('public/sectors-rivalry.json', 'utf8'));
    expect(html).not.toContain('OPEN-WEIGHTS LETTER AUDIT');
    expect(html).not.toContain('rivalryLetter');
    expect(html).not.toContain('Source ledger &amp; methodology');
    expect(html).not.toContain('rivalrySources');
    expect(controller).not.toContain('renderLetter');
    expect(controller).not.toContain('renderSources');
    expect(rivalry).not.toHaveProperty('openWeightsLetter');
    expect(rivalry).not.toHaveProperty('sources');
    expect(html).toContain('05 / POST-MEMORY ERA');
    expect(html).toContain('class="postMemoryFrame"');
  });

  it('publishes the DeepSeek brief and explicit 5.6 Sol Ultra N/A disclosure without personal GitHub provenance', () => {
    const html = readFileSync('sectors.html', 'utf8');
    const dataset = readFileSync('public/sectors-rivalry.json', 'utf8');
    expect(html).toContain('id="rivalryDeepSeek"');
    expect(html).toContain('5.6 Sol Ultra');
    expect(html).toContain('benchmark and ranking fields set to N/A');
    expect(`${html}\n${dataset}`).not.toContain('github.com/FeidaWang');
  });
});
