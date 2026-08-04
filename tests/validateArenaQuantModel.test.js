import { readFileSync } from 'node:fs';
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
});
