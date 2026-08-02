import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PICKS_EN, PICKS_ZH } from '../src/data/content.js';

const html = readFileSync('index.html', 'utf8');
const copy = readFileSync('src/data/content.js', 'utf8');
const brandCss = readFileSync('public/styles/afflatus-brand.css', 'utf8');

describe('FY2025–26 homepage performance dossier', () => {
  it('keeps realized facts separate from modeled portfolio statistics', () => {
    expect(html).toContain('CLOSED PROFITABLE SUBSET');
    expect(html).toContain('+2.78%');
    expect(html).toContain('Weighted capital days');
    expect(html).toContain('Profitable flight paths');
    expect(html).toContain('ANNUALIZED / 02');
    expect(html).toContain('+261.2%');
    expect(html).toContain('MODEL / 03');
    expect(html).toContain('37.5–41.4%');
    expect(html).toContain('method-dependent estimates');
  });

  it('keeps principal, transaction values and account balances private', () => {
    expect(html).not.toMatch(/\$[0-9]/);
    expect(html).not.toMatch(/\b(?:AUD|USD)\b/);
    expect(copy).not.toMatch(/\$[0-9]/);
    expect(copy).not.toMatch(/\b(?:AUD|USD)\b/);
    expect(html).toContain('transaction values and account balances are not published');
  });

  it('publishes all five supplied profitable trade cycles', () => {
    for (const ticker of ['AVGO', 'DRAM', 'SNDK', 'NVO', 'XLE']) {
      expect(html).toContain(`<span>${ticker}</span>`);
    }
    for (const annualized of ['+260.4%', '+208.5%', '+257.9%', '+32.6%', '+85.6%']) {
      expect(html).toContain(annualized);
    }
  });

  it('removes the incompatible synthetic equity curve and legacy headline metrics', () => {
    expect(html).not.toContain('id="kchart"');
    expect(html).not.toContain('data-counter="38.66"');
    expect(copy).not.toContain("sf:['vs SPX +9.4");
  });

  it('publishes the August 2026 AI-factory conviction map', () => {
    expect(copy).toContain('Research snapshot · 2026-08-02');
    for (const ticker of ['NVDA', 'AVGO', 'MSFT', 'TSM', 'AMZN', 'GOOGL', 'MU', 'ANET', 'VRT', 'AMD']) {
      expect(copy).toContain(`tk:'${ticker}'`);
    }
    for (const retiredTicker of ['MRVL', 'SNDK', 'WDC', 'TER', 'RMBS', 'ALAB', 'PSTG']) {
      expect(copy).not.toContain(`tk:'${retiredTicker}'`);
    }
  });

  it('turns the ten-stock grid into an accessible AI-factory convoy narrative', () => {
    expect(html).toContain('id="portfolioConvoy"');
    expect(html).toContain('AI FACTORY CONVOY');
    expect(html).toContain('id="convoyNodes"');
    expect(html).toContain('id="convoyProgress"');
    expect(html).toContain('role="list"');
    for (const picks of [PICKS_EN, PICKS_ZH]) {
      expect(picks).toHaveLength(10);
      expect(picks.reduce((sum, pick) => sum + pick.pct, 0)).toBe(100);
      for (const pick of picks) {
        expect(pick.layer).toBeTruthy();
        expect(pick.role).toBeTruthy();
        expect(pick.catalyst).toBeTruthy();
        expect(pick.risk).toBeTruthy();
      }
    }
  });

  it('keeps the homepage command bar attached to the viewport', () => {
    expect(html).toContain('<nav class="site-header--follow">');
    expect(brandCss).toMatch(/\.home-page \.site-header--follow\s*\{[^}]*position:\s*fixed;/s);
  });
});
