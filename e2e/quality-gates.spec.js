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

/**
 * Portfolio dims every scrollytelling card except the active step and fades
 * reveal blocks in on view. Audit each element in the state a reader sees it:
 * reveal the page, audit it with inactive steps excluded, then activate each
 * step by scrolling and audit that step on its own.
 */
async function analyzePortfolio(page, axe) {
  await page.evaluate(async () => {
    const frame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    for (let y = 0; y < document.documentElement.scrollHeight; y += Math.round(innerHeight / 2)) {
      scrollTo(0, y);
      await frame();
    }
  });
  await expect(page.locator('.pf-reveal:not(.is-in)')).toHaveCount(0);
  await page.evaluate(() => scrollTo(0, 0));

  const violations = [];
  const steps = page.locator('#pfScrolly .pf-step');
  violations.push(...(await axe().exclude('#pfScrolly .pf-step:not(.is-active)').analyze()).violations);
  for (let index = 0; index < await steps.count(); index += 1) {
    const step = steps.nth(index);
    const selector = await step.evaluate((element) => {
      element.scrollIntoView({ block: 'end' });
      return `#pfScrolly .pf-step:nth-child(${[...element.parentElement.children].indexOf(element) + 1})`;
    });
    await expect(step).toHaveClass(/\bis-active\b/);
    violations.push(...(await axe().include(selector).analyze()).violations);
  }
  return violations;
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
      await expect(page.locator('#afflatus-header #af-primary-nav')).toBeAttached();
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

      // Below the desktop breakpoint the primary nav sits behind the header
      // menu. Escape inside a submenu would close the whole menu by design, so
      // the menu is opened once and the submenu is exercised inside it.
      const headerMenu = page.locator('#afflatus-header .af-header-menu');
      if (await headerMenu.isVisible()) {
        await headerMenu.click();
        await expect(headerMenu).toHaveAttribute('aria-expanded', 'true');
      }

      const marketsTrigger = page.locator('#afflatus-header [data-header-disclosure][aria-controls="af-markets"]');
      await expect(marketsTrigger).toBeVisible();
      await marketsTrigger.focus();
      await page.keyboard.press('Enter');
      await expect(marketsTrigger).toHaveAttribute('aria-expanded', 'true');
      await page.keyboard.press('Escape');
      await expect(marketsTrigger).toHaveAttribute('aria-expanded', 'false');
      await expect(marketsTrigger).toBeFocused();

      const routeLinks = page.locator('#af-primary-nav > a[href]');
      const destination = await routeLinks.evaluateAll((links, currentPath) => {
          const normalize = (path) => path.replace(/index\.html$/, '') || '/';
          const match = links.find((link) => normalize(new URL(link.href).pathname) !== normalize(currentPath));
          return match ? new URL(match.href).pathname : null;
        }, route.path);
      expect(destination).not.toBeNull();

      const routeLink = page.locator(`#af-primary-nav > a[href="${destination}"]`);
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

      const axe = () => new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);
      const results = route.id === 'portfolio'
        ? await analyzePortfolio(page, axe)
        : (await axe().analyze()).violations;
      const violations = results
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
