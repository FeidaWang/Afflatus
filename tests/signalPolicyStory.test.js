import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'parse5';

const html = readFileSync('signal.html', 'utf8');
const css = readFileSync('public/styles/signal.css', 'utf8');
const signalLibs = readFileSync('src/pages/signalLibs.js', 'utf8');
const yieldMonitor = readFileSync('src/lib/treasuryYieldMonitor.js', 'utf8');
const signalData = JSON.parse(readFileSync('public/signal-events.json', 'utf8'));

function walk(node, visit) {
  visit(node);
  (node.childNodes || []).forEach((child) => walk(child, visit));
}

describe('signal policy reaction story', () => {
  it('ships five bilingual causal steps before the incident archive', () => {
    const document = parse(html);
    const steps = [];
    walk(document, (node) => {
      const attrs = Object.fromEntries((node.attrs || []).map(({ name, value }) => [name, value]));
      if (attrs['data-policy-step'] != null) steps.push(attrs);
    });
    expect(steps).toHaveLength(5);
    expect(steps.every((attrs) => attrs.tabindex === '0')).toBe(true);
    expect(html.indexOf('id="ch00"')).toBeLessThan(html.indexOf('id="ch03"'));
  });

  it('connects inputs, the Fed filter, pricing and assets', () => {
    ['01 · INPUTS', '02 · FED FILTER', '03 · PRICING', '04 · ASSETS']
      .forEach((label) => expect(html).toContain(label));
    expect(html).toContain('IntersectionObserver');
    expect(html).toContain('prefers-reduced-motion: reduce');
  });

  it('uses preloaded self-hosted fonts so the dossier does not reflow', () => {
    expect(html).toContain('anton-latin-400-normal.woff2');
    expect(html).toContain('jetbrains-mono-latin-400-normal.woff2');
    expect(html).not.toContain('fonts.googleapis.com');
    expect(html).not.toContain('fonts.gstatic.com');
    expect(css).toContain("'Marathon Shapiro 65'");
    expect(css).toContain("'JetBrains Mono'");
  });

  it('renders the historical-data warning with dark text on the paper surface', () => {
    expect(css).toMatch(/\.signal-stale-notice\{[^}]*color:#533b00;[^}]*font:700/s);
    expect(css).toMatch(/\.signal-stale-notice\{[^}]*text-shadow:none/s);
    expect(html).toContain('id="marketDeskKicker"');
    expect(html).toContain('id="operationStatusLabel"');
    expect(html).toContain('ARCHIVE DESK · DATA THROUGH');
    expect(html).toContain('ARCHIVED SNAPSHOT · RESERVE MANAGEMENT');
    expect(html).toContain("classList.toggle('signal-data-fresh', !stale)");
    expect(css).toMatch(/\.signal-data-stale \.operationStatus \.pulse\{animation:none;box-shadow:none\}/);
    expect(css).toMatch(/\.signal-data-stale \.heroCountdown \.live::before\{animation:none\}/);
  });

  it('keeps the localized language link dark on its amber control', () => {
    expect(css).toMatch(/\.lang-toggle,\.nav \.lang-toggle\{[^}]*color:#1a1a1c;[^}]*background:var\(--amber\)/s);
  });

  it('ships the July payroll diagnosis and primary-source links in both languages', () => {
    expect(html).toContain('JULY LABOR CONTROL PANEL');
    expect(html).toContain('7月就业控制面板');
    expect(html).toContain('−23K');
    expect(html).toContain('−103K');
    expect(html).toContain('https://www.bls.gov/news.release/empsit.nr0.htm');
    expect(html).toContain("label_en: 'PRIMARY RECORD ↗', label_zh: '原始文件 ↗'");
    expect(html).toContain("['marketWindow', 'OBSERVATION WINDOW', '观察窗口']");
    expect(html).toContain("['industryTransmission', 'POLICY / INDUSTRY', '政策／行业传导']");
    expect(signalData.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(signalData.updated >= '2026-08-07').toBe(true);
    expect(signalData.events.some((event) => event.id === 'NFP-2026-07')).toBe(true);
    expect(signalData.events.some((event) => event.id === 'PCE-2026-06')).toBe(true);
    expect(signalData.events.some((event) => event.id === 'PCE-2026-05')).toBe(false);
  });

  it('explains Trump influence through separate Fed and industry transmission maps', () => {
    expect(html).toContain('TRUMP → FED INFLUENCE MAP');
    expect(html).toContain('TRUMP → INDUSTRY PRIORITY MAP');
    expect(html).toContain('The FOMC has twelve voters');
    expect(html).toContain('政策同向行业监控');
    expect(html).toContain('多晶硅与太阳能材料');
    expect(html).toContain('国防工业基础');
    expect(html).toContain('住房供给');
    expect(signalData.events.some((event) => event.id === 'TRUMP-AI-2026-07-23')).toBe(true);
    expect(signalData.events.some((event) => event.id === 'TRUMP-CHIPS-2026-01')).toBe(true);
    expect(signalData.events.some((event) => event.id === 'TRUMP-POLYSILICON-2026-08-06')).toBe(true);
  });

  it('adds a bilingual live Treasury dashboard beside the current Fed intervention brief', () => {
    expect(html).toContain('id="chlive"');
    expect(html).toContain('href="#treasuryYieldBoard"');
    expect(html).toContain('CURRENT REINVESTMENT');
    expect(html).toContain('本期再投资');
    expect(html).toContain('$17.0B');
    expect(html).toContain('data-yield-tenor="10Y"');
    expect(html).toContain('data-yield-tenor="30Y"');
    expect(html).toContain('data-yield-spread');
    expect(yieldMonitor).toContain('/api/treasury-yields');
    expect(yieldMonitor).toContain('window.__AFFLATUS_E2E__');
    expect(html).toContain('treasury-securities-operational-details');
    expect(signalData.events.some((event) => event.id === 'FED-RMP-2026-08-14')).toBe(true);
    expect(signalLibs).toContain('mountTreasuryYieldMonitor');
    expect(css).toContain('.marketDeskGrid');
    expect(css).toContain('.yieldCards');
  });

  it('removes the opt-in containment ambience and its Web Audio implementation', () => {
    expect(html).not.toContain('SITE AMBIENCE');
    expect(html).not.toContain('站点环境音');
    expect(html).not.toContain('id="amb"');
    expect(html).not.toContain('AudioContext');
    expect(css).not.toContain('.dock');
  });
});
