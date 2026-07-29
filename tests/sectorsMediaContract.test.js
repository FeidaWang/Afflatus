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

  it('reserves the mobile header and hero and defers below-fold visualizers', () => {
    const css = readFileSync('public/styles/sectors.css', 'utf8');
    const entry = readFileSync('src/pages/sectors.js', 'utf8');
    expect(css).toContain('@media(min-width:371px) and (max-width:440px){.top{height:137px}}');
    expect(css).toContain('@media(min-width:371px) and (max-width:440px){.heroCard{min-height:600px}}');
    expect(entry).toContain("import('../sectors/graphController.js')");
    expect(entry).toContain("import('../sectors/competitionController.js')");
    expect(entry).not.toMatch(/^import .*graphController/m);
    expect(entry).not.toMatch(/^import .*competitionController/m);
  });
});
