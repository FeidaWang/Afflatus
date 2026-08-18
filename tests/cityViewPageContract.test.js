import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'parse5';
import { describe, expect, it } from 'vitest';
import { CITY_ASSET_CATEGORIES } from '../src/city/assetVisibility.ts';

const ROOT = resolve(import.meta.dirname, '..');
const html = readFileSync(resolve(ROOT, 'cityview.html'), 'utf8');
const css = readFileSync(resolve(ROOT, 'public/styles/cityview.css'), 'utf8');
const pageSource = readFileSync(resolve(ROOT, 'src/pages/cityView.js'), 'utf8');
const deviceAuditSource = readFileSync(resolve(ROOT, 'src/pages/cityDeviceAudit.js'), 'utf8');
const document = parse(html);

const attr = (node, name) => node?.attrs?.find((entry) => entry.name === name)?.value ?? null;
const classes = (node) => (attr(node, 'class') || '').split(/\s+/).filter(Boolean);

function* walk(node) {
  yield node;
  for (const child of node?.childNodes || []) yield* walk(child);
}

const nodes = [...walk(document)].filter((node) => node.tagName);
const withAttribute = (name, value = null) => nodes.filter((node) => (
  attr(node, name) !== null && (value === null || attr(node, name) === value)
));
const byId = (id) => nodes.find((node) => attr(node, 'id') === id) ?? null;

describe('Cityview page release-readiness contract', () => {
  it('keeps the public experience truthful and useful without a successful 3D boot', () => {
    expect(withAttribute('name', 'robots')).toHaveLength(0);
    expect(attr(withAttribute('rel', 'canonical')[0], 'href')).toBe('https://feida.au/cityview.html');
    expect(withAttribute('data-afflatus-nav')).toHaveLength(1);
    const stage = withAttribute('data-city-stage')[0];
    expect(stage?.tagName).toBe('main');
    expect(attr(stage, 'aria-busy')).toBe('false');
    expect(attr(withAttribute('data-city-canvas')[0], 'aria-hidden')).toBe('true');
    expect(nodes.filter((node) => node.tagName === 'h1')).toHaveLength(1);
    expect(nodes.some((node) => node.tagName === 'details' && classes(node).includes('city-summary'))).toBe(true);
    expect(html).toContain('<noscript>');
    expect(html).toContain('the city summary remains available above');
    expect(html).toContain('Static truth summary ready. Checking the production registry…');
  });

  it('exposes native, labelled construction and panel controls', () => {
    const timeline = withAttribute('data-city-timeline')[0];
    expect(timeline).toMatchObject({ tagName: 'input' });
    expect(attr(timeline, 'type')).toBe('range');
    expect(attr(timeline, 'min')).toBe('0');
    expect(attr(timeline, 'max')).toBe('210');

    const actions = nodes.filter((node) => node.tagName === 'button' && classes(node).includes('city-action'));
    expect(actions).toHaveLength(8);
    expect(actions.every((button) => attr(button, 'type') === 'button')).toBe(true);
    expect(attr(withAttribute('data-city-load')[0], 'hidden')).not.toBeNull();
    for (const control of [
      'data-city-play',
      'data-city-tour',
      'data-city-view',
      'data-city-reset',
      'data-city-timeline',
      'data-city-profile',
      'data-city-truth-mode',
      'data-city-production-environment',
      'data-city-production-view',
      'data-city-data',
      'data-city-layers',
      'data-city-rebuild',
    ]) {
      expect(attr(withAttribute(control)[0], 'disabled')).not.toBeNull();
    }
    expect(attr(nodes.find((node) => classes(node).includes('city-lang')), 'disabled')).not.toBeNull();

    for (const [buttonAttribute, panelId] of [
      ['data-city-data', 'city-data-panel'],
      ['data-city-layers', 'city-layer-panel'],
    ]) {
      const button = withAttribute(buttonAttribute)[0];
      const panel = byId(panelId);
      expect(attr(button, 'aria-controls')).toBe(panelId);
      expect(attr(button, 'aria-expanded')).toBe('false');
      expect(attr(panel, 'hidden')).not.toBeNull();
      expect(attr(panel, 'aria-labelledby')).toBeTruthy();
      expect(byId(attr(panel, 'aria-labelledby'))).toBeTruthy();
    }
  });

  it('keeps all simulated metrics explained and all render layers keyboard-native', () => {
    expect(withAttribute('data-city-metric')).toHaveLength(5);
    expect(withAttribute('data-city-metric-cause')).toHaveLength(5);
    expect(withAttribute('data-city-metric-cause').every((node) => node.parentNode?.tagName === 'dd')).toBe(true);
    expect(html).toContain('Scenario values only—not live municipal data.');

    const charts = withAttribute('data-city-chart');
    expect(charts.map((node) => attr(node, 'data-city-chart'))).toEqual([
      'completion-ring',
      'residents-columns',
      'jobs-bar',
      'energy-line',
      'traffic-bar',
    ]);
    expect(charts.every((node) => attr(node, 'aria-hidden') === 'true')).toBe(true);
    expect(withAttribute('data-city-chart-column')).toHaveLength(9);
    expect(withAttribute('data-city-chart-fill')).toHaveLength(2);
    expect(pageSource).toContain('createCityMetricChartSnapshot(plan, day)');
    expect(pageSource).toMatch(/if \(!dataPanelOpen\) return;[\s\S]*renderMetricSnapshot/);

    const toggles = withAttribute('data-city-asset-toggle');
    expect(toggles).toHaveLength(CITY_ASSET_CATEGORIES.length);
    expect(toggles.map((node) => attr(node, 'data-city-asset-toggle'))).toEqual(
      CITY_ASSET_CATEGORIES.map(({ key }) => key),
    );
    expect(toggles.every((node) => (
      node.tagName === 'input'
      && attr(node, 'type') === 'checkbox'
      && attr(node, 'checked') !== null
      && node.parentNode?.tagName === 'label'
    ))).toBe(true);
  });

  it('keeps generated geometry inside the explicitly selected synthetic Sandbox', () => {
    expect(pageSource).toContain("generateSandboxCity(seed, 'sandbox')");
    expect(pageSource).toContain("stage?.setAttribute('data-city-truth-class', 'generated-sandbox')");
    expect(pageSource).toContain("stage?.setAttribute('data-city-truth-class', 'real-city-unavailable')");
    expect(pageSource).toContain('if (!generatedSandbox)');
    expect(pageSource).toContain('No generated fallback was loaded.');
    expect(html).toContain('procedural model lives only in the explicitly selected Sandbox');
  });

  it('offers three real-city targets and a separate bilingual truth-mode selector', () => {
    const profileOptions = nodes.filter((node) => (
      node.tagName === 'option' && node.parentNode === withAttribute('data-city-profile')[0]
    ));
    expect(profileOptions.map((node) => attr(node, 'value'))).toEqual([
      'shanghai',
      'melbourne',
      'hong-kong',
    ]);
    const hongKongOption = profileOptions.find((node) => attr(node, 'value') === 'hong-kong');
    expect(attr(hongKongOption, 'data-en')).toBe('Hong Kong · Victoria Harbour');
    expect(attr(hongKongOption, 'data-zh')).toBe('香港 · 维多利亚港');
    const truthOptions = nodes.filter((node) => (
      node.tagName === 'option' && node.parentNode === withAttribute('data-city-truth-mode')[0]
    ));
    expect(truthOptions.map((node) => attr(node, 'value'))).toEqual([
      'reality',
      'construction-scenario',
      'sandbox',
    ]);
    expect(pageSource).toContain('Victoria Harbour, both shorelines, Victoria Peak terrain');
    expect(pageSource).toContain('维多利亚港两岸、太平山地形');
  });

  it('keeps physical-device evidence opt-in, local and bilingual', () => {
    const panel = withAttribute('data-city-device-audit')[0];
    expect(panel?.tagName).toBe('aside');
    expect(attr(panel, 'hidden')).not.toBeNull();
    expect(attr(panel, 'aria-labelledby')).toBe('city-device-audit-title');
    expect(withAttribute('data-city-device-label')[0]?.tagName).toBe('input');
    expect(attr(withAttribute('data-city-device-label')[0], 'required')).not.toBeNull();
    expect(attr(withAttribute('data-city-device-start')[0], 'disabled')).not.toBeNull();
    expect(attr(withAttribute('data-city-device-finish')[0], 'disabled')).not.toBeNull();
    expect(html).toContain('nothing is uploaded');
    expect(html).toContain('不会上传任何数据');
    expect(pageSource).toContain("locationParams.get('device-audit') === '1'");
    expect(pageSource).toContain("import('./cityDeviceAudit.js')");
    expect(pageSource).toContain('targetDurationMs: window.__AFFLATUS_E2E__ ? 250 : undefined');
    expect(deviceAuditSource).toContain('navigator.share');
    expect(deviceAuditSource).toContain('URL.createObjectURL(file)');
    expect(deviceAuditSource).not.toMatch(/\b(?:fetch|sendBeacon|XMLHttpRequest|WebSocket)\b/);
  });

  it('describes every asset counted by the landscape layer', () => {
    expect(html).toContain('Street and park trees, seating, lamps and cycle racks');
    expect(html).toContain('行道树、公园树、座椅、路灯与自行车架');
  });

  it('provides vertical-only recovery for 200% zoom-equivalent and short viewports', () => {
    expect(css).toMatch(/max-height:\s*max\(160px,\s*calc\(100vh - 440px\)\)/);
    expect(css).toMatch(/@media \(max-height: 640px\)[\s\S]*body\.cityview-page\s*{[^}]*overflow-x:\s*hidden;[^}]*overflow-y:\s*auto;/);
    expect(css).toMatch(/@media \(max-width: 760px\)[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toMatch(/\.city-action\s*{[^}]*min-height:\s*44px/s);
    expect(css).toMatch(/\.city-action\s*{[^}]*white-space:\s*nowrap/s);
    expect(css).toContain('.city-action[hidden]');
  });

  it('keeps Sandbox timeline truth while real-city failures remain renderer-free', () => {
    expect(pageSource).toContain('updateDay(nextDay);');
    expect(pageSource).toContain('scene?.setDay(nextDay);');
    expect(pageSource).toContain("canvas.dataset.renderer = 'poster'");
    expect(pageSource).toContain('setRendererAvailable(false);');
    expect(pageSource).toContain('setPageControllerReady(false);');
    expect(html).toContain('data-city-load');
    expect(pageSource).toContain("loadButton?.addEventListener('click'");
    expect(pageSource).toContain("'Static city ready. Choose Load 3D to start the optional scene.'");
    expect(pageSource).toContain('window.requestIdleCallback(mountInitialCity, { timeout: 900 })');
    expect(pageSource).toMatch(/finally \{[\s\S]*setPageControllerReady\(true\);/);
    expect(pageSource).toContain("timeline?.addEventListener('focus'");
    expect(pageSource).toContain("stage?.setAttribute('data-city-profile-key', request.profile)");
    expect(pageSource).toContain("activeCitySurface === 'sandbox'");
    expect(pageSource).toContain("'城市推演台 — 真实数据门控城市观测台 · Afflatus'");
  });

  it('gates the real-data shell adapter to dev loopback and fails back to truthful DOM', () => {
    expect(pageSource).toContain('import.meta.env.DEV');
    expect(pageSource).toContain("locationParams.get('analysis-preview') === 'melbourne'");
    expect(pageSource).toContain("import('./cityAnalysisShellPreview.js')");
    expect(pageSource).toContain("'licensed-real-data-candidate'");
    expect(pageSource).toContain('setAnalysisView: (view)');
    expect(pageSource).toContain('setAnalysisEnvironment: (environment)');
    expect(pageSource).toContain('getAnalysisSelection: ()');
    expect(pageSource).toContain("selection.dataset.cityAnalysisSelection = ''");
    expect(pageSource).toContain('renderAnalysisSelection(feature)');
    expect(pageSource).toContain("locationParams.get('analysis-environment-failure')");
    expect(pageSource).toContain("picker.className = 'city-profile-picker city-environment-picker'");
    expect(pageSource).toContain('productionRuntimeState.setCanonicalView(productionViewSelect.value)');
    expect(pageSource).toContain('the previous verified camera and tile set remain active');
    expect(pageSource).toContain("canvas.dataset.renderer = 'poster'");
    expect(pageSource).toContain('licensed source facts remain available below');
    expect(pageSource).toMatch(/function updateMetrics[\s\S]*if \(localAnalysisPreviewMode\) return;/);
  });
});
