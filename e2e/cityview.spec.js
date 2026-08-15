import { expect, settlePage, test } from './site-fixture.js';

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
    await expect(page.locator('[data-city-status]')).toContainText('Static city summary ready');
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
    await expect(page.locator('[data-city-status]')).toContainText('Static city summary ready');
    await expect(page.locator('[data-city-play]')).toBeDisabled();
    await expect(page.locator('[data-city-tour]')).toBeDisabled();
    await expect(page.locator('[data-city-timeline]')).toBeDisabled();
    await expect(page.locator('[data-city-data]')).toBeDisabled();
    await expect(page.locator('.city-lang')).toHaveAttribute('href', '/zh/cityview.html');
  } finally {
    await context.close();
  }
});

test('Cityview exposes a deterministic, reversible construction sandbox', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const response = await page.goto('/cityview.html?seed=e2e-city', { waitUntil: 'domcontentloaded' });
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
      actionCount: document.querySelectorAll('.city-action').length,
      actionLabelLines: [...document.querySelectorAll('.city-action > span:last-child')]
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
  expect(contract.actionCount).toBe(7);
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
  await page.goto('/cityview.html?seed=zoom-contract', { waitUntil: 'domcontentloaded' });
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
  await page.goto('/cityview.html?seed=forced-colors-contract', { waitUntil: 'domcontentloaded' });
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
  await page.goto('/cityview.html?seed=context-city', { waitUntil: 'domcontentloaded' });

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
  await page.goto('/cityview.html?seed=initial-hidden-contract', { waitUntil: 'domcontentloaded' });
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
  await page.goto('/cityview.html?seed=initial-offscreen-contract', { waitUntil: 'domcontentloaded' });
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
  await page.goto('/cityview.html?seed=tour-contract', { waitUntil: 'domcontentloaded' });
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
  await page.goto('/cityview.html?seed=dynamic-motion-contract', { waitUntil: 'domcontentloaded' });
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

test('Cityview switches generated Shanghai, Melbourne and Hong Kong concepts without claiming GIS truth', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Concept profile contract runs once in Chromium.');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/cityview.html?seed=profile-contract&profile=shanghai', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-city-stage]')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('[data-city-profile]')).toHaveValue('shanghai');
  await expect(page.locator('[data-city-profile-note]')).toContainText('generated concept');

  let summary = await page.evaluate(() => window.__AFFLATUS_CITYVIEW__?.getPlanSummary());
  expect(summary).toMatchObject({
    profile: 'shanghai',
    truthClass: 'generated-concept',
    waterChannels: 1,
    heroLandmarks: 3,
  });

  const dayBeforeView = await page.locator('[data-city-day]').textContent();
  await page.locator('[data-city-view]').click();
  await expect(page.locator('[data-city-view-label]')).toHaveText('View 1/3');
  await expect(page.locator('[data-city-day]')).toHaveText(dayBeforeView);
  const cameraTelemetry = await page.evaluate(() => window.__AFFLATUS_CITYVIEW__?.getTelemetry());
  expect(cameraTelemetry.cameraRig).toMatchObject({
    heroViews: 3,
    currentHeroView: 'shanghai-stepped-crown-concept',
    currentHeroOcclusions: 0,
    clearanceLift: 0,
  });
  expect(cameraTelemetry.cameraRig.safetyEnvelopes).toBeGreaterThan(0);
  expect(cameraTelemetry.helicopter).toMatchObject({
    moving: false,
  });
  expect(cameraTelemetry.helicopter.height).toBeGreaterThan(175);
  expect(cameraTelemetry.cranes.maxActive).toBe(6);
  expect(cameraTelemetry.cranes.planned).toBeGreaterThan(4);
  expect(cameraTelemetry.cranes.active).toBeLessThanOrEqual(6);
  expect(cameraTelemetry.environment).toMatchObject({
    vehiclesPlanned: 18,
    motionFrozen: true,
  });
  expect(cameraTelemetry.environment.vehiclesVisible).toBeLessThanOrEqual(18);
  expect(cameraTelemetry.environment.treesVisible).toBeLessThanOrEqual(cameraTelemetry.environment.treesPlanned);

  const shanghaiHeroStates = [cameraTelemetry.cameraRig];
  for (let index = 1; index < 3; index += 1) {
    await page.locator('[data-city-view]').click();
    shanghaiHeroStates.push(
      (await page.evaluate(() => window.__AFFLATUS_CITYVIEW__?.getTelemetry())).cameraRig,
    );
  }
  expect(shanghaiHeroStates.map((state) => state.currentHeroView)).toEqual([
    'shanghai-stepped-crown-concept',
    'shanghai-corn-curve-concept',
    'shanghai-pearl-concept',
  ]);
  expect(shanghaiHeroStates.every((state) => state.currentHeroOcclusions === 0)).toBe(true);

  await Promise.all([
    page.waitForURL((url) => url.searchParams.get('profile') === 'melbourne'),
    page.locator('[data-city-profile]').selectOption('melbourne'),
  ]);
  await expect(page.locator('[data-city-stage]')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('[data-city-profile]')).toHaveValue('melbourne');
  summary = await page.evaluate(() => window.__AFFLATUS_CITYVIEW__?.getPlanSummary());
  expect(summary).toMatchObject({
    profile: 'melbourne',
    truthClass: 'generated-concept',
    waterChannels: 1,
    heroLandmarks: 3,
  });

  await Promise.all([
    page.waitForURL((url) => url.searchParams.get('profile') === 'hong-kong'),
    page.locator('[data-city-profile]').selectOption('hong-kong'),
  ]);
  await expect(page.locator('[data-city-stage]')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('[data-city-profile]')).toHaveValue('hong-kong');
  await expect(page.locator('[data-city-profile-note]')).toContainText('generated concept');
  summary = await page.evaluate(() => window.__AFFLATUS_CITYVIEW__?.getPlanSummary());
  expect(summary).toMatchObject({
    profile: 'hong-kong',
    truthClass: 'generated-concept',
    waterChannels: 1,
    heroLandmarks: 3,
  });
  const hongKongTelemetry = await page.evaluate(() => window.__AFFLATUS_CITYVIEW__?.getTelemetry());
  expect(hongKongTelemetry).toMatchObject({
    profile: 'hong-kong',
    truthClass: 'generated-concept',
    heroLandmarks: 3,
    environment: {
      vehiclesPlanned: 26,
      ridgePeaks: 9,
      motionFrozen: true,
    },
  });
  const hongKongHeroIds = [];
  for (let index = 0; index < 3; index += 1) {
    await page.locator('[data-city-view]').click();
    const heroState = (await page.evaluate(() => window.__AFFLATUS_CITYVIEW__?.getTelemetry())).cameraRig;
    expect(heroState.currentHeroOcclusions).toBe(0);
    hongKongHeroIds.push(heroState.currentHeroView);
  }
  expect(new Set(hongKongHeroIds)).toEqual(new Set([
    'hong-kong-harbour-fin-concept',
    'hong-kong-stepped-harbour-crown-concept',
    'hong-kong-waterfront-cultural-podium-concept',
  ]));
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
  await page.goto('/cityview.html?seed=device-audit-contract&profile=hong-kong&device-audit=1', { waitUntil: 'domcontentloaded' });
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
  expect(download.suggestedFilename()).toMatch(/^cityview-device-hong-kong-reference-phone-test-os-test-browser\.json$/);
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
    profile: 'hong-kong',
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
