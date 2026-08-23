import { expect, test } from './site-fixture.js';

const screenshotRoot = 'docs/refactor/screenshots';

async function waitForHome(page, path) {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('.signature-experience .chapter-poster')).toBeVisible();
}

test.describe('M06 deferred single-canvas experience', () => {
  test('paints DOM and Poster before the deferred scene and keeps CLS stable', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.addInitScript(() => {
      window.__m06LayoutShift = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) window.__m06LayoutShift += entry.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });
    });

    let sceneChunkRequested = false;
    await page.route('**/assets/SignatureScene-*.js', async (route) => {
      sceneChunkRequested = true;
      await new Promise((resolve) => setTimeout(resolve, 350));
      await route.continue();
    });

    await waitForHome(page, '/?experience=cinematic');
    await expect(page.locator('.signature-experience')).toHaveAttribute('data-scene-status', /scheduled|loading/);
    await expect.poll(() => sceneChunkRequested).toBe(true);
    await expect(page.locator('.signature-experience canvas')).toHaveCount(0);

    const root = page.locator('.signature-experience');
    await expect(root).toHaveAttribute('data-scene-status', 'ready', { timeout: 12_000 });
    await expect(root).toHaveAttribute('data-quality-profile', /high|medium/);
    const canvas = root.locator('canvas');
    await expect(canvas).toHaveCount(1);
    await expect(canvas).toHaveAttribute('aria-hidden', 'true');
    await expect(canvas).toHaveAttribute('tabindex', '-1');
    await expect(page.locator('canvas')).toHaveCount(1);

    const geometry = await page.evaluate(() => {
      const scene = document.querySelector('.signature-scene').getBoundingClientRect();
      return {
        scene: [scene.width, scene.height],
        shift: window.__m06LayoutShift,
        viewport: [window.innerWidth, window.innerHeight],
      };
    });
    expect(Math.abs(geometry.scene[0] - geometry.viewport[0])).toBeLessThanOrEqual(1);
    expect(Math.abs(geometry.scene[1] - geometry.viewport[1])).toBeLessThanOrEqual(1);
    expect(geometry.shift).toBeLessThanOrEqual(0.01);
    await page.screenshot({ path: `${screenshotRoot}/m06-cinematic-desktop-1440x1000.png` });
  });

  test('consumes scene intent without coupling the command component to Three.js', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await waitForHome(page, '/?experience=cinematic');
    await expect(page.locator('.signature-experience')).toHaveAttribute('data-scene-status', 'ready');

    const intent = page.evaluate(() => new Promise((resolve) => {
      document.addEventListener('afflatus:scene-signal', (event) => resolve(event.detail), { once: true });
    }));
    await page.getByRole('button', { name: 'Enter Command' }).click();
    await expect(intent).resolves.toMatchObject({ signal: 'command:open', phase: 'intent' });
    await expect(page.getByRole('dialog')).toBeVisible();
    const metrics = await page.evaluate(() => window.__AFFLATUS_M11__.getMetrics());
    expect(metrics.lastSceneSignal).toBe('command:open');
  });

  test('pauses on visibility loss, resumes smoothly, and falls back on context loss', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await waitForHome(page, '/?experience=cinematic');
    const root = page.locator('.signature-experience');
    await expect(root).toHaveAttribute('data-scene-status', 'ready');
    await expect(page.locator('.signature-scene')).toHaveAttribute('data-raf', 'running');

    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(root).toHaveAttribute('data-scene-status', 'paused');
    await expect(page.locator('.signature-scene')).toHaveAttribute('data-raf', 'paused');

    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: false });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(root).toHaveAttribute('data-scene-status', 'ready');
    await expect(page.locator('.signature-scene')).toHaveAttribute('data-raf', 'running');

    await page.locator('canvas').dispatchEvent('webglcontextlost', { cancelable: true });
    await expect(page.locator('html')).toHaveAttribute('data-experience-mode', 'static');
    await expect(page.locator('.signature-experience')).toHaveAttribute('data-quality-profile', 'static');
    await expect(page.locator('canvas')).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('reconciles the viewport profile without adding a second Canvas', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await waitForHome(page, '/?experience=cinematic');
    const root = page.locator('.signature-experience');
    await expect(root).toHaveAttribute('data-scene-status', 'ready');
    await expect(page.locator('canvas')).toHaveCount(1);

    await page.setViewportSize({ width: 320, height: 700 });
    await expect(root).toHaveAttribute('data-quality-profile', 'static');
    await expect(root).toHaveAttribute('data-scene-status', 'poster');
    await expect(page.locator('canvas')).toHaveCount(0);

    await page.setViewportSize({ width: 1000, height: 800 });
    await expect(root).toHaveAttribute('data-quality-profile', 'medium');
    await expect(root).toHaveAttribute('data-scene-status', 'ready');
    await expect(page.locator('canvas')).toHaveCount(1);
  });
});

test.describe('M06 capability fallback profiles', () => {
  test('static and reduced profiles never request Three.js or create a Canvas', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium');
    const sceneRequests = [];
    page.on('request', (request) => {
      if (/SignatureScene|vendor-three/.test(request.url())) sceneRequests.push(request.url());
    });

    await waitForHome(page, '/?experience=static');
    await expect(page.locator('.signature-experience')).toHaveAttribute('data-quality-profile', 'static');
    await expect(page.locator('canvas')).toHaveCount(0);

    await waitForHome(page, '/?experience=reduced');
    await expect(page.locator('.signature-experience')).toHaveAttribute('data-quality-profile', 'reduced');
    await expect(page.locator('.signature-scene')).toHaveCount(0);
    await expect(page.locator('canvas')).toHaveCount(0);
    expect(sceneRequests).toEqual([]);
  });

  test('keeps the complete page when WebGL capability is absent', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium');
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function getContext(type, options) {
        if (String(type).startsWith('webgl')) return null;
        return original.call(this, type, options);
      };
    });
    await waitForHome(page, '/?experience=cinematic');
    await expect(page.locator('html')).toHaveAttribute('data-experience-mode', 'static');
    await expect(page.locator('canvas')).toHaveCount(0);
    await page.getByRole('button', { name: 'Enter Command' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('resource failure returns to Poster without a blocking error', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.route('**/assets/showcase/missing-m06-poster.jpg', (route) => route.fulfill({
      status: 200,
      contentType: 'image/jpeg',
      body: Buffer.from('not-an-image'),
    }));
    await waitForHome(page, '/?experience=cinematic&scene=resource-error');
    await expect(page.locator('html')).toHaveAttribute('data-experience-mode', 'static');
    await expect(page.locator('canvas')).toHaveCount(0);
    await expect(page.locator('.signature-experience .chapter-poster')).toBeVisible();
    await expect(page.locator('.vite-error-overlay')).toHaveCount(0);
  });

  test('uses the mobile profile with the same single Canvas', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'galaxy-s26-ultra-chromium');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await waitForHome(page, '/?experience=cinematic');
    await expect(page.locator('.signature-experience')).toHaveAttribute('data-quality-profile', 'mobile');
    await expect(page.locator('.signature-experience')).toHaveAttribute('data-scene-status', 'ready');
    await expect(page.locator('canvas')).toHaveCount(1);
    await page.screenshot({ path: `${screenshotRoot}/m06-mobile-412x892.png` });
  });

  test('keeps Reduced Motion on the Poster-only path', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-16-pro-max-webkit');
    await waitForHome(page, '/?experience=reduced');
    await expect(page.locator('.signature-experience')).toHaveAttribute('data-quality-profile', 'reduced');
    await expect(page.locator('.signature-experience')).toHaveAttribute('data-scene-status', 'poster');
    await expect(page.locator('canvas')).toHaveCount(0);
    await page.screenshot({ path: `${screenshotRoot}/m06-reduced-poster-440x956.png` });
  });
});
