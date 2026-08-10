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
const siteManifest = readFileSync('src/config/siteManifest.js', 'utf8');

describe('FY2025–26 homepage performance dossier', () => {
  it('publishes one focused A/B/C capital-black-box sequence', () => {
    expect(html).toContain('02-A / CYCLE CORE');
    expect(html).toContain('CLOSED-CYCLE CAPITAL VELOCITY');
    expect(html).toContain('Weighted capital days');
    expect(html).toContain('Annual volatility');
    expect(html).toContain('VECTOR FIELD / NORMALIZED');
    expect(html).toContain('02-C / FLIGHT PATH MATRIX');
    expect(html).toContain('route-manifest');
    expect(html).not.toContain('DISCLOSURE BOUNDARY');
    expect(html).not.toContain('PRIVACY BY DESIGN');
    expect(html).not.toContain('02-D / RISK COST');
    expect(html).toContain('+261.2%');
    expect(html).toContain('41.4%');
    expect(html).toContain('method-dependent estimates');
  });

  it('removes position-return values, labels and derived presentation data', () => {
    const publicRuntime = [html, copy, performanceCss, siteManifest].join('\n');
    expect(publicRuntime).not.toMatch(/ABS(?:OLUTE)? RETURN/i);
    expect(publicRuntime).not.toContain('绝对收益率');
    expect(publicRuntime).not.toContain('--route-return');
    expect(publicRuntime).not.toMatch(/realized profitable|showing return/i);
    expect(html).toContain('--route-duration:');
    expect(html.match(/data-en="[\d.]+ D HOLD"/g)).toHaveLength(5);
  });

  it('shows one explicitly labeled upper bound per headline metric', () => {
    for (const [id, value] of [['sv0', '41.4%'], ['sv1', '0.85'], ['sv2', '−22%'], ['sv3', '1.85']]) {
      expect(html).toContain(`id="${id}">${value}</div>`);
    }
    expect(html).not.toMatch(/id="sv[0-3]">[^<]*[–…][^<]*<\/div>/);
    expect(copy).toContain("sl:['账户年化 · 上界'");
    expect(copy).toContain("sl:['Annual return · upper bound'");
    expect(html.match(/41\.4%/g)).toHaveLength(1);
  });

  it('keeps benchmark multipliers on one intrinsic-width line', () => {
    expect(html).toContain('<strong>2.94×</strong>');
    expect(html).toContain('<strong>4.40×</strong>');
    expect(performanceCss).toMatch(/grid-template-columns:[^;]*minmax\(max-content, \.24fr\)/);
    expect(performanceCss).toMatch(/\.velocity-vector > strong\s*\{[^}]*white-space:\s*nowrap;/s);
    expect(performanceCss).toMatch(/\.velocity-vector > strong\s*\{[^}]*overflow-wrap:\s*normal;/s);
  });

  it('removes every lower-bound value from visible homepage markup', () => {
    for (const lowerBound of ['37.5', '0.78', '−18', '1.65']) {
      expect(html).not.toContain(lowerBound);
    }
  });

  it('folds the single additional risk reading into 02-A', () => {
    const cycleCore = html.slice(html.indexOf('<section class="blackbox-module cycle-core"'), html.indexOf('<section class="blackbox-module velocity-field"'));
    expect(cycleCore).toContain('Annual volatility');
    expect(cycleCore).toContain('<dd>45%</dd>');
    expect(html).not.toContain('class="risk-chamber"');
    expect(html).not.toContain('class="risk-grid');
  });

  it('keeps principal, transaction values and account balances private', () => {
    expect(html).not.toMatch(/\$[0-9]/);
    expect(html).not.toMatch(/\b(?:AUD|USD)\b/);
    expect(copy).not.toMatch(/\$[0-9]/);
    expect(copy).not.toMatch(/\b(?:AUD|USD)\b/);
    expect(html).toContain('Position outcomes, principal, transaction values, quantities and account balances are omitted');
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
    for (const duration of ['17.5 D HOLD', '3.0 D HOLD', '11.2 D HOLD', '246 D HOLD', '5.6 D HOLD']) {
      expect(html).toContain(duration);
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
    const section02Labels = ['02-A / CYCLE CORE', '02-B / RELATIVE VELOCITY', '02-C / FLIGHT PATH MATRIX'];
    let previousIndex = -1;
    for (const label of section02Labels) {
      const index = html.indexOf(label);
      expect(index).toBeGreaterThan(previousIndex);
      previousIndex = index;
    }
    expect(html.indexOf('03 · <span>top 10 allocations · usa')).toBeGreaterThan(previousIndex);
    expect(performanceCss).toMatch(/\.route-axis,\s*\.trade-route\s*\{[^}]*grid-template-columns:\s*46px/s);
    expect(performanceCss).toContain('@keyframes manifestScan');
    expect(performanceCss).toContain('@keyframes vectorScan');
    expect(convoyCss).toMatch(/\.portfolio-intro\s*\{[^}]*text-align:\s*left;/s);
    expect(convoyCss).toMatch(/\.portfolio-intro > \.sec-title\s*\{[^}]*margin-inline:\s*0;/s);
    expect(convoyCss).toMatch(/\.portfolio-intro > \.sec-desc\s*\{[^}]*margin-inline:\s*0;/s);
  });

  it('keeps the homepage command bar attached to the viewport', () => {
    expect(html).toContain('<nav class="site-header--follow">');
    expect(brandCss).toMatch(/\.home-page \.site-header--follow\s*\{[^}]*position:\s*fixed;/s);
  });
});
