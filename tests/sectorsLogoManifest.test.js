// tests/sectorsLogoManifest.test.js  (part 1)
import { describe, expect, it } from 'vitest';
import { dominantSvgColor } from '../scripts/lib/svg-color.mjs';

describe('dominantSvgColor', () => {
  it('picks the most frequent non-neutral fill', () => {
    expect(dominantSvgColor('<svg><path fill="#76b900"/><path fill="#76B900"/><path fill="#000"/><path fill="#ff0000"/></svg>')).toBe('#76B900');
  });
  it('expands short hex and ignores black/white', () => {
    expect(dominantSvgColor('<svg style="fill:#f60"><path fill="#fff"/></svg>')).toBe('#FF6600');
  });
  it('returns null for monochrome logos', () => {
    expect(dominantSvgColor('<svg><path fill="#000000"/></svg>')).toBeNull();
  });
});

// tests/sectorsLogoManifest.test.js  (part 2)
import { existsSync, readFileSync } from 'node:fs';
const manifest = JSON.parse(readFileSync('public/assets/sectors/logos/manifest.json', 'utf8'));
const industry = JSON.parse(readFileSync('public/data/sectors-industry/2026-09-27.json', 'utf8'));

describe('logo manifest', () => {
  it.each(industry.companies.map((c) => [c.id, c]))('%s has an official, recorded logo', (id, c) => {
    const row = manifest[id];
    expect(row?.status, id).toBe('ok');
    expect(existsSync(`public${row.file}`)).toBe(true);
    const host = new URL(row.source_page).hostname;
    expect(host === c.official_domain || host.endsWith(`.${c.official_domain}`)).toBe(true);
    expect(row.brand_color).toMatch(/^#[0-9A-F]{6}$/i);
    expect(row.sha256).toMatch(/^[0-9a-f]{64}$/);
  });
});

// tests/sectorsLogoManifest.test.js  (part 3) — cropped web copies, portfolio-style tight viewBox
describe('logo web crops', () => {
  it.each(Object.entries(manifest).filter(([, r]) => r.status === 'ok'))('%s has a cropped web asset', (id, row) => {
    expect(row.web_file).toMatch(new RegExp(`^/assets/sectors/logos/web/${id}\\.(svg|png)$`));
    expect(existsSync(`public${row.web_file}`)).toBe(true);
    expect(['wide', 'mark']).toContain(row.web_shape);
    expect(row.web_shape === 'mark').toBe(row.web_aspect < 1.6);
  });
  it('cropped SVGs carry an explicit viewBox and size', () => {
    for (const row of Object.values(manifest).filter((r) => r.web_file?.endsWith('.svg'))) {
      const head = readFileSync(`public${row.web_file}`, 'utf8').match(/<svg\b[^>]*>/)[0];
      expect(head).toMatch(/viewBox="[-\d. ]+" width="[\d.]+" height="[\d.]+"/);
    }
  });
});
