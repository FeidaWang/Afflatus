import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, settlePage, test } from './site-fixture.js';

const PRODUCTION_FIXTURE_DIRECTORY = resolve(
  import.meta.dirname,
  '../data/city/candidates/melbourne-flinders-federation-v1',
);

function renameGlbMaterial(bytes, sourceName, targetName) {
  const source = Buffer.from(bytes);
  const jsonLength = source.readUInt32LE(12);
  const jsonType = source.readUInt32LE(16);
  const json = JSON.parse(source.subarray(20, 20 + jsonLength).toString().trimEnd());
  const material = json.materials?.find(({ name }) => name === sourceName);
  if (!material) throw new Error(`Fixture material ${sourceName} is missing.`);
  material.name = targetName;
  const jsonBytes = Buffer.from(JSON.stringify(json));
  const paddedJsonLength = Math.ceil(jsonBytes.byteLength / 4) * 4;
  const remainingChunks = source.subarray(20 + jsonLength);
  const result = Buffer.alloc(20 + paddedJsonLength + remainingChunks.byteLength, 0x20);
  source.subarray(0, 12).copy(result, 0);
  result.writeUInt32LE(result.byteLength, 8);
  result.writeUInt32LE(paddedJsonLength, 12);
  result.writeUInt32LE(jsonType, 16);
  jsonBytes.copy(result, 20);
  remainingChunks.copy(result, 20 + paddedJsonLength);
  return result;
}

function productionCityPackageFixture() {
  const manifest = JSON.parse(readFileSync(resolve(PRODUCTION_FIXTURE_DIRECTORY, 'manifest.json'), 'utf8'));
  const index = JSON.parse(readFileSync(resolve(PRODUCTION_FIXTURE_DIRECTORY, 'entities-index.json'), 'utf8'));
  manifest.status = 'production-approved';
  manifest.landmarkAssets = {
    admissionUri: `/assets/city/packages/${manifest.packageId}/landmark-admission.json`,
    sha256: 'e'.repeat(64),
    byteLength: 1024,
  };
  manifest.canonicalViews = Array.from({ length: 5 }, (_, index) => ({
    id: `browser-fixture-view-${index + 1}`,
    labels: { en: `Classic view ${index + 1}`, zh: `经典视角 ${index + 1}` },
    positionLocal: index === 1
      ? { x: 800, y: 480, z: 1050 }
      : { x: 1047.5 + index, y: 525, z: 1115 },
    targetLocal: index === 1
      ? { x: -125, y: 18, z: 375 }
      : { x: 250, y: 18, z: 125 },
    verticalFovDegrees: 42 + index,
    verticalBasis: 'local-datum-metres',
    verticalEvidence: 'e2e/browser-camera-fixture.md',
  }));
  for (const role of Object.keys(manifest.approvals)) {
    manifest.approvals[role] = {
      status: 'approved',
      by: `${role}-browser-fixture`,
      at: '2026-08-18',
      evidence: `e2e/${role}-browser-fixture`,
    };
  }
  index.runtime.representation = 'CityPackage GLB';
  index.runtime.candidateOnly = false;
  // The compact candidate's centre tile has no hydro primitive. Include the
  // verified Yarra tile in the centre dependency set so this production-path
  // fixture exercises the PBR water shader instead of merely loading an unused
  // material declaration from the GLB.
  const centreTile = index.tiles.find(({ id }) => id === 'tile-c02-r02');
  if (!centreTile.dependencyTileIds.includes('tile-c00-r03')) {
    centreTile.dependencyTileIds.push('tile-c00-r03');
  }
  // Reclassify the existing tree point primitive in the water-bearing fixture
  // tile as explicitly authored aviation-light geometry. The GLB JSON chunk is
  // rebuilt while vertex data stays unchanged, and both package hash layers are
  // updated so the browser exercises the real verification and beacon paths.
  const assetOverrides = new Map();
  const authoredLightTile = index.tiles.find(({ id }) => id === 'tile-c00-r03');
  for (const lod of authoredLightTile.lods) {
    const filename = lod.runtimeAsset.uri.split('/').at(-1);
    const bytes = renameGlbMaterial(
      readFileSync(resolve(PRODUCTION_FIXTURE_DIRECTORY, filename)),
      'trees-analysis',
      'aviation-light-fixture',
    );
    const authoredSha256 = createHash('sha256').update(bytes).digest('hex');
    lod.runtimeAsset.sha256 = authoredSha256;
    lod.runtimeAsset.byteLength = bytes.byteLength;
    const manifestRuntimeAsset = manifest.assets.find(({ id }) => id === lod.runtimeAsset.assetId);
    manifestRuntimeAsset.sha256 = authoredSha256;
    manifestRuntimeAsset.byteLength = bytes.byteLength;
    assetOverrides.set(filename, bytes);
  }
  const indexBytes = Buffer.from(JSON.stringify(index));
  const indexAsset = manifest.assets.find(({ kind }) => kind === 'entities-index');
  indexAsset.byteLength = indexBytes.byteLength;
  indexAsset.sha256 = createHash('sha256').update(indexBytes).digest('hex');
  const manifestBytes = Buffer.from(JSON.stringify(manifest));
  return {
    manifestBytes,
    indexBytes,
    indexUri: indexAsset.uri,
    assetOverrides,
    packageReference: {
      packageId: manifest.packageId,
      manifestPath: 'public/assets/city/packages/melbourne-browser-fixture-v1/manifest.json',
      manifestSha256: createHash('sha256').update(manifestBytes).digest('hex'),
    },
  };
}

async function installProductionCityPackageFixture(
  page,
  { corruptFirstGlb = false, corruptViewSwitchTile = false } = {},
) {
  const fixture = productionCityPackageFixture();
  await page.addInitScript(({ packageReference }) => {
    window.__AFFLATUS_CITY_PACKAGE_FIXTURE__ = { cityId: 'melbourne', packageReference };
  }, { packageReference: fixture.packageReference });
  let corrupted = false;
  await page.route('**/assets/city/packages/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/assets/city/packages/melbourne-browser-fixture-v1/manifest.json') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: fixture.manifestBytes });
      return;
    }
    if (pathname === fixture.indexUri) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: fixture.indexBytes });
      return;
    }
    const filename = pathname.split('/').at(-1);
    const sourcePath = resolve(PRODUCTION_FIXTURE_DIRECTORY, filename);
    let bytes = fixture.assetOverrides.get(filename) ?? readFileSync(sourcePath);
    if (corruptFirstGlb && !corrupted && filename.endsWith('.glb')) {
      bytes = Buffer.from(bytes);
      bytes[bytes.length - 1] ^= 1;
      corrupted = true;
    }
    if (corruptViewSwitchTile && filename.startsWith('tile-c00-r02-lod')) {
      bytes = Buffer.from(bytes);
      bytes[bytes.length - 1] ^= 1;
    }
    await route.fulfill({
      status: 200,
      contentType: filename.endsWith('.glb') ? 'model/gltf-binary' : 'application/json',
      body: bytes,
    });
  });
  return fixture;
}

test('Cityview remains truthful and readable without JavaScript', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'The no-JS fallback contract runs once in Chromium.');
  const context = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
    javaScriptEnabled: false,
  });
  const page = await context.newPage();
  try {
    const response = await page.goto('/cityview.html?seed=no-js-contract', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('.city-summary')).toBeVisible();
    await expect(page.locator('.city-noscript')).toBeVisible();
    await expect(page.locator('[data-city-status]')).toContainText('Static truth summary ready');
    await expect(page.locator('[data-city-play]')).toBeDisabled();
    await expect(page.locator('[data-city-tour]')).toBeDisabled();
    await expect(page.locator('[data-city-timeline]')).toBeDisabled();
    await expect(page.locator('[data-city-data]')).toBeDisabled();
    await expect(page.locator('.city-lang')).toHaveAttribute('href', '/zh/cityview.html');
  } finally {
    await context.close();
  }
});

test('Cityview remains truthful when its optional 3D page module fails', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'The module-failure contract runs once in Chromium.');
  const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL });
  const page = await context.newPage();
  await page.route(
    /\/(?:src\/pages\/cityViewEntry\.js|assets\/cityview-[^/]+\.js)$/,
    (route) => route.abort('failed'),
  );
  try {
    const response = await page.goto('/cityview.html?seed=module-failure-contract', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('.city-summary')).toBeVisible();
    await expect(page.locator('[data-city-status]')).toContainText('Static truth summary ready');
    await expect(page.locator('[data-city-play]')).toBeDisabled();
    await expect(page.locator('[data-city-tour]')).toBeDisabled();
    await expect(page.locator('[data-city-timeline]')).toBeDisabled();
    await expect(page.locator('[data-city-data]')).toBeDisabled();
    await expect(page.locator('.city-lang')).toHaveAttribute('href', '/zh/cityview.html');
  } finally {
    await context.close();
  }
});

test('Cityview exposes a deterministic, reversible construction timeline', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const response = await page.goto('/cityview.html?mode=sandbox&seed=e2e-city', { waitUntil: 'domcontentloaded' });
  expect(response?.status()).toBeLessThan(400);
  await settlePage(page);

  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('[data-city-stage]')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('[data-city-canvas]')).toHaveAttribute('data-renderer', /^(webgl|poster)$/);
  await expect(page.locator('[data-city-seed]')).toHaveText('e2e-city');
  await expect(page.locator('[data-city-day]')).toHaveText('000');
  const dataButton = page.locator('[data-city-data]');
  const dataPanel = page.locator('[data-city-data-panel]');
  await expect(dataButton).toHaveAttribute('aria-expanded', 'false');
  await expect(dataPanel).toBeHidden();
  expect(await page.evaluate(() => window.__AFFLATUS_CITYVIEW__?.getDataPanelState())).toMatchObject({
    open: false,
    renderCount: 0,
    chartRenderCount: 0,
    snapshotDay: 0,
    chartDay: null,
    truthClass: 'simulated-state-derived',
    chartTruthClass: null,
  });

  const timeline = page.locator('[data-city-timeline]');
  await timeline.evaluate((element) => {
    element.value = '105';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(page.locator('[data-city-day]')).toHaveText('105');
  await expect(page.locator('[data-city-metric="completion"]')).toHaveText('0%');

  await dataButton.click();
  await expect(dataButton).toHaveAttribute('aria-expanded', 'true');
  await expect(dataPanel).toBeVisible();
  await expect(page.locator('[data-city-metric="completion"]')).not.toHaveText('0%');
  await expect(page.locator('[data-city-metric-cause="traffic"]')).toContainText('road completion');
  const openDataState = await page.evaluate(() => window.__AFFLATUS_CITYVIEW__?.getDataPanelState());
  expect(openDataState).toMatchObject({
    chartDay: 105,
    chartTruthClass: 'simulated-state-derived',
  });
  expect(openDataState.chartRenderCount).toBeGreaterThan(0);
  expect(openDataState.chartSnapshot.residents).toHaveLength(9);
  expect(openDataState.chartSnapshot.energy).toHaveLength(9);
  expect(openDataState.chartSnapshot.completion).toBeGreaterThan(0);
  expect(await page.locator('[data-city-chart-ring]').getAttribute('stroke-dashoffset')).not.toBe('100');
  expect(await page.locator('[data-city-chart-line]').getAttribute('points')).not.toContain('NaN');

  await dataButton.click();
  const hiddenMetricValues = await page.locator('[data-city-metric]').allTextContents();
  const panelStateBeforeHiddenScrub = await page.evaluate(
    () => window.__AFFLATUS_CITYVIEW__?.getDataPanelState(),
  );
  await timeline.evaluate((element) => {
    element.value = '147';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  expect(await page.locator('[data-city-metric]').allTextContents()).toEqual(hiddenMetricValues);
  expect(await page.evaluate(
    () => window.__AFFLATUS_CITYVIEW__?.getDataPanelState().renderCount,
  )).toBe(panelStateBeforeHiddenScrub.renderCount);
  expect(await page.evaluate(
    () => window.__AFFLATUS_CITYVIEW__?.getDataPanelState().chartRenderCount,
  )).toBe(panelStateBeforeHiddenScrub.chartRenderCount);

  const layerButton = page.locator('[data-city-layers]');
  const layerPanel = page.locator('[data-city-layer-panel]');
  await layerButton.click();
  await expect(layerPanel).toBeVisible();
  await expect(dataPanel).toBeHidden();
  await page.locator('[data-city-asset-toggle="mobility"]').uncheck();
  expect(await page.evaluate(() => window.__AFFLATUS_CITYVIEW__?.getLayerEditorState())).toMatchObject({
    open: true,
    visibleCount: 5,
    visibility: { mobility: false },
  });
  expect(await page.evaluate(() => window.__AFFLATUS_CITYVIEW__?.getTelemetry().assetVisibility)).toMatchObject({
    mobility: false,
  });

  await dataButton.click();
  await expect(dataPanel).toBeVisible();
  await expect(layerPanel).toBeHidden();
  expect(await page.evaluate(() => window.__AFFLATUS_CITYVIEW__?.getLayerEditorState().open)).toBe(false);

  await Promise.all([
    page.waitForURL((url) => url.searchParams.get('seed')?.startsWith('city-')),
    page.locator('[data-city-rebuild]').click(),
  ]);
  await expect(page.locator('[data-city-stage]')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('[data-city-seed]')).toHaveText(/^city-/);
  await expect(page.locator('[data-city-day]')).toHaveText('000');
  await expect(page.locator('[data-city-canvas]')).toHaveAttribute('data-renderer', /^(webgl|poster)$/);

  const contract = await page.evaluate(() => {
    const header = document.querySelector('.city-header');
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      actionCount: [...document.querySelectorAll('.city-action')]
        .filter((node) => !node.hidden).length,
      actionLabelLines: [...document.querySelectorAll('.city-action:not([hidden]) > span:last-child')]
        .map((node) => node.getClientRects().length),
      summaryText: document.querySelector('.city-summary')?.textContent?.trim().length || 0,
      viewportWidth: document.documentElement.clientWidth,
      header: header?.getBoundingClientRect().toJSON(),
      headerStyle: header ? {
        display: getComputedStyle(header).display,
        columns: getComputedStyle(header).gridTemplateColumns,
        position: getComputedStyle(header).position,
        gap: getComputedStyle(header).gap,
      } : null,
      headerChildren: header ? [...header.children].map((node) => node.getBoundingClientRect().toJSON()) : [],
      intro: document.querySelector('.city-intro')?.getBoundingClientRect().toJSON(),
    };
  });
  expect(contract.overflow, `${testInfo.project.name} must not overflow horizontally`).toBeLessThanOrEqual(1);
  expect(contract.actionCount).toBe(6);
  expect(contract.actionLabelLines.every((lines) => lines === 1), JSON.stringify(contract)).toBe(true);
  expect(contract.summaryText).toBeGreaterThan(120);
  if (contract.viewportWidth <= 760) {
    expect(contract.header.height, JSON.stringify(contract)).toBeLessThanOrEqual(112);
    expect(contract.intro.top).toBeGreaterThanOrEqual(contract.header.bottom + 8);
  }

  await page.locator('[data-city-play]').click();
  await expect(page.locator('[data-city-day]')).toHaveText('210');
  await expect(page.locator('[data-city-play]')).toHaveAttribute('aria-pressed', 'false');

  // The suite runs with prefers-reduced-motion: reduce. An optional tour must
  // therefore reach a stable overview immediately instead of forcing motion.
  await page.locator('[data-city-tour]').click();
  await expect(page.locator('[data-city-day]')).toHaveText('210');
  await expect(page.locator('[data-city-tour]')).toHaveAttribute('aria-pressed', 'false');
});

test('Cityview keeps controls reachable at a 200% zoom-equivalent short viewport', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'The short-viewport keyboard gate runs once in Chromium.');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 640, height: 360 });
  await page.goto('/cityview.html?mode=sandbox&seed=zoom-contract', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-city-stage]')).toHaveAttribute('aria-busy', 'false');

  const layout = await page.evaluate(() => ({
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    scrollHeight: document.documentElement.scrollHeight,
    clientHeight: document.documentElement.clientHeight,
    bodyOverflowY: getComputedStyle(document.body).overflowY,
  }));
  expect(layout.overflowX).toBeLessThanOrEqual(1);
  expect(layout.scrollHeight).toBeGreaterThan(layout.clientHeight);
  expect(layout.bodyOverflowY).toBe('auto');

  const controls = page.locator('[data-city-controls], #city-controls').first();
  await controls.scrollIntoViewIfNeeded();
  await expect(controls).toBeVisible();

  const layerButton = page.locator('[data-city-layers]');
  await layerButton.focus();
  await page.keyboard.press('Enter');
  await expect(layerButton).toHaveAttribute('aria-expanded', 'true');
  const structures = page.locator('[data-city-asset-toggle="structures"]');
  await expect(structures).toBeFocused();
  await page.keyboard.press('Space');
  await expect(structures).not.toBeChecked();
  await page.keyboard.press('Escape');
  await expect(layerButton).toBeFocused();
  await expect(layerButton).toHaveAttribute('aria-expanded', 'false');

  const dataButton = page.locator('[data-city-data]');
  await dataButton.focus();
  await page.keyboard.press('Enter');
  await expect(dataButton).toHaveAttribute('aria-expanded', 'true');
  await layerButton.focus();
  await page.keyboard.press('Enter');
  await expect(layerButton).toHaveAttribute('aria-expanded', 'true');
  await expect(dataButton).toHaveAttribute('aria-expanded', 'false');

  const timeline = page.locator('[data-city-timeline]');
  await timeline.focus();
  await page.keyboard.press('End');
  await expect(page.locator('[data-city-day]')).toHaveText('210');
});

test('Cityview retains a visible keyboard focus indicator in forced-colors mode', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Forced-colors runs once in Chromium.');
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  await page.goto('/cityview.html?mode=sandbox&seed=forced-colors-contract', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-city-stage]')).toHaveAttribute('aria-busy', 'false');

  const timeline = page.locator('[data-city-timeline]');
  await timeline.focus();
  const focusStyle = await timeline.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      outlineStyle: style.outlineStyle,
      outlineWidth: Number.parseFloat(style.outlineWidth),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  expect(focusStyle.outlineStyle).not.toBe('none');
  expect(focusStyle.outlineWidth).toBeGreaterThanOrEqual(2);
  expect(focusStyle.overflow).toBeLessThanOrEqual(1);
  await page.keyboard.press('End');
  await expect(page.locator('[data-city-day]')).toHaveText('210');
});

test('Cityview restores once, then falls back truthfully after a repeated context loss', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Context-loss recovery runs once in Chromium.');
  await page.addInitScript(() => sessionStorage.removeItem('afflatus:webgl-losses:v1'));
  await page.goto('/cityview.html?mode=sandbox&seed=context-city', { waitUntil: 'domcontentloaded' });

  const canvas = page.locator('[data-city-canvas]');
  await expect(canvas).toHaveAttribute('data-renderer', 'webgl');
  const available = await page.evaluate(() => {
    const target = document.querySelector('[data-city-canvas]');
    const gl = target?.getContext('webgl2') || target?.getContext('webgl');
    window.__cityLoseContext = gl?.getExtension('WEBGL_lose_context');
    return Boolean(window.__cityLoseContext);
  });
  test.skip(!available, 'Browser does not expose WEBGL_lose_context.');

  await page.evaluate(() => window.__cityLoseContext.loseContext());
  await expect(canvas).toHaveAttribute('data-renderer', 'lost');
  await page.evaluate(() => window.__cityLoseContext.restoreContext());
  await expect(canvas).toHaveAttribute('data-renderer', 'webgl');

  await page.locator('[data-city-timeline]').evaluate((element) => {
    element.value = '147';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(page.locator('[data-city-day]')).toHaveText('147');

  await page.evaluate(() => window.__cityLoseContext.loseContext());
  await expect(canvas).toHaveAttribute('data-renderer', 'poster');
  await expect(page.locator('[data-city-play]')).toBeDisabled();
  await expect(page.locator('[data-city-tour]')).toBeDisabled();
  await page.locator('[data-city-timeline]').evaluate((element) => {
    element.value = '105';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(page.locator('[data-city-day]')).toHaveText('105');
  await page.locator('[data-city-data]').click();
  await expect(page.locator('[data-city-metric="completion"]')).not.toHaveText('0%');
});

test('Cityview starts paused when initially hidden and renders after visibility returns', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Initial hidden lifecycle runs once in Chromium.');
  await page.addInitScript(() => {
    let hidden = true;
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => hidden,
    });
    Object.defineProperty(window, '__setCityDocumentHidden', {
      configurable: true,
      value(next) {
        hidden = Boolean(next);
        document.dispatchEvent(new Event('visibilitychange'));
      },
    });
  });
  await page.goto('/cityview.html?mode=sandbox&seed=initial-hidden-contract', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-city-stage]')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('[data-city-canvas]')).toHaveAttribute('data-renderer', 'webgl');
  expect(await page.evaluate(() => window.__AFFLATUS_CITYVIEW__?.getTelemetry())).toMatchObject({
    active: false,
    p95Ms: 0,
  });

  await page.evaluate(() => window.__setCityDocumentHidden(false));
  await expect.poll(
    () => page.evaluate(() => window.__AFFLATUS_CITYVIEW__?.getTelemetry()?.active),
  ).toBe(true);
  await expect.poll(
    () => page.evaluate(() => window.__AFFLATUS_CITYVIEW__?.getTelemetry()?.drawCalls ?? 0),
  ).toBeGreaterThan(0);
});

test('Cityview starts paused when initially off-screen and renders after intersection', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Initial off-screen lifecycle runs once in Chromium.');
  await page.addInitScript(() => {
    class ControlledIntersectionObserver {
      constructor(callback) {
        this.callback = callback;
        this.targets = new Set();
        window.__cityIntersectionObserver = this;
      }

      observe(target) {
        this.targets.add(target);
        queueMicrotask(() => this.emit(false));
      }

      unobserve(target) {
        this.targets.delete(target);
      }

      disconnect() {
        this.targets.clear();
      }

      emit(isIntersecting) {
        this.callback([...this.targets].map((target) => ({
          target,
          isIntersecting,
          intersectionRatio: isIntersecting ? 1 : 0,
        })));
      }
    }
    window.IntersectionObserver = ControlledIntersectionObserver;
  });
  await page.goto('/cityview.html?mode=sandbox&seed=initial-offscreen-contract', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-city-stage]')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('[data-city-canvas]')).toHaveAttribute('data-renderer', 'webgl');
  expect(await page.evaluate(() => window.__AFFLATUS_CITYVIEW__?.getTelemetry())).toMatchObject({
    active: false,
    p95Ms: 0,
  });

  await page.evaluate(() => window.__cityIntersectionObserver.emit(true));
  await expect.poll(
    () => page.evaluate(() => window.__AFFLATUS_CITYVIEW__?.getTelemetry()?.active),
  ).toBe(true);
  await expect.poll(
    () => page.evaluate(() => window.__AFFLATUS_CITYVIEW__?.getTelemetry()?.drawCalls ?? 0),
  ).toBeGreaterThan(0);
});

test('Cityview tour returns control with Escape and exposes read-only telemetry', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Camera takeover contract runs once in Chromium.');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/cityview.html?mode=sandbox&seed=tour-contract', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-city-stage]')).toHaveAttribute('aria-busy', 'false');

  const tour = page.locator('[data-city-tour]');
  const play = page.locator('[data-city-play]');
  const timeline = page.locator('[data-city-timeline]');
  await play.click();
  await expect.poll(async () => Number(await page.locator('[data-city-day]').textContent())).toBeGreaterThan(0);
  await timeline.focus();
  await expect(play).toHaveAttribute('aria-pressed', 'false');
  const focusedDay = Number(await page.locator('[data-city-day]').textContent());
  expect(Number(await timeline.inputValue())).toBe(focusedDay);

  const dataButton = page.locator('[data-city-data]');
  const dataPanel = page.locator('[data-city-data-panel]');
  await dataButton.click();
  await expect(dataPanel).toBeVisible();
  await tour.click();
  await expect(tour).toHaveAttribute('aria-pressed', 'true');
  await expect(tour.locator('[data-city-tour-label]')).toHaveText('Exit tour');
  await expect(dataPanel).toBeHidden();

  await page.keyboard.press('Escape');
  await expect(tour).toHaveAttribute('aria-pressed', 'false');
  await expect(tour).toBeFocused();
  await expect(dataPanel).toBeVisible();
  await expect(play).toHaveAttribute('aria-pressed', 'true');
  await play.click();
  await timeline.evaluate((element) => {
    element.value = '147';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(page.locator('[data-city-day]')).toHaveText('147');

  const telemetry = await page.evaluate(() => window.__AFFLATUS_CITYVIEW__?.getTelemetry());
  expect(telemetry).toMatchObject({ tourActive: false, active: true });
  expect(telemetry.drawCalls).toBeGreaterThan(0);
  expect(telemetry.triangles).toBeGreaterThan(0);
  expect(telemetry.facadeInstances.strips).toBeGreaterThan(0);
  expect(telemetry.structureLineSegments).toBeGreaterThan(0);
  expect(telemetry.curveLineDensity.radialSegments).toBeGreaterThanOrEqual(8);
});

test('Cityview settles active construction and tour when reduced motion turns on', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Dynamic reduced-motion runs once in Chromium.');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/cityview.html?mode=sandbox&seed=dynamic-motion-contract', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-city-stage]')).toHaveAttribute('aria-busy', 'false');
  await expect.poll(
    () => page.evaluate(() => window.__AFFLATUS_CITYVIEW__?.getTelemetry()?.p95Ms ?? 0),
  ).toBeGreaterThan(0);

  const dataButton = page.locator('[data-city-data]');
  const dataPanel = page.locator('[data-city-data-panel]');
  const tour = page.locator('[data-city-tour]');
  await dataButton.click();
  await tour.click();
  await expect(tour).toHaveAttribute('aria-pressed', 'true');
  await expect(dataPanel).toBeHidden();
  await expect.poll(
    async () => Number(await page.locator('[data-city-day]').textContent()),
  ).toBeGreaterThan(0);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('[data-city-day]')).toHaveText('210');
  await expect(tour).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('[data-city-play]')).toHaveAttribute('aria-pressed', 'false');
  await expect(dataPanel).toBeVisible();
  await expect.poll(
    () => page.evaluate(() => window.__AFFLATUS_CITYVIEW__?.getTelemetry()?.reducedMotion),
  ).toBe(true);
  expect(await page.evaluate(() => window.__AFFLATUS_CITYVIEW__?.getTelemetry())).toMatchObject({
    playing: false,
    tourActive: false,
    environment: { motionFrozen: true },
  });
});

test('Cityview migrates profile=sandbox to the explicit Sandbox mode and announces it once', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Legacy profile migration runs once in Chromium.');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/cityview.html?seed=legacy-sandbox-link&profile=sandbox', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-city-stage]')).toHaveAttribute('aria-busy', 'false');
  await expect(page).toHaveURL(/profile=shanghai/);
  await expect(page).toHaveURL(/mode=sandbox/);
  await expect(page.locator('[data-city-profile]')).toHaveValue('shanghai');
  await expect(page.locator('[data-city-profile]')).toBeDisabled();
  await expect(page.locator('[data-city-truth-mode]')).toHaveValue('sandbox');
  await expect(page.locator('[data-city-profile] option')).toHaveCount(3);
  await expect(page.locator('[data-city-status]')).toContainText('legacy profile=sandbox link');
  expect(await page.evaluate(() => window.__AFFLATUS_CITYVIEW__?.getPlanSummary())).toMatchObject({
    seed: 'legacy-sandbox-link',
    profile: 'sandbox',
    truthMode: 'sandbox',
    truthClass: 'generated-sandbox',
  });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-city-stage]')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('[data-city-status]')).not.toContainText('legacy profile=sandbox link');
});

test('Cityview fails real cities closed and mounts generated geometry only in Sandbox', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Truth-mode contract runs once in Chromium.');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/cityview.html?seed=truth-contract&profile=shanghai', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-city-stage]')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('[data-city-stage]')).toHaveAttribute('data-city-surface', 'unavailable');
  await expect(page.locator('[data-city-canvas]')).toHaveAttribute('data-renderer', 'poster');
  await expect(page.locator('[data-city-profile]')).toHaveValue('shanghai');
  await expect(page.locator('[data-city-profile]')).toBeEnabled();
  await expect(page.locator('[data-city-truth-mode]')).toHaveValue('reality');
  await expect(page.locator('[data-city-profile-note]')).toContainText('Reality package unavailable');
  await expect(page.locator('[data-city-timeline]').locator('..')).toBeHidden();
  await expect(page.locator('[data-city-rebuild]')).toBeHidden();
  await expect(page.locator('[data-city-seed]')).toHaveText('not loaded');
  expect(await page.evaluate(() => window.__AFFLATUS_CITYVIEW__?.getTelemetry())).toBeNull();
  expect(await page.evaluate(() => window.__AFFLATUS_CITYVIEW__?.getPlanSummary())).toMatchObject({
    seed: null,
    profile: 'shanghai',
    truthMode: 'reality',
    truthClass: 'real-city-unavailable',
    availability: 'unavailable',
    blocks: 0,
    roads: 0,
    buildings: 0,
    heroLandmarks: 0,
  });
  expect(await page.evaluate(() => window.__AFFLATUS_CITYVIEW__?.getTruthState())).toMatchObject({
    mode: 'reality',
    profile: 'shanghai',
    surface: 'unavailable',
    available: false,
    blockers: [
      'profile-unapproved',
      'external-data-blocked',
      'licence-review-required',
      'production-package-missing',
    ],
  });

  await Promise.all([
    page.waitForURL((url) => url.searchParams.get('profile') === 'hong-kong'),
    page.locator('[data-city-profile]').selectOption('hong-kong'),
  ]);
  await expect(page.locator('[data-city-stage]')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('[data-city-profile]')).toHaveValue('hong-kong');
  await expect(page.locator('[data-city-profile-note]')).toContainText('Reality package unavailable');
  await expect(page.locator('[data-city-canvas]')).toHaveAttribute('data-renderer', 'poster');

  await Promise.all([
    page.waitForURL((url) => url.searchParams.get('mode') === 'construction-scenario'),
    page.locator('[data-city-truth-mode]').selectOption('construction-scenario'),
  ]);
  await expect(page.locator('[data-city-stage]')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('[data-city-profile-note]')).toContainText('Construction scenario package unavailable');
  await expect(page.locator('[data-city-canvas]')).toHaveAttribute('data-renderer', 'poster');
  expect(await page.evaluate(() => window.__AFFLATUS_CITYVIEW__?.getPlanSummary())).toMatchObject({
    profile: 'hong-kong',
    truthMode: 'construction-scenario',
    truthClass: 'real-city-unavailable',
  });

  await Promise.all([
    page.waitForURL((url) => url.searchParams.get('mode') === 'sandbox'),
    page.locator('[data-city-truth-mode]').selectOption('sandbox'),
  ]);
  await expect(page.locator('[data-city-stage]')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('[data-city-stage]')).toHaveAttribute('data-city-surface', 'sandbox');
  await expect(page.locator('[data-city-profile]')).toBeDisabled();
  await expect(page.locator('[data-city-profile-note]')).toContainText('generated synthetic fixture—not a real city');
  await expect(page.locator('[data-city-timeline]').locator('..')).toBeVisible();
  await expect(page.locator('[data-city-rebuild]')).toBeVisible();
  expect(await page.evaluate(() => window.__AFFLATUS_CITYVIEW__?.getPlanSummary())).toMatchObject({
    seed: 'truth-contract',
    profile: 'sandbox',
    truthMode: 'sandbox',
    truthClass: 'generated-sandbox',
    availability: 'available',
  });
});

test('Cityview streams a registry-approved CityPackage through the production renderer', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await installProductionCityPackageFixture(page);
  await page.goto('/cityview.html?profile=melbourne', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-city-stage]')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('[data-city-stage]')).toHaveAttribute('data-city-surface', 'production');
  await expect(page.locator('[data-city-stage]')).toHaveAttribute('data-city-package-session', 'ready');
  await expect(page.locator('[data-city-stage]')).toHaveAttribute('data-city-truth-class', 'licensed-real-data');
  await expect(page.locator('[data-city-canvas]')).toHaveAttribute('data-renderer', 'webgl');
  await expect(page.locator('[data-city-profile-note]')).toContainText('verified Reality package');
  await expect(page.locator('[data-city-environment-picker]')).toBeVisible();
  await expect(page.locator('[data-city-production-environment]')).toBeEnabled();
  await expect(page.locator('[data-city-production-view-picker]')).toBeVisible();
  await expect(page.locator('[data-city-production-view]')).toBeEnabled();
  await expect(page.locator('[data-city-production-view] > option')).toHaveCount(5);
  await expect(page.locator('[data-city-production-view]')).toHaveValue('browser-fixture-view-1');
  await expect(page.locator('[data-city-stage]')).toHaveAttribute(
    'data-city-canonical-view',
    'browser-fixture-view-1',
  );
  await expect(page.locator('[data-city-production-provenance]')).toBeVisible();
  await expect(page.locator('[data-city-production-provenance-list] > li')).toHaveCount(7);
  const summary = await page.evaluate(() => window.__AFFLATUS_CITYVIEW__?.getPlanSummary());
  expect(summary).toMatchObject({
    profile: 'melbourne',
    truthMode: 'reality',
    truthClass: 'licensed-real-data',
    availability: 'available',
  });
  expect(summary.firstFrameTiles).toBeGreaterThan(0);
  expect(summary.firstFrameBytes).toBeGreaterThan(0);
  expect(summary.firstFrameDrawCalls).toBeGreaterThan(0);

  await page.locator('[data-city-production-view]').selectOption('browser-fixture-view-2');
  await expect(page.locator('[data-city-status]')).toContainText('Classic view: Classic view 2');
  await expect(page.locator('[data-city-stage]')).toHaveAttribute(
    'data-city-canonical-view',
    'browser-fixture-view-2',
  );
  const viewTelemetry = await page.evaluate(() => window.__AFFLATUS_CITYVIEW__?.getTelemetry());
  expect(viewTelemetry).toMatchObject({
    primaryTileId: 'tile-c00-r03',
    camera: {
      target: { x: -125, y: 18, z: 375 },
      verticalFovDegrees: 43,
    },
  });
  expect(viewTelemetry.camera.position.x).toBeCloseTo(800, 8);
  expect(viewTelemetry.camera.position.y).toBeCloseTo(480, 8);
  expect(viewTelemetry.camera.position.z).toBeCloseTo(1050, 8);
  expect(await page.evaluate(() => window.__AFFLATUS_CITYVIEW__?.getProductionView())).toMatchObject({
    id: 'browser-fixture-view-2',
    labels: { en: 'Classic view 2', zh: '经典视角 2' },
  });

  await page.locator('[data-city-production-environment]').selectOption('night');
  await expect(page.locator('[data-city-status]')).toContainText('environment: night');
  const telemetry = await page.evaluate(() => window.__AFFLATUS_CITYVIEW__?.getTelemetry());
  expect(telemetry).toMatchObject({
      packageId: 'melbourne-flinders-federation-v1',
      environment: {
        styleId: 'melbourne-night-v1',
        pbr: true,
        imageBasedLighting: true,
        outdoorIbl: true,
        atmosphereProfileId: 'melbourne-night-atmosphere-v1',
        transitionMode: 'solar-altitude-continuous',
        boundedShadows: true,
        wholeBuildingEmission: false,
        waterProfileId: 'melbourne-water-visual-v1',
        waterVisualBasis: 'art-directed-visual-only',
        nightLightBasis: 'authored-light-geometry-only',
      },
    });
  expect(telemetry.environment.windowLightingMaterials).toBeGreaterThan(0);
  expect(telemetry.environment.physicalWaterMaterials).toBeGreaterThan(0);
  expect(telemetry.environment.animatedWaterSpecular).toBe(true);
  expect(telemetry.environment.waterFlowDirection.x).toBeLessThan(-0.9);
  expect(telemetry.environment.authoredNightLightMaterials).toBeGreaterThan(0);
  expect(telemetry.environment.aviationLightMaterials).toBeGreaterThan(0);
  expect(telemetry.environment.streetLightMaterials).toBe(0);
  expect(telemetry.environment.landmarkLightMaterials).toBe(0);

  await page.evaluate(() => window.__AFFLATUS_CITYVIEW__?.setProductionEnvironment(
    'auto-local',
    '2026-01-15T09:30:00.000Z',
  ));
  const twilightTelemetry = await page.evaluate(
    () => window.__AFFLATUS_CITYVIEW__?.getTelemetry().environment,
  );
  expect(twilightTelemetry).toMatchObject({
    environment: 'sunset',
    transitionMode: 'solar-altitude-continuous',
    atmosphereProfileId: 'melbourne-sunset-atmosphere-v1',
  });
  expect(twilightTelemetry.solarBlend.sunset).toBeGreaterThan(0.5);
  expect(
    twilightTelemetry.solarBlend.day
    + twilightTelemetry.solarBlend.sunset
    + twilightTelemetry.solarBlend.night,
  ).toBeCloseTo(1, 8);
  expect(await page.evaluate(
    () => window.__AFFLATUS_CITYVIEW__?.getProductionAutoLocalState(),
  )).toMatchObject({
    selectedRequest: 'auto-local',
    active: true,
    paused: false,
    intervalMs: 60_000,
  });

  await page.evaluate(() => window.__AFFLATUS_CITYVIEW__?.setProductionEnvironment('day'));
  expect(await page.evaluate(
    () => window.__AFFLATUS_CITYVIEW__?.getProductionAutoLocalState(),
  )).toMatchObject({ selectedRequest: 'day', active: false });
});

test('Cityview fails a corrupt production tile closed without mounting Sandbox geometry', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Injected production corruption runs once in Chromium.');
  await installProductionCityPackageFixture(page, { corruptFirstGlb: true });
  await page.goto('/cityview.html?profile=melbourne', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-city-stage]')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('[data-city-stage]')).toHaveAttribute('data-city-surface', 'unavailable');
  await expect(page.locator('[data-city-stage]')).toHaveAttribute('data-city-package-session', 'fallback');
  await expect(page.locator('[data-city-stage]')).toHaveAttribute(
    'data-city-package-failure',
    'first-frame-tile-load-failed',
  );
  await expect(page.locator('[data-city-canvas]')).toHaveAttribute('data-renderer', 'poster');
  expect(await page.evaluate(() => window.__AFFLATUS_CITYVIEW__?.getTelemetry())).toBeNull();
  expect(await page.evaluate(() => window.__AFFLATUS_CITYVIEW__?.getPlanSummary())).toMatchObject({
    profile: 'melbourne',
    truthClass: 'real-city-unavailable',
    blocks: 0,
    roads: 0,
    buildings: 0,
  });
});

test('Cityview retains the verified camera and tiles when a classic-view stream is corrupt', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Injected view-stream corruption runs once in Chromium.');
  await installProductionCityPackageFixture(page, { corruptViewSwitchTile: true });
  await page.goto('/cityview.html?profile=melbourne', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-city-stage]')).toHaveAttribute('data-city-package-session', 'ready');
  const before = await page.evaluate(() => window.__AFFLATUS_CITYVIEW__?.getTelemetry());

  await page.locator('[data-city-production-view]').selectOption('browser-fixture-view-2');
  await expect(page.locator('[data-city-status]')).toContainText(
    'the previous verified camera and tile set remain active',
  );
  await expect(page.locator('[data-city-production-view]')).toHaveValue('browser-fixture-view-1');
  await expect(page.locator('[data-city-stage]')).toHaveAttribute(
    'data-city-canonical-view',
    'browser-fixture-view-1',
  );
  await expect(page.locator('[data-city-stage]')).toHaveAttribute('data-city-surface', 'production');
  const after = await page.evaluate(() => window.__AFFLATUS_CITYVIEW__?.getTelemetry());
  expect(after.primaryTileId).toBe(before.primaryTileId);
  expect(after.resolvedTileIds).toEqual(before.resolvedTileIds);
  expect(after.camera.position.x).toBeCloseTo(before.camera.position.x, 8);
  expect(after.camera.position.y).toBeCloseTo(before.camera.position.y, 8);
  expect(after.camera.position.z).toBeCloseTo(before.camera.position.z, 8);
  expect(after.camera.target).toEqual(before.camera.target);
  expect(after.camera.verticalFovDegrees).toBe(before.camera.verticalFovDegrees);
});

test('Cityview physical-device audit stays opt-in and exports a local review artifact', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'The audit recorder contract runs once; physical sign-off remains manual.');
  await page.addInitScript(() => {
    // Synthetic multi-touch below exercises the recorder rather than the
    // browser input stack, so pointer capture has no corresponding OS pointer.
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
    let hidden = false;
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => hidden,
    });
    Object.defineProperty(window, '__setCityAuditHidden', {
      configurable: true,
      value(next) {
        hidden = Boolean(next);
        document.dispatchEvent(new Event('visibilitychange'));
      },
    });
  });

  await page.goto('/cityview.html?seed=device-audit-contract&profile=hong-kong', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-city-device-audit]')).toBeHidden();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/cityview.html?mode=sandbox&seed=device-audit-contract&profile=hong-kong&device-audit=1', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-city-stage]')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('[data-city-device-audit]')).toBeVisible();
  await expect(page.locator('[data-city-device-start]')).toBeEnabled();
  await page.waitForFunction(
    () => (window.__AFFLATUS_CITYVIEW__?.getTelemetry()?.evaluatedWindows ?? 0) > 0,
    null,
    { timeout: 8_000 },
  );

  await page.locator('[data-city-device-label]').fill('Reference phone / test OS / test browser');
  await page.locator('[data-city-device-start]').click();
  await expect(page.locator('[data-city-device-finish]')).toBeEnabled();

  await page.locator('[data-city-canvas]').evaluate((canvas) => {
    canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 41, pointerType: 'touch', clientX: 120, clientY: 260 }));
    canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 42, pointerType: 'touch', clientX: 190, clientY: 300 }));
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 41, pointerType: 'touch' }));
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 42, pointerType: 'touch' }));
  });
  await page.locator('[data-city-timeline]').evaluate((element) => {
    element.value = '147';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.locator('[data-city-play]').click();
  await page.locator('[data-city-tour]').click();
  await page.locator('.city-lang').click();
  await expect(page.locator('#city-device-audit-title')).toHaveText('实体真机证据');
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  await page.evaluate(() => window.__setCityAuditHidden(true));
  await page.evaluate(() => window.__setCityAuditHidden(false));
  await page.setViewportSize({ width: 844, height: 390 });
  await page.evaluate(() => window.scrollTo(0, 180));
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    for (let index = 0; index < 35; index += 1) {
      window.__AFFLATUS_CITY_DEVICE_AUDIT__.captureSample('e2e-sample');
    }
  });

  const downloadPromise = page.waitForEvent('download');
  await page.locator('[data-city-device-finish]').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^cityview-device-sandbox-reference-phone-test-os-test-browser\.json$/);
  const report = await page.evaluate(() => window.__AFFLATUS_CITY_DEVICE_AUDIT__.getReport());
  await testInfo.attach('cityview-device-audit.json', {
    body: Buffer.from(`${JSON.stringify(report, null, 2)}\n`),
    contentType: 'application/json',
  });
  console.info('[city-device-audit]', JSON.stringify({
    readyForReview: report.readyForReview,
    checks: report.checks,
  }));
  expect(report).toMatchObject({
    schemaVersion: 'city-device-audit-v1',
    truthClass: 'physical-device-observation—not benchmark certification',
    privacy: 'local JSON export only; the page does not upload this report',
    profile: 'sandbox',
    seed: 'device-audit-contract',
    readyForReview: true,
  });
  expect(Object.values(report.checks).every(({ passed }) => passed)).toBe(true);
  expect(report.summary.renderSamples).toBeGreaterThanOrEqual(30);
  expect(report.summary.fallbackSamples).toBe(0);
  expect(report.interactions).toMatchObject({
    backgroundTransitions: 2,
    buildActions: 1,
    maxConcurrentTouchPointers: 2,
    timelineScrubs: 1,
    tourActions: 1,
  });
});
