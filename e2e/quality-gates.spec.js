import AxeBuilder from '@axe-core/playwright';
import {
  RELEASE_CANDIDATE_ROUTES,
  SITE_MANIFEST,
  normalizeRoutePath,
} from '../src/config/siteManifest.js';
import { A11Y_BASELINE } from './a11y-baseline.js';
import { expect, settlePage, test } from './site-fixture.js';

const activeRoutes = SITE_MANIFEST.filter((route) => route.status === 'active');
const activePaths = new Set(activeRoutes.map((route) => normalizeRoutePath(route.path)));

function routeLabel(route) {
  return `${route.id} ${route.path}`;
}

test.describe('active-route browser gates', () => {
  for (const route of activeRoutes) {
    test(`${routeLabel(route)} renders with metadata and a stable viewport`, async ({ page }, testInfo) => {
      const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' });
      expect(response?.status(), 'route response').toBeLessThan(400);
      await settlePage(page);

      await expect(page.locator('main').first()).toBeVisible();
      await expect(page.locator('h1').first()).toBeVisible();
      await expect(page).toHaveTitle(/\S/);
      await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /\S/);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', route.metadata.canonical);
      await expect(page.locator('[data-afflatus-nav]')).toBeAttached();
      await expect(page.locator('.vite-error-overlay')).toHaveCount(0);

      const documentState = await page.evaluate(() => ({
        lang: document.documentElement.lang,
        bodyTextLength: document.body.innerText.trim().length,
        overflow: Math.max(
          0,
          document.documentElement.scrollWidth - document.documentElement.clientWidth,
        ),
      }));
      const expectedLocale = route.publishedLocales?.length === 1
        ? route.publishedLocales[0]
        : 'en';
      expect(documentState.lang).toMatch(new RegExp(`^${expectedLocale}(?:-|$)`));
      expect(documentState.bodyTextLength).toBeGreaterThan(80);
      expect(
        documentState.overflow,
        `${testInfo.project.name} must not introduce horizontal page overflow`,
      ).toBeLessThanOrEqual(2);
    });

    test(`${routeLabel(route)} supports keyboard entry and route navigation`, async ({ page }, testInfo) => {
      await page.goto(route.path, { waitUntil: 'domcontentloaded' });
      await settlePage(page);

      // Desktop Chromium exercises real Tab traversal. Mobile WebKit follows
      // Safari's platform preference where Tab may intentionally skip links
      // unless Full Keyboard Access is enabled, so mobile projects exercise
      // the same controls through explicit focus + hardware-key events below.
      if (testInfo.project.name === 'desktop-chromium') {
        let focusedInteractive = false;
        for (let index = 0; index < 12; index += 1) {
          await page.keyboard.press('Tab');
          focusedInteractive = await page.evaluate(() => {
            const element = document.activeElement;
            if (!element || element === document.body) return false;
            return element.matches('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
          });
          if (focusedInteractive) break;
        }
        expect(focusedInteractive, 'Tab must enter an interactive control').toBe(true);
      }

      const usesMobileHomeMenu = route.id === 'main' && testInfo.project.name !== 'desktop-chromium';
      let routeLinks;
      if (usesMobileHomeMenu) {
        const deckButton = page.locator('.nav-menu-btn');
        await expect(deckButton).toBeVisible();
        await deckButton.focus();
        await page.keyboard.press('Enter');
        await expect(page.locator('.nav-site-menu.open')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.locator('.nav-site-menu.open')).toHaveCount(0);
        await page.keyboard.press('Enter');
        await expect(page.locator('.nav-site-menu.open')).toBeVisible();
        routeLinks = page.locator('.nav-site-menu a[href]');
      } else {
        const labsTrigger = page.locator('.nav-labs__trigger').first();
        await expect(labsTrigger).toBeAttached();
        await labsTrigger.focus();
        await page.keyboard.press('Escape');
        await expect(labsTrigger).toHaveAttribute('aria-expanded', 'false');
        await page.keyboard.press('Enter');
        await expect(labsTrigger).toHaveAttribute('aria-expanded', 'true');
        await page.keyboard.press('Escape');
        await expect(labsTrigger).toHaveAttribute('aria-expanded', 'false');
        routeLinks = page.locator('[data-afflatus-nav] a[href]:not([href="#"])');
      }

      const destination = await routeLinks.evaluateAll((links, currentPath) => {
          const normalize = (path) => path.replace(/index\.html$/, '') || '/';
          const match = links.find((link) => normalize(new URL(link.href).pathname) !== normalize(currentPath));
          return match ? new URL(match.href).pathname : null;
        }, route.path);
      expect(destination).not.toBeNull();

      const routeLink = page.locator(
        usesMobileHomeMenu
          ? `.nav-site-menu a[href="${destination}"]`
          : `[data-afflatus-nav] a[href="${destination}"]`,
      );
      await expect(routeLink).toHaveCount(1);
      await routeLink.focus();
      await Promise.all([
        page.waitForURL((url) => normalizeRoutePath(url.pathname) === normalizeRoutePath(destination)),
        page.keyboard.press('Enter'),
      ]);
      expect(activePaths.has(normalizeRoutePath(new URL(page.url()).pathname))).toBe(true);
    });
  }
});

test.describe('axe WCAG regression gate', () => {
  for (const route of activeRoutes) {
    test(`${routeLabel(route)} matches the audited serious/critical WCAG baseline`, async ({ page }, testInfo) => {
      test.skip(
        testInfo.project.name !== 'desktop-chromium',
        'Axe runs once on the DOM contract; all projects cover responsive layout.',
      );
      await page.goto(route.path, { waitUntil: 'domcontentloaded' });
      await settlePage(page);

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      const violations = results.violations
        .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
        .map((violation) => ({
          id: violation.id,
          impact: violation.impact,
          help: violation.help,
          targets: violation.nodes.map((node) => node.target.join(' ')).sort(),
        }));

      const allowed = A11Y_BASELINE[route.id] ?? [];
      const unexpected = violations.flatMap((violation) => {
        const allowedRule = allowed.find(
          (entry) => entry.id === violation.id && entry.impact === violation.impact,
        );
        const unexpectedTargets = violation.targets.filter(
          (target) => !allowedRule?.targets.includes(target),
        );
        return unexpectedTargets.length
          ? [{ ...violation, targets: unexpectedTargets }]
          : [];
      });
      expect(unexpected).toEqual([]);
    });
  }
});

test.describe('prototype release-candidate browser gates', () => {
  for (const route of RELEASE_CANDIDATE_ROUTES) {
    test(`${routeLabel(route)} remains truthful, stable and undiscoverable`, async ({ page }, testInfo) => {
      const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' });
      expect(response?.status(), 'route response').toBeLessThan(400);
      await settlePage(page);

      await expect(page.locator('main').first()).toBeVisible();
      await expect(page.locator('h1').first()).toBeVisible();
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
      await expect(page.locator('.vite-error-overlay')).toHaveCount(0);
      const documentState = await page.evaluate(() => ({
        bodyTextLength: document.body.innerText.trim().length,
        overflow: Math.max(
          0,
          document.documentElement.scrollWidth - document.documentElement.clientWidth,
        ),
      }));
      expect(documentState.bodyTextLength).toBeGreaterThan(120);
      expect(
        documentState.overflow,
        `${testInfo.project.name} must not introduce horizontal page overflow`,
      ).toBeLessThanOrEqual(2);
    });

  }
});
