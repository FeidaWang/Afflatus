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

  it('keeps a stable mobile header and defers the graph visualizer', () => {
    const css = readFileSync('public/styles/sectors.css', 'utf8');
    const entry = readFileSync('src/pages/sectors.js', 'utf8');
    expect(css).toContain('.sectors-page .top.site-header--follow{');
    expect(css).not.toContain('.top{height:137px}');
    expect(css).toContain('.rivalryHero{');
    expect(css).toContain('@media(max-width:560px)');
    expect(entry).toContain("import('../sectors/graphController.js')");
    expect(entry).toContain("import { initSectorsRivalryController } from '../sectors/rivalryController.js'");
    expect(entry).not.toMatch(/^import .*graphController/m);
  });

  it('puts the relationship index inside the graph stage and gives critical logos a white plate', () => {
    const html = readFileSync('sectors.html', 'utf8');
    const ecosystem = JSON.parse(readFileSync('public/sectors-ecosystem.json', 'utf8'));
    const graphWrapStart = html.indexOf('<div class="graphWrap">');
    const graphStepsStart = html.indexOf('<div class="graphStorySteps">');
    const graphWrap = html.slice(graphWrapStart, graphStepsStart);
    expect(graphWrapStart).toBeGreaterThan(-1);
    expect(graphStepsStart).toBeGreaterThan(graphWrapStart);
    expect(graphWrap).toContain('class="graphInspector"');
    expect(graphWrap).toContain('id="mwGraphSummary"');
    expect(graphWrap).toContain('id="mwGraphNodes"');
    ['apple', 'meta', 'huawei', 'zhipu', 'openai'].forEach((id) => {
      const node = ecosystem.nodes.find((candidate) => candidate.id === id);
      expect(node?.logo_bg, id).toBe('#ffffff');
      expect(existsSync(`public${node?.logo}`), node?.logo).toBe(true);
    });
  });

  it('keeps the two open-ecosystem logo boards distinct and high resolution', () => {
    const rivalry = JSON.parse(readFileSync('public/sectors-rivalry.json', 'utf8'));
    const ecosystem = JSON.parse(readFileSync('public/sectors-ecosystem.json', 'utf8'));
    expect(rivalry.openSecureAlliance.names).toHaveLength(52);
    expect(rivalry.openWeightsLetter.officialNames).toHaveLength(77);
    expect(rivalry.openSecureAlliance.image).toBe('/assets/sectors/logos/open-secure-ai-alliance.png');
    expect(rivalry.openWeightsLetter.image).toBe('/assets/sectors/logos/open-weights-signatories.png');
    expect(statSync(`public${rivalry.openSecureAlliance.image}`).size).toBeGreaterThan(400_000);
    expect(statSync(`public${rivalry.openWeightsLetter.image}`).size).toBeGreaterThan(400_000);
    expect(ecosystem.nodes.find((node) => node.id === 'openweights')?.logo)
      .toBe(rivalry.openWeightsLetter.image);
  });

  it('removes the visible source-ledger module from the sectors route', () => {
    const html = readFileSync('sectors.html', 'utf8');
    const controller = readFileSync('src/sectors/rivalryController.js', 'utf8');
    expect(html).not.toContain('Source ledger &amp; methodology');
    expect(html).not.toContain('来源账本与方法');
    expect(html).not.toContain('id="rivalrySources"');
    expect(controller).not.toContain('renderSources(');
  });
});
