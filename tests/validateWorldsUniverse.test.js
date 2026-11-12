import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateWorldsUniverse, validateWorldsUniverseManifest } from '../src/lib/validateWorldsUniverse.js';

const content = () => JSON.parse(readFileSync('public/worlds-universe/content.json', 'utf8'));
const manifest = () => JSON.parse(readFileSync('public/worlds-universe/assets-manifest.json', 'utf8'));

describe('Universe publication boundaries', () => {
  it('rejects an incomplete locale that would leave a detail view untranslated', () => {
    const data = content();
    expect(validateWorldsUniverse(data)).toEqual({ ok: true, errors: [] });
    delete data.champions[0].detail.zh;
    const checked = validateWorldsUniverse(data);
    expect(checked.ok).toBe(false);
    expect(checked.errors.join('\n')).toContain('champions[0].detail.zh');
  });

  it('rejects hotlinked art and escaped inventory paths instead of publishing unsafe assets', () => {
    const data = content();
    data.regions[0].image = data.regions[0].sourceImageUrl;
    expect(validateWorldsUniverse(data).errors.join('\n')).toContain('regions[0].image: must be a local');
    const inventory = manifest();
    expect(validateWorldsUniverseManifest(inventory)).toEqual({ ok: true, errors: [] });
    inventory.assets[0].path = 'assets/champions/%2e%2e/%2e%2e/index.html';
    inventory.assets[0].source_url = 'https://universe.leagueoflegends.com.attacker.example/art.webp';
    const checked = validateWorldsUniverseManifest(inventory);
    expect(checked.ok).toBe(false);
    expect(checked.errors.join('\n')).toContain('assets[0].path');
    expect(checked.errors.join('\n')).toContain('assets[0].source_url');
  });

  it('rejects broken region references and champions assigned to the wrong regional collection', () => {
    const data = content();
    data.champions[0].region = 'missing-region';
    data.regions[0].relatedChampions.push(data.champions.find((champion) => champion.region !== data.regions[0].id && champion.region !== 'missing-region').id);
    const checked = validateWorldsUniverse(data);
    expect(checked.ok).toBe(false);
    expect(checked.errors.join('\n')).toContain('champions[0].region: unknown region');
    expect(checked.errors.join('\n')).toMatch(/regions\[0\]\.relatedChampions: .* does not belong/);
  });
});
