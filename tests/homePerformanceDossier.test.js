import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PICKS_EN, PICKS_ZH } from '../src/data/content.js';

const html = readFileSync('index.html', 'utf8');
const copy = readFileSync('src/data/content.js', 'utf8');
const voyageConsole = readFileSync('src/ui/voyageLogConsole.js', 'utf8');
const brandCss = readFileSync('public/styles/afflatus-brand.css', 'utf8');
const combatCss = readFileSync('src/cic-hud.css', 'utf8');
const performanceCss = readFileSync('src/performance-dossier.css', 'utf8');
const convoyCss = readFileSync('src/portfolio-convoy.css', 'utf8');

describe('FY2025–26 homepage performance dossier', () => {
  it('keeps realized facts separate from modeled portfolio statistics', () => {
    expect(html).toContain('CLOSED PROFITABLE SUBSET');
    expect(html).toContain('+2.78%');
    expect(html).toContain('Weighted capital days');
    expect(html).toContain('Profitable flight paths');
    expect(html).toContain('02-B / ANNUALIZED');
    expect(html).toContain('+261.2%');
    expect(html).toContain('02-C / MODEL MAX');
    expect(html).toContain('41.4%');
    expect(html).toContain('method-dependent estimates');
  });

  it('shows one explicitly labeled upper bound per headline metric', () => {
    for (const [id, value] of [['sv0', '41.4%'], ['sv1', '0.85'], ['sv2', '−22%'], ['sv3', '1.85']]) {
      expect(html).toContain(`id="${id}">${value}</div>`);
    }
    expect(html).not.toMatch(/id="sv[0-3]">[^<]*[–…][^<]*<\/div>/);
    expect(copy).toContain("sl:['账户年化 · 上界'");
    expect(copy).toContain("sl:['Annual return · upper bound'");
  });

  it('removes every lower-bound value from visible homepage markup', () => {
    for (const lowerBound of ['37.5', '0.78', '−18', '1.65']) {
      expect(html).not.toContain(lowerBound);
    }
  });

  it('does not repeat headline risk metrics in the lower risk chamber', () => {
    const riskChamber = html.slice(html.indexOf('<div class="risk-chamber">'), html.indexOf('<aside class="methodology-seal">'));
    expect(riskChamber).toContain('ANNUAL VOLATILITY');
    expect(riskChamber).toContain('<strong>45%</strong>');
    expect(riskChamber).not.toContain('<i>MAX DRAWDOWN</i>');
    expect(riskChamber).not.toContain('<i>SHARPE RATIO</i>');
    expect(riskChamber).not.toContain('<i>BETA / SPX</i>');
  });

  it('keeps principal, transaction values and account balances private', () => {
    expect(html).not.toMatch(/\$[0-9]/);
    expect(html).not.toMatch(/\b(?:AUD|USD)\b/);
    expect(copy).not.toMatch(/\$[0-9]/);
    expect(copy).not.toMatch(/\b(?:AUD|USD)\b/);
    expect(html).toContain('transaction values and account balances are not published');
  });

  it('presents voyage notes as a local read-only archive, not fake authentication', () => {
    expect(html).toContain('LOCAL / READ-ONLY');
    expect(html).not.toContain('id="voyageAccessForm"');
    expect(html).not.toContain('id="voyagePassword"');
    expect(voyageConsole).not.toContain('unlocked = true');
    expect(voyageConsole).toContain("status: 'LOCAL ARCHIVE · READ ONLY'");
  });

  it('keeps the voyage archive legible without a blocking boot sequence', () => {
    expect(combatCss).toMatch(/\.cic-log-console\s*\{[^}]*width:\s*min\(520px,/s);
    expect(combatCss).toMatch(/\.cic-log-entries p\s*\{[^}]*font-size:\s*10\.5px;/s);
    expect(combatCss).toMatch(/\.cic-log-boot\.play\s*\{[^}]*\.55s/s);
    expect(combatCss).toMatch(/body\.voyage-log-open #combatHud \.cic-shell\s*\{[^}]*overflow:\s*visible;/s);
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
    expect(copy).toContain('2026-08-07 08:29 ET · PRE-NFP');
    for (const ticker of ['NVDA', 'AVGO', 'AMD', 'ORCL', 'AMZN', 'MSFT', 'TSM', 'GOOGL', 'MU', 'VRT']) {
      expect(copy).toContain(`tk:'${ticker}'`);
    }
    for (const retiredTicker of ['ANET', 'MRVL', 'SNDK', 'WDC', 'TER', 'RMBS', 'ALAB', 'PSTG']) {
      expect(copy).not.toContain(`tk:'${retiredTicker}'`);
    }
    expect(PICKS_EN.map(({ tk, pct }) => [tk, pct])).toEqual([
      ['NVDA', 18], ['AVGO', 15], ['AMD', 13], ['ORCL', 10], ['AMZN', 9],
      ['MSFT', 9], ['TSM', 8], ['GOOGL', 7], ['MU', 6], ['VRT', 5],
    ]);
  });

  it('turns the ten-stock grid into an accessible live solar-atlas narrative', () => {
    expect(html).toContain('id="portfolioConvoy"');
    expect(html).toContain('AI INDUSTRY SOLAR ATLAS');
    expect(html).toContain('id="convoyNodes"');
    expect(html).toContain('id="convoySolarSystem"');
    expect(html).toContain('id="convoyProgress"');
    expect(html).toContain('<ol class="holdings-fallback"');
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

  it('keeps section 02 modules ordered before section 03 and left-aligns both introductions', () => {
    const section02Labels = ['02-A / FACT', '02-B / ANNUALIZED', '02-C / MODEL MAX', '02-D / RELATIVE VELOCITY', '02-E / PROFITABLE FLIGHT PATHS'];
    let previousIndex = -1;
    for (const label of section02Labels) {
      const index = html.indexOf(label);
      expect(index).toBeGreaterThan(previousIndex);
      previousIndex = index;
    }
    expect(html.indexOf('03 · <span>top 10 allocations · usa')).toBeGreaterThan(previousIndex);
    expect(performanceCss).toMatch(/\.flight-path-head\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex-direction:\s*column;[\s\S]*?align-items:\s*flex-start;[\s\S]*?text-align:\s*left;/);
    expect(convoyCss).toMatch(/\.portfolio-intro\s*\{[^}]*text-align:\s*left;/s);
    expect(convoyCss).toMatch(/\.portfolio-intro > \.sec-title\s*\{[^}]*margin-inline:\s*0;/s);
    expect(convoyCss).toMatch(/\.portfolio-intro > \.sec-desc\s*\{[^}]*margin-inline:\s*0;/s);
  });

  it('keeps the homepage command bar attached to the viewport', () => {
    expect(html).toContain('<nav class="site-header--follow">');
    expect(brandCss).toMatch(/\.home-page \.site-header--follow\s*\{[^}]*position:\s*fixed;/s);
  });
});
