import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateArenaQuantModel } from '../src/lib/validateArenaQuantModel.js';

const manifest = JSON.parse(readFileSync('public/arena-quant-model.json', 'utf8'));

describe('QF-01 model manifest', () => {
  it('accepts the published manifest', () => {
    expect(validateArenaQuantModel(manifest)).toEqual({ ok: true, errors: [] });
  });

  it('rejects duplicate assets and impossible constraints', () => {
    const invalid = structuredClone(manifest);
    invalid.universe[1].sym = invalid.universe[0].sym;
    invalid.settings.sectorCap = 0.1;
    const result = validateArenaQuantModel(invalid);
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/duplicated/);
    expect(result.errors.join(' ')).toMatch(/sectorCap/);
  });

  it('publishes the full requested AI infrastructure research pool', () => {
    const symbols = new Set(manifest.universe.map((asset) => asset.sym));
    for (const symbol of ['SKHY', 'SPCX', 'AAOI', 'COHR', 'MRVL', 'LITE', 'SNDK']) {
      expect(symbols.has(symbol), `${symbol} should be in QF-01`).toBe(true);
    }
  });

  it('uses current verified legal identities and instrument types for SKHY and SPCX', () => {
    const skhy = manifest.universe.find((asset) => asset.sym === 'SKHY');
    const spcx = manifest.universe.find((asset) => asset.sym === 'SPCX');
    expect(skhy).toMatchObject({
      name: 'SK hynix Inc. American Depositary Shares',
      identityStatus: 'verified',
    });
    expect(skhy.identitySource).toContain('nasdaqtrader.com');
    expect(spcx).toMatchObject({
      name: 'Space Exploration Technologies Corp. Class A Common Stock',
      securityType: 'NASDAQ and Nasdaq Texas-listed Class A common stock',
      identityStatus: 'verified-current',
    });
    expect(spcx.identityNote).toMatch(/prior SPCX ETF.*SPCK.*2026-06-12/i);
    expect(spcx.identitySource).toContain('sec.gov');
  });

  it('does not disclose owner repository paths in Arena public resources', () => {
    const arenaFiles = [
      'arena.html',
      ...readdirSync('public')
        .filter((name) => /^arena-.*\.json$/i.test(name))
        .map((name) => `public/${name}`),
    ];
    const published = arenaFiles.map((file) => readFileSync(file, 'utf8')).join('\n');
    expect(published).not.toMatch(/github\.com\/FeidaWang|FeidaWang\/gs-quant/i);
  });
});
