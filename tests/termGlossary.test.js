import { describe, it, expect } from 'vitest';
import { TERMS } from '../src/lib/termGlossary.js';

describe('TERMS glossary registry', () => {
  const keys = Object.keys(TERMS);

  it('has no duplicate keys', () => {
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('every entry has non-empty en and zh explanations', () => {
    for (const key of keys) {
      const entry = TERMS[key];
      expect(entry.en, `${key}.en`).toBeTruthy();
      expect(entry.zh, `${key}.zh`).toBeTruthy();
      expect(entry.en.trim().length).toBeGreaterThan(0);
      expect(entry.zh.trim().length).toBeGreaterThan(0);
    }
  });

  it('explanations are plain text, no markup', () => {
    for (const key of keys) {
      expect(TERMS[key].en).not.toMatch(/[<>]/);
      expect(TERMS[key].zh).not.toMatch(/[<>]/);
    }
  });

  it('covers the U46 first-wave terms (signal/stats/homepage)', () => {
    for (const key of ['keter', 'sep', 'brier', 'bootstrap', 'sharpe', 'drawdown', 'beta']) {
      expect(keys, key).toContain(key);
    }
  });
});
