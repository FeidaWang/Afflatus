import { expect, settlePage, test } from './site-fixture.js';

const ROUTES = [
  ['/', 'home'],
  ['/arena.html', 'arena'],
  ['/sectors.html', 'sectors'],
  ['/signal.html', 'signal'],
  ['/stats.html', 'stats'],
  ['/horoscope.html', 'horoscope'],
  ['/serial.html', 'serial'],
  ['/course.html', 'course'],
  ['/cityview.html', 'cityview'],
  ['/boot.html', 'boot'],
];

const FOLLOWING_ROUTES = ROUTES
  .map(([route]) => route)
  .filter((route) => !['/', '/serial.html', '/course.html', '/cityview.html', '/boot.html'].includes(route));
const MOBILE_NAV_ROUTES = ROUTES
  .map(([route]) => route)
  .filter((route) => !['/', '/boot.html'].includes(route));

test.describe('Afflatus adaptive brand', () => {
  test.use({ reducedMotion: 'no-preference' });

  for (const [route, persona] of ROUTES) {
    test(`${route} resolves into its page-native AI identity`, async ({ page }) => {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await settlePage(page);

      const brand = page.locator(`a[data-afflatus-brand][data-brand-persona="${persona}"]`);
      await expect(brand).toBeVisible();

      await page.evaluate(() => {
        document.documentElement.dataset.afflatusBrandState = 'compact';
      });

      const rendered = await brand.evaluate((element) => {
        const stage = element.querySelector('.afflatus-brand__stage');
        const letterI = element.querySelector('.afflatus-brand__l');
        const bounds = element.getBoundingClientRect();
        return {
          animationName: getComputedStyle(stage).animationName,
          fontFamily: getComputedStyle(stage).fontFamily,
          iContent: getComputedStyle(letterI, '::after').content,
          iOpacity: getComputedStyle(letterI, '::after').opacity,
          withinViewport: bounds.left >= -1 && bounds.right <= innerWidth + 1,
        };
      });

      expect(rendered.animationName).toContain(`afflatus-${persona}-resolve`);
      expect(rendered.fontFamily).toBeTruthy();
      expect(rendered.iContent).toContain('I');
      expect(rendered.iOpacity).toBe('1');
      expect(rendered.withinViewport).toBe(true);
    });
  }

  for (const route of FOLLOWING_ROUTES) {
    test(`${route} expands only at the top and keeps the header attached`, async ({ page }) => {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await settlePage(page);

      const brand = page.locator('a[data-afflatus-brand]');
      const header = brand.locator('xpath=ancestor::*[contains(concat(" ", normalize-space(@class), " "), " site-header--follow ")][1]');
      await expect(brand).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('data-afflatus-brand-state', 'full');

      const enterArena = page.locator('#bfEnter');
      if (await enterArena.isVisible()) await enterArena.click();

      const position = await header.evaluate((element) => getComputedStyle(element).position);
      expect(['fixed', 'sticky']).toContain(position);

      await page.evaluate(() => scrollTo(0, 180));
      await expect(page.locator('html')).toHaveAttribute('data-afflatus-brand-state', 'compact');
      await expect.poll(async () => {
        const box = await header.boundingBox();
        return Math.round(box?.y ?? -1);
      }).toBeGreaterThanOrEqual(-1);

      await page.evaluate(() => scrollTo(0, 0));
      await expect(page.locator('html')).toHaveAttribute('data-afflatus-brand-state', 'full');
    });
  }
});

test.describe('Afflatus reduced motion brand', () => {
  test.use({ reducedMotion: 'reduce' });

  test('compact identity remains legible without motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    // Arena owns the standard document scroll container on every project;
    // Serial's mobile reader intentionally keeps its header expanded.
    await page.goto('/arena.html', { waitUntil: 'domcontentloaded' });
    await expect.poll(() => page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
    await page.evaluate(() => scrollTo(0, 180));
    await expect(page.locator('html')).toHaveAttribute('data-afflatus-brand-state', 'compact');

    const brand = page.locator('a[data-afflatus-brand]');
    await expect(brand).toBeVisible();
    const reduced = await brand.evaluate((element) => {
      const stage = element.querySelector('.afflatus-brand__stage');
      const signal = element.querySelector('.afflatus-brand__signal');
      const letterI = element.querySelector('.afflatus-brand__l');
      return {
        stageAnimation: getComputedStyle(stage).animationName,
        signalAnimation: getComputedStyle(signal).animationName,
        iContent: getComputedStyle(letterI, '::after').content,
        iOpacity: getComputedStyle(letterI, '::after').opacity,
      };
    });

    expect(reduced.stageAnimation).toBe('none');
    expect(reduced.signalAnimation).toBe('none');
    expect(reduced.iContent).toContain('I');
    expect(reduced.iOpacity).toBe('1');
  });
});

test.describe('Mobile primary navigation', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const route of MOBILE_NAV_ROUTES) {
    test(`${route} keeps every primary action visible and touchable`, async ({ page }) => {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await settlePage(page);

      const nav = page.locator('.site-header--follow > .nav');
      await expect(nav).toBeVisible();
      await expect(nav.locator(':scope > *')).toHaveCount(route === '/serial.html' ? 5 : 6);

      const audit = await nav.evaluate((element) => {
        const header = element.closest('.site-header--follow');
        const brand = header?.querySelector('[data-afflatus-brand]');
        const navBounds = element.getBoundingClientRect();
        const brandBounds = brand?.getBoundingClientRect();
        const children = [...element.children].map((child) => {
          const target = child.matches('a, button') ? child : child.querySelector('a, button');
          const bounds = target.getBoundingClientRect();
          return {
            left: bounds.left,
            right: bounds.right,
            height: bounds.height,
          };
        });
        return {
          overflow: element.scrollWidth - element.clientWidth,
          brandNavOverlap: brandBounds ? Math.max(0, brandBounds.bottom - navBounds.top) : 0,
          children,
        };
      });

      expect(audit.overflow).toBeLessThanOrEqual(1);
      expect(audit.brandNavOverlap).toBeLessThanOrEqual(1);
      for (const item of audit.children) {
        expect(item.left).toBeGreaterThanOrEqual(-1);
        expect(item.right).toBeLessThanOrEqual(391);
        expect(item.height).toBeGreaterThanOrEqual(44);
      }
    });
  }
});

test.describe('Homepage following command bar', () => {
  test('keeps Voyage Notes fully inside the viewport when opened', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'Desktop CIC geometry regression');
    await page.setViewportSize({ width: 1512, height: 827 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await settlePage(page);

    await page.locator('#commandModeBtn').click();
    await expect(page.locator('body')).not.toHaveClass(/hud-off/);
    await page.locator('#voyageLogToggle').click();

    const consolePanel = page.locator('#cicVoyageConsole');
    await expect(consolePanel).toBeVisible();
    await expect(consolePanel).toHaveAttribute('aria-hidden', 'false');
    const panelBounds = await consolePanel.boundingBox();
    const viewport = page.viewportSize();

    expect(panelBounds).not.toBeNull();
    expect(viewport).not.toBeNull();
    expect(panelBounds.y).toBeGreaterThanOrEqual(-1);
    expect(panelBounds.y + panelBounds.height).toBeLessThanOrEqual(viewport.height + 1);
    await expect(page.locator('#voyageLogClose')).toBeInViewport();
  });

  test('stays fixed through the allocation deck without leaking private amounts', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await settlePage(page);

    const header = page.locator('nav.site-header--follow');
    await expect(header).toBeVisible();
    expect(await header.evaluate((element) => getComputedStyle(element).position)).toBe('fixed');
    await page.waitForTimeout(500);
    const initialTop = Math.round((await header.boundingBox())?.y ?? -1);

    await page.locator('.holdings').scrollIntoViewIfNeeded();
    await expect.poll(async () => {
      const currentTop = Math.round((await header.boundingBox())?.y ?? -1);
      return Math.abs(currentTop - initialTop) <= 1;
    }).toBe(true);

    const fourthDossier = page.locator('#pickGrid .pick-card').nth(3).locator('.pcCover');
    await fourthDossier.focus();
    await fourthDossier.press('Enter');
    await expect(page.locator('#convoyTicker')).toHaveText('ORCL');
    await expect(page.locator('#convoyProgress')).toHaveText('04 / 10');

    await page.locator('#convoyNodes .convoy-node').nth(6).evaluate((node) => node.click());
    await expect(page.locator('#convoyTicker')).toHaveText('TSM');
    await expect(page.locator('#convoyProgress')).toHaveText('07 / 10');
    await expect(page.locator('.orbit-field')).toHaveAttribute('data-active-body', 'SATURN');
    await expect(page.locator('#convoyNodes .convoy-node.is-active')).toHaveCount(1);
    await expect(page.locator('#convoyNodes .convoy-node.is-active')).toHaveAttribute('data-solar-body', /SATURN|土星/);
    const viewportWidth = await page.evaluate(() => innerWidth);
    if (viewportWidth > 940) {
      await expect(page.locator('.convoy-visual')).toHaveClass(/is-pinned/);
    } else {
      await expect(page.locator('.convoy-visual')).not.toHaveClass(/is-pinned|is-docked/);
    }

    const covers = page.locator('#pickGrid .pick-card .pcCover');
    for (const index of [0, 4, 9]) {
      const cover = covers.nth(index);
      await cover.hover();
      const state = await cover.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          opacity: style.opacity,
          visibility: style.visibility,
          transform: style.transform,
          ticker: element.querySelector('.pick-ticker')?.textContent?.trim(),
        };
      });
      expect(state.opacity).toBe('1');
      expect(state.visibility).toBe('visible');
      expect(['none', 'matrix(1, 0, 0, 1, 0, 0)']).toContain(state.transform);
      expect(state.ticker).toBeTruthy();
    }

    const audit = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - innerWidth,
      picks: document.querySelectorAll('#pickGrid .pick').length,
      nodes: document.querySelectorAll('#convoyNodes .convoy-node').length,
      signals: document.querySelectorAll('#pickGrid .pick-signal').length,
      solarCanvas: Boolean(document.getElementById('convoySolarSystem')),
      solarBodies: [...document.querySelectorAll('#convoyNodes .convoy-node')].filter((node) => node.dataset.solarBody).length,
      currencyLeak: /(?:AUD|USD|澳元|美元|\$\s*\d)/.test(document.body.innerText),
    }));
    expect(audit).toEqual({ overflow: 0, picks: 10, nodes: 10, signals: 20, solarCanvas: true, solarBodies: 10, currencyLeak: false });
  });
});
