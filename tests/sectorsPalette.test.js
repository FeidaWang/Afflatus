// tests/sectorsPalette.test.js
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('public/styles/sectors-v2.css', 'utf8');
const token = (name) => css.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`))?.[1];
const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

describe('sectors v2 palette', () => {
  it('uses the flag colours', () => {
    expect(token('us')).toBe('#0A3161');
    expect(token('cn')).toBe('#EE1C25');
  });
  it('keeps text tokens at AA on paper and stage', () => {
    for (const t of ['ink', 'text', 'muted', 'us', 'cn-ink']) {
      expect(contrast(token(t), token('paper')), t).toBeGreaterThanOrEqual(4.5);
    }
    for (const t of ['ink', 'text', 'muted', 'us', 'cn-ink']) {
      expect(contrast(token(t), token('stage')), t).toBeGreaterThanOrEqual(4.5);
    }
  });
  it('keeps graphic tokens at 3:1', () => {
    expect(contrast(token('cn'), token('paper'))).toBeGreaterThanOrEqual(3);
    expect(contrast(token('cn'), token('stage'))).toBeGreaterThanOrEqual(3);
  });
});
