import { expect, test } from './site-fixture.js';
import { SITE_MANIFEST } from '../src/config/siteManifest.js';

const RESPONSIVE_ROUTES = SITE_MANIFEST
  .filter((route) => route.build || route.id === 'not-found')
  .map(({ id, path, build }) => ({ id, path, build }));

test.describe('320px responsive floor', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'The 320px floor runs once in Chromium.');
    await page.setViewportSize({ width: 320, height: 720 });
  });

  for (const route of RESPONSIVE_ROUTES) {
    test(`${route.id} has viewport coverage and no page-level horizontal overflow`, async ({ page }) => {
      await page.goto(route.path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', /viewport-fit=cover/);
      if (route.build) {
        await expect(page.locator('html')).toHaveAttribute('data-keyboard-open', /^(true|false)$/);
      }

      const contract = await page.evaluate(() => {
        const root = document.documentElement;
        const styles = getComputedStyle(root);
        const controls = Array.from(document.querySelectorAll(
          'button, summary, select, textarea, input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]), [role="button"], nav a',
        ));
        const undersized = controls.flatMap((element) => {
          if (element.ownerSVGElement || element.closest('[hidden], [aria-hidden="true"]') || element.matches('.term, .term-chip')) return [];
          const rect = element.getBoundingClientRect();
          const visible = rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== 'hidden';
          const pseudo = element.matches('nav a, [data-afflatus-nav] a')
            ? getComputedStyle(element, '::after')
            : null;
          const pseudoWidth = pseudo ? Number.parseFloat(pseudo.width) : 0;
          const pseudoHeight = pseudo ? Number.parseFloat(pseudo.height) : 0;
          const hasTarget = (rect.width >= 44 && rect.height >= 44)
            || (pseudoWidth >= 44 && pseudoHeight >= 44);
          if (!visible || hasTarget) return [];
          return [{
            target: element.id || element.className || element.tagName.toLowerCase(),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          }];
        });
        return {
          overflow: root.scrollWidth - root.clientWidth,
          safeTop: styles.getPropertyValue('--safe-top').trim(),
          dynamicHeight: styles.getPropertyValue('--viewport-dynamic-height').trim(),
          visualHeight: styles.getPropertyValue('--visual-viewport-height').trim(),
          undersized,
        };
      });

      expect(contract.overflow).toBeLessThanOrEqual(1);
      expect(contract.safeTop).not.toBe('');
      expect(contract.dynamicHeight).not.toBe('');
      if (route.build) expect(contract.visualHeight).toMatch(/px$/);
      else expect(contract.visualHeight).not.toBe('');
      expect(contract.undersized).toEqual([]);
    });
  }
});
