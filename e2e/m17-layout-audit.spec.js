import { localizedRoutePath, SITE_MANIFEST } from '../src/config/siteManifest.js';
import { expect, settlePage, test } from './site-fixture.js';

const activeRoutes = SITE_MANIFEST.filter(({ status }) => status === 'active');

async function inspectLayout(page) {
  return page.evaluate(() => {
    const visible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && Number(style.opacity) > 0.01
        && rect.width > 0
        && rect.height > 0;
    };
    const textNodes = (element) => {
      const nodes = [];
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        if (walker.currentNode.textContent.trim()) nodes.push(walker.currentNode);
      }
      return nodes;
    };
    const nodeLines = (node) => {
      const range = document.createRange();
      range.selectNodeContents(node);
      return new Set([...range.getClientRects()]
        .filter(({ width, height }) => width > 1 && height > 1)
        .map(({ top }) => Math.round(top))).size;
    };
    const label = (element) => (
      element.getAttribute('aria-label') || element.textContent || ''
    ).trim().replace(/\s+/g, ' ').slice(0, 120);

    const controls = [...new Set(document.querySelectorAll(
      'header a,header button,nav a,nav button,footer a,footer button,[role="switch"],input[type="button"],input[type="submit"]',
    ))].filter(visible);
    const wrappedControls = controls.flatMap((element) => textNodes(element)
      .filter((node) => nodeLines(node) > 1)
      .map(() => ({ label: label(element), className: String(element.className || '') })));

    const clippedText = [...document.querySelectorAll('h1,h2,h3,p,a,button,label,li,td,th')]
      .filter(visible)
      .filter((element) => !element.closest('.sr-only,[class*="__sr"],.skip-link,.city-skip'))
      .flatMap((element) => {
        const style = getComputedStyle(element);
        if (!['hidden', 'clip'].includes(style.overflowX)
          && !['hidden', 'clip'].includes(style.overflowY)) return [];
        const bounds = element.getBoundingClientRect();
        const outside = textNodes(element).some((node) => {
          const range = document.createRange();
          range.selectNodeContents(node);
          return [...range.getClientRects()].some((rect) => (
            rect.left < bounds.left - 1 || rect.right > bounds.right + 1
            || rect.top < bounds.top - 1 || rect.bottom > bounds.bottom + 1
          ));
        });
        return outside ? [{ label: label(element), className: String(element.className || '') }] : [];
      });

    const headerControls = [...document.querySelectorAll('header a,header button')].filter(visible);
    const headerOverlaps = [];
    for (let first = 0; first < headerControls.length; first += 1) {
      const a = headerControls[first].getBoundingClientRect();
      for (let second = first + 1; second < headerControls.length; second += 1) {
        const b = headerControls[second].getBoundingClientRect();
        const width = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (width > 2 && height > 2) headerOverlaps.push([
          label(headerControls[first]),
          label(headerControls[second]),
        ]);
      }
    }

    return {
      clippedText,
      headerOverlaps,
      overflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
      wrappedControls,
    };
  });
}

test.describe('M17 localized release layout audit', () => {
  for (const route of activeRoutes) {
    test(`${route.id} has no overflow, clipped control text or accidental control wrapping`, async ({ page }) => {
      for (const locale of route.publishedLocales || ['en', 'zh']) {
        const path = localizedRoutePath(route, locale);
        await page.goto(path, { waitUntil: 'domcontentloaded' });
        await settlePage(page);
        await expect(page.locator('main').first()).toBeVisible();
        await expect(page.locator('h1').first()).toBeVisible();
        const state = await inspectLayout(page);
        expect(state.overflow, `${path} horizontal overflow`).toBeLessThanOrEqual(1);
        expect(state.wrappedControls, `${path} controls must stay on one logical line`).toEqual([]);
        expect(state.clippedText, `${path} text must not be clipped by its box`).toEqual([]);
        expect(state.headerOverlaps, `${path} header controls must not overlap`).toEqual([]);
      }
    });
  }
});
