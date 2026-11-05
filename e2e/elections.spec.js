import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { sourceById } from '../src/config/electionSources.js';
import { collectOnce, directoryTransport } from '../scripts/elections/collector.mjs';
import { contestXml, feedXml, lowerName, zipOf } from '../tests/helpers/electionFixtures.js';

const HUB = '/en/elections.html';
const NOW = new Date('2026-11-04T22:00:00+11:00');

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
});

const console_ = (query) => `${HUB}?${query}`;
const noOverflow = async (page) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
};

// The drawer fades in over 160ms. Measuring mid-flight reports a shifted box and false low contrast.
const settled = (page) => page.evaluate(() => Promise.all((document.getElementById('el-drawer')?.getAnimations() || []).map((animation) => animation.finished)));

test.describe('Elections hub', () => {
  test('leads with Victoria and lists the other four events', async ({ page }) => {
    await page.goto(HUB);
    await expect(page.locator('h1')).toContainText('ELECTIONS');
    await expect(page.locator('.el-next h2')).toHaveText('Victoria votes on Saturday 28 November');
    await expect(page.locator('.el-countdown strong')).toHaveText('24');
    await expect(page.locator('.el-card')).toHaveCount(4);
    await expect(page.locator('.el-strip')).toContainText('Design preview — no live results');
    await noOverflow(page);
  });

  test('never claims a result for the US midterms', async ({ page }) => {
    await page.goto(HUB);
    await expect(page.locator('.el-card').first()).toContainText('no verified results loaded');
    await expect(page.locator('#el-view')).not.toContainText(/uncalled|won\b|winner/i);
  });

  test('opens the Victoria console and returns', async ({ page }) => {
    await page.goto(HUB);
    await page.locator('.el-next a.el-btn').click();
    await expect(page).toHaveURL(/event=vic-2026/);
    await expect(page.locator('h1')).toContainText('VIC 2026');
    await page.goBack();
    await expect(page.locator('.el-next')).toBeVisible();
  });

  test('is reachable from the shared header', async ({ page }) => {
    await page.goto('/en/signal.html');
    await expect(page.locator('#af-markets a[data-header-path="/elections.html"]')).toHaveCount(1);
  });
});

test.describe('Elections console', () => {
  test('Victoria carries its own rules', async ({ page }) => {
    await page.goto(console_('event=vic-2026'));
    await expect(page.locator('[data-office]')).toHaveCount(2);
    await expect(page.locator('[data-office="assembly"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.el-tally-mark')).toContainText('45 for majority');
    await expect(page.locator('.el-tally-keys')).toContainText('Labor');
    await expect(page.locator('.el-sources')).toContainText('VEC results feed: not connected');
    await expect(page.locator('.el-strip')).toContainText('Coverage 0/88');
    await noOverflow(page);
  });

  test('the US console uses US parties and 435 blocks', async ({ page }) => {
    await page.goto(console_('event=us-2026&geo=blocks'));
    await expect(page.locator('.el-tally-mark')).toContainText('218 for majority');
    await expect(page.locator('.el-tally-keys')).toContainText('Republican');
    await expect(page.locator('.el-tally-keys')).not.toContainText('Labor');
    await expect(page.locator('.el-tile-map [data-seat]')).toHaveCount(435);
    await expect(page.locator('.el-tile-map [tabindex="0"]')).toHaveCount(1);
  });

  test('colours no seat and fills no value', async ({ page }) => {
    await page.goto(console_('event=us-2026&office=senate&geo=blocks'));
    await expect(page.locator('.el-tile-map [data-seat]:not(.is-off)')).toHaveCount(35);
    await expect(page.locator('.el-seat.is-neutral')).toHaveCount(35);
    await expect(page.locator('.el-seat.is-off')).toHaveCount(65);
    const inline = await page.locator('[data-roving] [data-seat][style]').count();
    expect(inline).toBe(0);
    await expect(page.locator('.el-tally-keys')).toContainText('No result loaded35');
    await expect(page.locator('.el-tally-keys')).toContainText('Not on ballot65');
    const cells = await page.locator('.el-table tbody td.el-num').allTextContents();
    expect(new Set(cells)).toEqual(new Set(['—']));
  });

  test('selecting a race opens the drawer, survives refresh and clears on office change', async ({ page }) => {
    await page.goto(console_('event=us-2026'));
    await page.locator('.el-seat-link[data-seat="AL-03"]').click();
    await expect(page).toHaveURL(/race=AL-03/);
    await expect(page.locator('#el-drawer-title')).toHaveText('AL-03');
    await expect(page.locator('#el-drawer')).toContainText('House of Representatives');
    await page.reload();
    await expect(page.locator('#el-drawer-title')).toHaveText('AL-03');
    await page.locator('[data-office="senate"]').click();
    await expect(page).not.toHaveURL(/race=/);
    await expect(page.locator('#el-drawer')).toBeHidden();
  });

  test('a deep link outside the short list stays short', async ({ page }) => {
    await page.goto(console_('event=us-2026&office=house&race=WY-AL'));
    await expect(page.locator('.el-table tbody tr')).toHaveCount(13);
    await expect(page.locator('tr[data-row="WY-AL"]')).toHaveClass(/is-selected/);
  });

  test('an invalid race is dropped from the URL', async ({ page }) => {
    await page.goto(console_('event=vic-2026&office=senate&race=CA-12&mode=live'));
    await expect(page).toHaveURL(/\?event=vic-2026&office=assembly$/);
    await expect(page.locator('#el-drawer')).toBeHidden();
  });

  test('Escape closes the drawer and returns focus to the seat', async ({ page }) => {
    await page.goto(console_('event=vic-2026'));
    const link = page.locator('.el-table tbody .el-seat-link').nth(1);
    await link.click();
    await expect(page.locator('#el-drawer')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#el-drawer')).toBeHidden();
    await expect(link).toBeFocused();
  });

  test('sorting is explicit and reversible', async ({ page }) => {
    await page.goto(console_('event=vic-2026'));
    await page.locator('[data-sort="seat"]').click();
    await expect(page.locator('.el-table tbody tr').first()).toHaveAttribute('data-row', 'yan-yean');
    await expect(page.locator('th[aria-sort="descending"]')).toHaveCount(1);
  });

  test('replay stays disabled', async ({ page }) => {
    await page.goto(console_('event=vic-2026'));
    await expect(page.locator('.el-replay button')).toBeDisabled();
  });

  test('an office with no seat view explains itself', async ({ page }) => {
    await page.goto(console_('event=us-2028'));
    await expect(page.locator('.el-tally-mark')).toContainText('270 to win');
    await expect(page.locator('.el-chamber')).toContainText('not built yet');
    await expect(page.locator('.el-table')).toHaveCount(0);
  });

  test('the language link keeps the view after moving around in the page', async ({ page, isMobile }) => {
    test.skip(isMobile, 'The language link sits in the collapsed header on phones.');
    await page.goto(HUB);
    await page.locator('.el-next .el-btn').click();
    await page.locator('[data-office="council"]').click();
    await expect(page.locator('[data-header-language]')).toHaveAttribute('href', /event=vic-2026.*office=council/);
  });

  test('switching office keeps focus and says where you are', async ({ page }) => {
    await page.goto(console_('event=vic-2026'));
    await page.locator('[data-office="council"]').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-office="council"]')).toBeFocused();
    await expect(page.locator('#el-live')).toHaveText('Legislative Council');
    await expect(page).toHaveTitle(/VIC 2026 · Legislative Council/);
  });

  test('opening a console moves focus to its title', async ({ page }) => {
    await page.goto(HUB);
    await page.locator('.el-next .el-btn').click();
    await expect(page.locator('#el-title')).toBeFocused();
    await expect(page).toHaveTitle(/VIC 2026/);
    await page.goBack();
    await expect(page).toHaveTitle(/Elections 2026–28/);
  });

  test('a tablet keeps the map and the main columns', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Viewport test.');
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(console_('event=vic-2026'));
    await expect(page.locator('.el-map-svg')).toBeVisible();
    await expect(page.locator('.el-explore-toggle')).toBeHidden();
    await noOverflow(page);
  });

  test('with no seats-not-up data, the Senate draws no 51 line', async ({ page }) => {
    await page.goto(console_('event=us-2026&office=senate'));
    await expect(page.locator('.el-chamber-svg')).toBeVisible();
    await expect(page.locator('.el-tally-mark')).toHaveCount(0);
    await expect(page.locator('#el-sub')).toContainText('51 for an outright majority');
  });

  test('shows readers no internal stage codes', async ({ page }) => {
    for (const query of ['event=us-2026', 'event=vic-2026', 'event=nsw-2027&office=council', 'event=au-2028', 'event=us-2028']) {
      await page.goto(console_(query));
      await expect(page.locator('.el-strip')).toBeVisible();
      expect(await page.locator('main').innerText()).not.toMatch(/\bM[0-9]\b/);
    }
  });

  test('the Chinese document translates the rules', async ({ page }) => {
    await page.goto('/zh/elections.html?event=vic-2026');
    await expect(page.locator('h1')).toContainText('维州 2026');
    await expect(page.locator('.el-strip')).toContainText('设计预览');
    await expect(page.locator('.el-tally-keys')).toContainText('工党');
    await noOverflow(page);
  });

  test('coverage counts contests, not seats that are not on the ballot', async ({ page }) => {
    await page.goto(console_('event=us-2026&office=senate'));
    await expect(page.locator('.el-strip')).toContainText('Coverage 0/35');
    await expect(page.locator('.el-sources')).toContainText('0 of 35');
  });

  for (const [name, path] of [
    ['English Senate', '/en/elections.html?event=us-2026&office=senate'],
    ['Chinese Senate', '/zh/elections.html?event=us-2026&office=senate'],
    ['English House', '/en/elections.html?event=us-2026&office=house'],
    ['English Victoria', '/en/elections.html?event=vic-2026'],
    ['English Victorian Council', '/en/elections.html?event=vic-2026&office=council'],
    ['Chinese Victorian Council', '/zh/elections.html?event=vic-2026&office=council'],
    ['English NSW', '/en/elections.html?event=nsw-2027'],
  ]) {
    test(`the ${name} race table fits a 390px phone without sideways scrolling`, async ({ page, isMobile }) => {
      test.skip(!isMobile, 'phone layout');
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(path);
      const scroller = page.locator('.el-table-scroll');
      await scroller.waitFor();
      await page.evaluate(() => document.fonts.ready);
      const hidden = await scroller.evaluate((element) => element.scrollWidth - element.clientWidth);
      expect(hidden).toBeLessThanOrEqual(0);
    });
  }

  test('phones get the list before the seat blocks, with a usable sheet', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'phone layout');
    await page.goto(console_('event=vic-2026'));
    const y = async (selector) => (await page.locator(selector).boundingBox()).y;
    expect(await y('.el-races')).toBeLessThan(await y('.el-explore'));
    await expect(page.locator('#el-explore-body')).toBeHidden();
    await page.locator('#el-explore-toggle').click();
    await expect(page.locator('#el-explore-body')).toBeVisible();
    await page.locator('.el-table tbody .el-seat-link').nth(2).click();
    await settled(page);
    const sheet = await page.locator('#el-drawer').boundingBox();
    const viewport = page.viewportSize();
    expect(Math.round(sheet.y + sheet.height)).toBe(viewport.height);
    await noOverflow(page);
  });
});

test.describe('Elections chamber chart', () => {
  const CAPTION = 'Chamber-inspired seat view · Each mark represents an electoral seat, not an assigned desk.';
  const CHARTS = [
    ['us-2026', 'house', 435, 'fan'],
    ['us-2026', 'senate', 100, 'fan'],
    ['vic-2026', 'assembly', 88, 'horseshoe'],
    ['vic-2026', 'council', 40, 'horseshoe'],
    ['nsw-2027', 'assembly', 93, 'horseshoe'],
    ['nsw-2027', 'council', 42, 'horseshoe'],
    ['au-2028', 'house', 150, 'horseshoe'],
    ['au-2028', 'senate', 76, 'horseshoe'],
  ];

  for (const [event, office, seats, shape] of CHARTS) {
    test(`${event} ${office} draws ${seats} marks as a ${shape} with one Tab stop`, async ({ page }) => {
      await page.goto(console_(`event=${event}&office=${office}`));
      await expect(page.locator('.el-chamber-svg')).toHaveAttribute('data-chamber', shape);
      await expect(page.locator('.el-chamber-svg [data-seat]')).toHaveCount(seats);
      await expect(page.locator('.el-chamber-svg [tabindex="0"]')).toHaveCount(1);
      await expect(page.locator('.el-chamber .el-cap')).toHaveText(CAPTION);
      await noOverflow(page);
    });
  }

  test('draws no majority line, and the tally keeps its one', async ({ page }) => {
    await page.goto(console_('event=vic-2026'));
    await expect(page.locator('.el-chamber-svg')).toBeVisible();
    await expect(page.locator('.el-chamber')).not.toContainText('45');
    await expect(page.locator('.el-tally-mark')).toHaveCount(1);
  });

  test('the Chinese document carries the Chinese caption', async ({ page }) => {
    await page.goto('/zh/elections.html?event=au-2028');
    await expect(page.locator('.el-chamber .el-cap')).toHaveText('参考议院形态的席位图；每个标记代表一个选举席位，并非议员实际座位。');
  });

  test('clicking a mark syncs the drawer, race table and seat block, and keeps the seat in place', async ({ page }) => {
    await page.goto(console_('event=us-2026&geo=blocks'));
    const mark = page.locator('.el-chamber-svg [data-seat="WY-AL"]');
    const before = await mark.getAttribute('cx');
    await mark.click({ force: true });
    await expect(page).toHaveURL(/race=WY-AL/);
    await expect(page.locator('#el-drawer-title')).toHaveText('WY-AL');
    await expect(page.locator('tr[data-row="WY-AL"]')).toHaveClass(/is-selected/);
    await expect(page.locator('.el-tile-map [data-seat="WY-AL"]')).toHaveClass(/is-selected/);
    await expect(mark).toHaveClass(/is-selected/);
    await expect(mark).toHaveAttribute('aria-pressed', 'true');
    expect(await mark.getAttribute('cx')).toBe(before);
    await expect(page.locator('.el-chamber-svg [tabindex="0"]')).toHaveCount(1);
    await expect(mark).toHaveAttribute('tabindex', '0');
  });

  test('selecting from the race table marks the chart', async ({ page }) => {
    await page.goto(console_('event=vic-2026'));
    await page.locator('.el-seat-link[data-seat="albert-park"]').click();
    await expect(page.locator('.el-chamber-svg [data-seat="albert-park"]')).toHaveClass(/is-selected/);
    await expect(page.locator('#el-chamber-readout')).toContainText('Albert Park');
  });

  test('a deep link selects its mark after a refresh', async ({ page }) => {
    await page.goto(console_('event=us-2026&office=senate&race=FL-S1'));
    await expect(page.locator('.el-chamber-svg [data-seat="FL-S1"]')).toHaveClass(/is-selected/);
    await page.reload();
    await expect(page.locator('.el-chamber-svg [data-seat="FL-S1"]')).toHaveClass(/is-selected/);
  });

  test('keyboard: arrows rove, Enter selects, Escape returns to the mark', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard flow');
    await page.goto(console_('event=vic-2026&office=council'));
    const first = page.locator('.el-chamber-svg [tabindex="0"]');
    await expect(first).toHaveCount(1);
    await first.focus();
    await page.keyboard.press('ArrowRight');
    const focused = page.locator('.el-chamber-svg [data-seat="eastern-victoria-2"]');
    await expect(focused).toBeFocused();
    await expect(focused).toHaveAttribute('tabindex', '0');
    await expect(page.locator('.el-chamber-svg [tabindex="0"]')).toHaveCount(1);
    await expect(page.locator('#el-chamber-readout')).toContainText('Eastern Victoria 2 of 5');
    await page.keyboard.press('Enter');
    await expect(page.locator('#el-drawer-title')).toHaveText('Eastern Victoria 2 of 5');
    await expect(page).toHaveURL(/race=eastern-victoria-2/);
    await page.keyboard.press('Escape');
    await expect(page.locator('#el-drawer')).toBeHidden();
    await expect(focused).toBeFocused();
  });

  test('hover previews a seat and leaving restores the hint', async ({ page, isMobile }) => {
    test.skip(isMobile, 'hover flow');
    await page.goto(console_('event=au-2028'));
    const readout = page.locator('#el-chamber-readout');
    const hint = await readout.textContent();
    await page.locator('.el-chamber-svg [data-seat="seat-010"]').hover({ force: true });
    await expect(readout).toContainText('Seat 010 · No result loaded');
    await page.locator('h1').hover();
    await expect(readout).toHaveText(hint);
  });

  test('the US 2028 office draws no chart', async ({ page }) => {
    await page.goto(console_('event=us-2028'));
    await expect(page.locator('.el-chamber-svg')).toHaveCount(0);
  });
});

test.describe('Elections map', () => {
  const MAPS = [
    ['us-2026', 'house', 'us-house', 435, 'TIGER/Line 2026'],
    ['us-2026', 'senate', 'us-senate', 50, 'Cartographic Boundary 2025'],
    ['vic-2026', 'assembly', 'vic-assembly', 88, 'Vicmap Admin'],
    ['vic-2026', 'council', 'vic-council', 8, 'Vicmap Admin'],
    ['nsw-2027', 'assembly', 'nsw-assembly', 93, 'NSW Administrative Boundaries'],
  ];
  const mapReady = (page) => page.locator('.el-map-svg [data-feature]').first().waitFor({ state: 'attached' });
  const viewBox = (page) => page.locator('.el-map-svg').getAttribute('viewBox');
  // Not a real tap: a deep link's sheet covers the toggle until the page is scrolled.
  const openToggle = (page) => page.locator('#el-explore-toggle').evaluate((element) => element.click());
  const openPanel = async (page, isMobile) => {
    if (isMobile) await openToggle(page);
    await mapReady(page);
  };
  // A real click at a point the feature actually owns, since a bounding box centre may be another district or the sea.
  const clickFeature = async (page, id) => {
    const feature = page.locator(`.el-map-svg [data-feature="${id}"]`);
    await feature.scrollIntoViewIfNeeded();
    const point = await feature.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const points = [];
      for (let i = 1; i < 12; i += 1) {
        for (let j = 1; j < 12; j += 1) points.push({ x: box.x + (box.width * i) / 12, y: box.y + (box.height * j) / 12, off: Math.abs(i - 6) + Math.abs(j - 6) });
      }
      return points.sort((a, b) => a.off - b.off).find(({ x, y }) => document.elementFromPoint(x, y) === element) || null;
    });
    expect(point, `${id} has a clickable point`).not.toBeNull();
    await page.mouse.click(point.x, point.y);
  };

  for (const [event, office, map, features, source] of MAPS) {
    test(`${event} ${office} draws ${features} verified features and names its source`, async ({ page, isMobile }) => {
      await page.goto(console_(`event=${event}&office=${office}`));
      await openPanel(page, isMobile);
      await expect(page.locator('.el-map-svg')).toHaveAttribute('data-map', map);
      await expect(page.locator('.el-map-svg [data-feature]')).toHaveCount(features);
      await expect(page.locator('.el-map-svg [tabindex="0"]')).toHaveCount(1);
      await expect(page.locator('.el-map')).toContainText(source);
      await expect(page.locator('.el-map')).toContainText('Map area is not seat weight');
      await expect(page.locator('.el-map-svg [style*="--seat"]')).toHaveCount(0);
      await noOverflow(page);
    });
  }

  test('the House map is neutral, and the Senate separates contests from seats not up', async ({ page, isMobile }) => {
    await page.goto(console_('event=us-2026'));
    await openPanel(page, isMobile);
    await expect(page.locator('.el-feature.is-neutral')).toHaveCount(435);
    await page.goto(console_('event=us-2026&office=senate'));
    await openPanel(page, isMobile);
    await expect(page.locator('.el-feature.is-neutral')).toHaveCount(35);
    await expect(page.locator('.el-feature.is-off')).toHaveCount(15);
    await expect(page.locator('.el-map .el-chamber-key')).toContainText('Not on ballot');
    await expect(page.locator('.el-map-inset')).toHaveCount(2);
    await expect(page.locator('.el-map-inset').first()).toContainText('AK · inset');
  });

  test('clicking a district syncs the drawer, race table, chart and URL', async ({ page, isMobile }) => {
    await page.goto(console_('event=us-2026'));
    await openPanel(page, isMobile);
    const feature = page.locator('.el-map-svg [data-feature="WY-AL"]');
    await clickFeature(page, 'WY-AL');
    await expect(page).toHaveURL(/race=WY-AL/);
    await expect(page.locator('#el-drawer-title')).toHaveText('WY-AL');
    await expect(page.locator('tr[data-row="WY-AL"]')).toHaveClass(/is-selected/);
    await expect(page.locator('.el-chamber-svg [data-seat="WY-AL"]')).toHaveClass(/is-selected/);
    await expect(feature).toHaveClass(/is-selected/);
    await expect(feature).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.el-map-svg [tabindex="0"]')).toHaveCount(1);
  });

  test('selecting from the race table marks the map and rings a small district', async ({ page, isMobile }) => {
    await page.goto(console_('event=us-2026&race=NY-12'));
    await openPanel(page, isMobile);
    await expect(page.locator('.el-map-svg [data-feature="NY-12"]')).toHaveClass(/is-selected/);
    await expect(page.locator('.el-map-locator')).not.toHaveAttribute('hidden', '');
    await expect(page.locator('.el-map-readout, #el-map-readout')).toContainText('NY-12');
  });

  test('a state selects its contest, and either seat marks the state', async ({ page, isMobile }) => {
    await page.goto(console_('event=us-2026&office=senate&race=FL-S2'));
    await openPanel(page, isMobile);
    await expect(page.locator('.el-map-svg [data-feature="FL"]')).toHaveClass(/is-selected/);
    await expect(page.locator('#el-drawer')).toContainText('not on the 2026 ballot');
    await page.keyboard.press('Escape');
    await clickFeature(page, 'WY');
    await expect(page).toHaveURL(/race=WY-S1/);
    await expect(page.locator('#el-drawer-title')).toHaveText('WY Senate 1');
  });

  test('a Victorian region shows five seats and no single result', async ({ page, isMobile }) => {
    await page.goto(console_('event=vic-2026&office=council'));
    await openPanel(page, isMobile);
    const region = page.locator('.el-map-svg [data-feature="northern-victoria"]');
    await expect(region).toHaveAttribute('aria-label', /5 seats/);
    await clickFeature(page, 'northern-victoria');
    await expect(page).toHaveURL(/race=northern-victoria-1/);
    await expect(page.locator('#el-drawer')).toContainText('elects five members');
    await expect(region).toHaveClass(/is-selected/);
  });

  test('office switches clear the race, change the map and never drift', async ({ page, isMobile }) => {
    await page.goto(console_('event=us-2026&race=NY-12&area=NY'));
    await openPanel(page, isMobile);
    await page.locator('[data-office="senate"]').click();
    await expect(page).toHaveURL(/office=senate$/);
    await expect(page.locator('#el-drawer')).toBeHidden();
    await expect(page.locator('[data-office][aria-pressed="true"]')).toHaveCount(1);
    await expect(page.locator('[data-office="senate"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.el-chamber-svg [data-seat]')).toHaveCount(100);
    await openPanel(page, isMobile);
    await expect(page.locator('.el-map-svg')).toHaveAttribute('data-map', 'us-senate');
    await page.goBack();
    await expect(page.locator('[data-office="house"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.el-chamber-svg [data-seat]')).toHaveCount(435);
    await expect(page.locator('#el-drawer-title')).toHaveText('NY-12');
  });

  test('an area zoom survives a refresh, shows counts and names no winner', async ({ page, isMobile }) => {
    await page.goto(console_('event=us-2026'));
    await openPanel(page, isMobile);
    const whole = await viewBox(page);
    await page.locator('#el-area').selectOption('NY');
    await expect(page).toHaveURL(/area=NY/);
    expect(await viewBox(page)).not.toBe(whole);
    const summary = page.locator('#el-map-area');
    await expect(summary).toContainText('26 seats');
    await expect(summary).toContainText('Coverage 0/26');
    await expect(summary).toContainText('a state has no single House winner');
    const zoomed = await viewBox(page);
    await page.reload();
    await openPanel(page, isMobile);
    await expect(page.locator('#el-area')).toHaveValue('NY');
    expect(await viewBox(page)).toBe(zoomed);
    await page.locator('#el-area').selectOption('');
    expect(await viewBox(page)).toBe(whole);
    await expect(page).not.toHaveURL(/area=/);
  });

  test('an unknown area is dropped from the URL', async ({ page }) => {
    await page.goto(console_('event=us-2026&area=atlantis'));
    await expect(page).toHaveURL(/\?event=us-2026&office=house$/);
  });

  test('search reaches a small district, zooms to it and can reset', async ({ page, isMobile }) => {
    test.skip(isMobile, 'covered by the phone flow below');
    await page.goto(console_('event=us-2026'));
    await mapReady(page);
    const whole = await viewBox(page);
    await page.locator('#el-search').fill('ny 12');
    await page.locator('#el-search').press('Enter');
    await expect(page.locator('#el-drawer-title')).toHaveText('NY-12');
    await expect(page).toHaveURL(/race=NY-12/);
    expect(await viewBox(page)).not.toBe(whole);
    await page.locator('#el-zoom-seat').click();
    expect(await viewBox(page)).toBe(whole);
    await page.locator('#el-search').fill('nowhere');
    await page.locator('#el-search').press('Enter');
    await expect(page.locator('#el-search-note')).toContainText('No single seat matches');
  });

  test('search finds an official Victorian name', async ({ page, isMobile }) => {
    await page.goto(console_('event=vic-2026'));
    await openPanel(page, isMobile);
    await page.locator('#el-search').fill('Albert Park');
    await page.locator('#el-search').press('Enter');
    await expect(page.locator('#el-drawer-title')).toHaveText('Albert Park');
    await expect(page).toHaveURL(/race=albert-park/);
  });

  test('the blocks view keeps the race and stays in the URL', async ({ page, isMobile }) => {
    await page.goto(console_('event=us-2026&race=CA-12'));
    await openPanel(page, isMobile);
    await page.locator('[data-geo="schematic"]').evaluate((element) => element.click());
    await expect(page).toHaveURL(/geo=blocks/);
    await expect(page.locator('.el-map-svg')).toHaveCount(0);
    await expect(page.locator('#el-explore-title')).toHaveText('Seat blocks');
    await expect(page.locator('.el-tile-map [data-seat="CA-12"]')).toHaveClass(/is-selected/);
    await page.reload();
    if (isMobile) await openToggle(page);
    await expect(page.locator('.el-tile-map [data-seat="CA-12"]')).toHaveClass(/is-selected/);
    await page.locator('[data-geo="map"]').evaluate((element) => element.click());
    await mapReady(page);
    await expect(page.locator('.el-map-svg [data-feature="CA-12"]')).toHaveClass(/is-selected/);
    await expect(page).not.toHaveURL(/geo=/);
  });

  test('keyboard: arrows rove the map, Enter selects, Escape returns', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard flow');
    await page.goto(console_('event=vic-2026&office=council'));
    await mapReady(page);
    const first = page.locator('.el-map-svg [tabindex="0"]');
    await first.focus();
    await page.keyboard.press('ArrowRight');
    const next = page.locator('.el-map-svg [data-feature="north-eastern-metropolitan"]');
    await expect(next).toBeFocused();
    await expect(page.locator('.el-map-svg [tabindex="0"]')).toHaveCount(1);
    await expect(page.locator('#el-map-readout')).toContainText('North-Eastern Metropolitan');
    await page.keyboard.press('Enter');
    await expect(page.locator('#el-drawer-title')).toContainText('North-Eastern Metropolitan');
    await page.keyboard.press('Escape');
    await expect(page.locator('#el-drawer')).toBeHidden();
    await expect(next).toBeFocused();
  });

  test('Back closes the drawer, Forward reopens it, and moving between seats adds no entries', async ({ page, isMobile }) => {
    await page.goto(console_('event=us-2026'));
    const before = await page.evaluate(() => history.length);
    await page.locator('.el-seat-link[data-seat="AL-01"]').click();
    await expect(page.locator('#el-drawer-title')).toHaveText('AL-01');
    await settled(page);
    await page.evaluate(() => document.querySelector('.el-seat-link[data-seat="AL-02"]').click());
    await expect(page.locator('#el-drawer-title')).toHaveText('AL-02');
    expect(await page.evaluate(() => history.length)).toBe(before + 1);
    await page.goBack();
    await expect(page.locator('#el-drawer')).toBeHidden();
    await expect(page).not.toHaveURL(/race=/);
    await expect(page.locator('h1')).toContainText('US 2026');
    await page.goForward();
    await expect(page.locator('#el-drawer-title')).toHaveText('AL-02');
    if (isMobile) await expect(page.locator('body')).toHaveClass(/el-sheet-open/);
  });

  test('phones load the map only when the panel opens, and keep it above the sheet', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'phone layout');
    const requests = [];
    page.on('request', (request) => { if (request.url().includes('/elections/maps/')) requests.push(request.url()); });
    await page.goto(console_('event=us-2026'));
    await page.locator('#el-explore-toggle').waitFor();
    await expect(page.locator('#el-explore-body')).toBeHidden();
    expect(requests).toEqual([]);
    await page.locator('#el-explore-toggle').click();
    await mapReady(page);
    expect(requests).toHaveLength(1);
    await clickFeature(page, 'TX-23');
    await page.locator('#el-drawer-title').waitFor();
    await settled(page);
    await page.evaluate(() => new Promise((resolve) => { setTimeout(resolve, 300); }));
    const [map, sheet] = await Promise.all([page.locator('.el-map-svg').boundingBox(), page.locator('#el-drawer').boundingBox()]);
    const header = await page.locator('#afflatus-header').boundingBox();
    expect(map.y).toBeGreaterThanOrEqual(header.height);
    expect(map.y + map.height).toBeLessThanOrEqual(sheet.y + 1);
    await noOverflow(page);
  });

  test('coverage counts the contests that are up, not the whole chamber', async ({ page }) => {
    for (const [query, text] of [['event=nsw-2027&office=council', 'Coverage 0/21'], ['event=au-2028&office=senate', 'Coverage 0/40']]) {
      await page.goto(console_(query));
      await expect(page.locator('.el-strip')).toContainText(text);
    }
  });

  test('NSW shows the date set by its Electoral Commission', async ({ page }) => {
    await page.goto(console_('event=nsw-2027'));
    await expect(page.locator('body')).toContainText('13 Mar 2027');
    await expect(page.locator('body')).not.toContainText('27 Mar 2027');
  });

  test('offices with no verified boundaries state the gap and draw no shape', async ({ page, isMobile }) => {
    for (const [query, text] of [
      ['event=au-2028', 'not settled'],
      ['event=au-2028&office=senate', 'whole states'],
      ['event=nsw-2027&office=council', 'state-wide'],
    ]) {
      await page.goto(console_(query));
      if (isMobile) await openToggle(page);
      await expect(page.locator('.el-geo-gap')).toContainText(text);
      await expect(page.locator('.el-map-svg')).toHaveCount(0);
      await expect(page.locator('[data-geo]')).toHaveCount(0);
      await expect(page.locator('#el-explore-title')).toHaveText('Seat blocks');
      await expect(page.locator('.el-tile-map [data-seat]').first()).toBeVisible();
      await expect(page.locator('.el-sources')).toContainText('no verified boundaries');
    }
  });

  test('partial coverage draws only verified features and lists the rest', async ({ page, isMobile }) => {
    await page.route('**/elections/maps/**/us-house.json', async (route) => {
      const response = await route.fetch();
      const map = await response.json();
      map.features = map.features.filter((feature) => !feature.id.startsWith('CA-'));
      await route.fulfill({ response, json: map });
    });
    await page.goto(console_('event=us-2026'));
    await openPanel(page, isMobile);
    await expect(page.locator('.el-map-svg [data-feature]')).toHaveCount(383);
    const gap = page.locator('#el-map-gap');
    await expect(gap).toContainText('52 of 435 seats have no verified boundary');
    await expect(gap).toContainText('Coverage 0/52');
    await expect(page.locator('.el-chamber-svg [data-seat]')).toHaveCount(435);
    await gap.locator('[data-seat="CA-12"]').click();
    await expect(page.locator('#el-drawer-title')).toHaveText('CA-12');
    await expect(page.locator('#el-zoom-seat')).toBeDisabled();
    await expect(page.locator('.el-chamber-svg [data-seat="CA-12"]')).toHaveClass(/is-selected/);
  });

  test('a failed map download falls back to the seat blocks', async ({ page, isMobile }) => {
    await page.route('**/elections/maps/**', (route) => route.abort());
    await page.goto(console_('event=vic-2026'));
    if (isMobile) await openToggle(page);
    await expect(page.locator('.el-map')).toContainText('The map could not load');
    await expect(page.locator('.el-map .el-tile-map [data-seat]')).toHaveCount(88);
    await expect(page.locator('.el-map-svg')).toHaveCount(0);
  });

  test('no result reaches the map, and history is explained rather than computed', async ({ page, isMobile }) => {
    await page.goto(console_('event=us-2026&race=TX-23'));
    await openPanel(page, isMobile);
    await expect(page.locator('.el-sources')).toContainText('nine states were redrawn for 2026');
    await expect(page.locator('#el-drawer')).toContainText('no verified crosswalk');
    await expect(page.locator('#el-explore-body')).not.toContainText(/winner:|flipped|gained/i);
    await expect(page.locator('.el-explore')).not.toContainText(/M4/);
    await expect(page.locator('.el-sources')).not.toContainText(/M4/);
  });

  test('the Chinese document labels the map in Chinese', async ({ page, isMobile }) => {
    await page.goto('/zh/elections.html?event=us-2026');
    await page.locator('#el-explore-title').waitFor();
    await openPanel(page, isMobile);
    await expect(page.locator('#el-explore-title')).toHaveText('地图');
    await expect(page.locator('.el-map-inset').first()).toContainText('插图');
    await expect(page.locator('.el-map')).toContainText('地图面积不代表席位权重');
    await noOverflow(page);
  });
});

test.describe('Elections accessibility', () => {
  for (const [name, path, ready] of [['hub', HUB, '.el-next'], ['console', console_('event=vic-2026&race=albert-park'), '#el-drawer-title'], ['House map', console_('event=us-2026&race=CA-12'), '.el-map-svg [data-feature]:not(.never)'], ['Senate map', console_('event=us-2026&office=senate'), '.el-map-svg [data-feature]:not(.never)']]) {
    test(`${name} has no serious axe violations`, async ({ page, isMobile }) => {
      await page.goto(path);
      await page.locator('#el-view > *').first().waitFor({ state: 'attached' }); // The bundle boots after load on built pages.
      if (isMobile && ready.includes('el-map-svg')) await page.locator('#el-explore-toggle').evaluate((element) => element.click());
      await page.locator(ready).first().waitFor({ state: 'attached' });
      await settled(page);
      const { violations } = await new AxeBuilder({ page }).include('main').analyze();
      expect(violations.filter((item) => ['serious', 'critical'].includes(item.impact)).map((item) => `${item.id}: ${item.nodes[0]?.target}`)).toEqual([]);
    });
  }
});

/* Everything below is synthetic, built by the real collector in a temp folder and
   served by a test route. The site itself has no feed address, as the first test proves. */
test.describe('Elections feed', () => {
  const FEED = '/elections-feed/';
  const at = (time) => `2026-11-04T${time}:00+11:00`;
  const stagesInput = [
    ['190000', [contestXml({ name: 'Albert Park', returned: 0, updated: '', votes: { a: 0, b: 0 } }), contestXml({ name: 'Bass', id: 101, updated: at('18:50'), votes: { a: 30, b: 20 } })]],
    ['200000', [contestXml({ name: 'Albert Park', updated: at('19:55'), votes: { a: 40, b: 30 }, tcp: { a: 45, b: 25 } }), contestXml({ name: 'Bass', id: 101, updated: at('19:50'), votes: { a: 60, b: 50 }, tcp: 'withheld' })]],
    ['203000', [contestXml({ name: 'Albert Park', updated: at('20:25'), votes: { a: 38, b: 31 }, tcp: { a: 44, b: 25 } }), contestXml({ name: 'Bass', id: 101, updated: at('20:20'), votes: { a: 60, b: 70 }, tcp: { a: 40, b: 90 } })]],
    ['210000', [contestXml({ name: 'Albert Park', updated: at('20:55'), votes: { a: 38, b: 31 }, tcp: { a: 44, b: 25 }, declared: true, elected: 'a' })]],
    ['213000', [contestXml({ name: 'Albert Park', updated: at('21:25'), votes: { a: 38, b: 31 }, tcp: { a: 44, b: 25 } }), contestXml({ name: 'Bass', id: 101, updated: at('21:20'), votes: { a: 61, b: 70 }, tcp: { a: 40, b: 91 } })]],
  ];
  let root;
  let stages;

  test.beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), 'el-e2e-'));
    const feedDir = join(root, 'feed');
    mkdirSync(feedDir);
    const lower = sourceById('vec-sample');
    const source = { ...lower, feeds: [lower.feeds[0]] };
    stages = [];
    for (const [time, contests] of stagesInput) {
      const stamp = `20261104_${time}`;
      const created = `2026-11-04T${time.slice(0, 2)}:${time.slice(2, 4)}:00`;
      writeFileSync(join(feedDir, lowerName(stamp)), zipOf('x.xml', feedXml({ contests, created })));
      await collectOnce({ source, store: join(root, 'store'), force: true, now: Date.parse(`${created}+11:00`), transport: directoryTransport(feedDir) });
      stages.push(JSON.parse(readFileSync(join(root, 'store', 'vic-2026', 'latest.json'), 'utf8')));
    }
  });

  test.afterAll(() => rmSync(root, { recursive: true, force: true }));

  async function serve(page, stage = 1) {
    const control = { stage, status: 200, requests: [], patchSnapshot: null };
    await page.addInitScript((base) => {
      window.__ELECTION_FEED_BASE__ = base;
    }, FEED);
    await page.route(`**${FEED}**`, (route) => {
      const path = new URL(route.request().url()).pathname.slice(FEED.length);
      control.requests.push(path);
      if (control.status !== 200) return route.fulfill({ status: control.status });
      if (path === 'vic-2026/latest.json') return route.fulfill({ json: stages[control.stage] });
      if (!path.startsWith('vic-2026/snapshots/')) return route.fulfill({ status: 404 });
      const snapshot = JSON.parse(readFileSync(join(root, 'store', path), 'utf8'));
      return route.fulfill({ json: control.patchSnapshot ? control.patchSnapshot(snapshot) : snapshot });
    });
    return control;
  }

  const row = (page, seat) => page.locator(`[data-row="${seat}"]`);
  const mark = (page, seat) => page.locator(`.el-chamber-svg [data-seat="${seat}"]`);
  // Only moves the feed along. A phone's open sheet covers this button; a real click is tested on its own below.
  const toStage = async (page, control, stage) => {
    await page.locator('#el-feed-toggle').evaluate((button) => button.click());
    await expect(page.locator('#el-feed-toggle')).toHaveText('Resume updates');
    control.stage = stage;
    await page.locator('#el-feed-toggle').evaluate((button) => button.click());
    await expect(page.locator('#el-feed-toggle')).toHaveText('Pause updates');
  };
  const open = async (page, query = 'event=vic-2026') => {
    await page.goto(console_(query));
    await expect(page.locator('.el-strip b')).toHaveText('Synthetic test data — not a real result');
  };

  test('the production path asks for no feed and shows no results', async ({ page }) => {
    const urls = [];
    page.on('request', (request) => urls.push(request.url()));
    await page.goto(console_('event=vic-2026'));
    await expect(page.locator('.el-chamber-svg .el-seat')).toHaveCount(88);
    await page.waitForLoadState('networkidle');
    expect(urls.filter((url) => /elections-feed|snapshots|civicapi|vec\.vic|latest\.json/.test(url))).toEqual([]);
    await expect(page.locator('.el-strip b')).toHaveText('Design preview — no live results');
    await expect(page.locator('.el-seat.is-leading, .el-seat.is-called, .el-seat.is-final, .el-seat.is-unavailable')).toHaveCount(0);
    await expect(page.locator('#el-feed-toggle')).toHaveCount(0);
    await expect(page.locator('.el-replay button')).toBeDisabled();
    await expect(page.locator('.el-tally-seg')).toHaveCount(0);
  });

  test('labels synthetic data everywhere it appears', async ({ page, isMobile }) => {
    await serve(page);
    await open(page);
    await expect(page.locator('.el-strip')).toContainText('Coverage 2/88');
    await expect(page.locator('.el-sources')).toContainText('synthetic test data');
    await expect(page.locator('#el-foot')).toContainText('Synthetic test data on this computer only');
    await row(page, 'albert-park').locator('button').click();
    await expect(page.locator('#el-drawer')).toContainText('Synthetic test data. Not a real result.');
    if (!isMobile) await noOverflow(page);
  });

  test('a 2CP lead is hatched, a withheld 2CP is not, and first preferences alone name no seat leader', async ({ page }) => {
    const control = await serve(page, 0);
    await open(page);
    await expect(mark(page, 'albert-park')).toHaveClass(/is-neutral/);
    await expect(mark(page, 'bass')).toHaveClass(/is-neutral/);
    await expect(row(page, 'bass')).toContainText('SYNTHETIC, Alpha');
    await expect(row(page, 'albert-park')).toContainText('Not yet counting');
    await expect(row(page, 'albert-park').locator('td').nth(2)).toHaveText('—');

    await toStage(page, control, 1);
    await expect(mark(page, 'albert-park')).toHaveClass(/is-leading/);
    await expect(mark(page, 'albert-park')).toHaveAttribute('style', /--seat:#C8302E/);
    await expect(mark(page, 'bass')).toHaveClass(/is-neutral/);
    await expect(row(page, 'bass')).toContainText('Withheld by source');
    await expect(page.locator('.el-tally-keys')).toContainText('+1 leading');
    await expect(page.locator('.el-tally-keys li').first().locator('b')).toHaveText('0');
    await expect(page.locator('.el-tally')).toContainText('never declares who controls a chamber');
  });

  test('a correction lowers the numbers and is labelled as one', async ({ page }) => {
    const control = await serve(page, 1);
    await open(page);
    await toStage(page, control, 2);
    await expect(page.locator('.el-changes')).toContainText('Correction');
    await row(page, 'albert-park').locator('button').click();
    await expect(page.locator('#el-drawer .el-cands').first()).toContainText('38');
  });

  test('a declaration fills the seat with its authority, and withdrawing it un-fills the seat', async ({ page }) => {
    const control = await serve(page, 2);
    await open(page, 'event=vic-2026&race=albert-park');
    await toStage(page, control, 3);
    await expect(mark(page, 'albert-park')).toHaveClass(/is-final/);
    await expect(page.locator('.el-tally-keys li').first().locator('b')).toHaveText('1');
    const drawer = page.locator('#el-drawer');
    await expect(drawer).toContainText('VEC · first seen in the feed');
    await expect(drawer).toContainText('the feed gives no declaration date');
    await expect(drawer.locator('.is-winner')).toContainText('SYNTHETIC, Alpha');

    await toStage(page, control, 4);
    await expect(mark(page, 'albert-park')).toHaveClass(/is-leading/);
    await expect(row(page, 'albert-park')).toContainText('Decision withdrawn');
    await expect(drawer).toContainText('has been withdrawn by the source');
    await expect(page.locator('.el-tally-keys li').first().locator('b')).toHaveText('0');
    await expect(page.locator('.el-changes')).toContainText('Decision withdrawn');
  });

  test('a contest a new file omits shows its own stale age, under a fresh check', async ({ page }) => {
    const control = await serve(page, 2);
    await open(page);
    await toStage(page, control, 3);
    await expect(page.locator('.el-strip')).toContainText('1 stale');
    await expect(row(page, 'bass').locator('.is-stale')).toContainText('stale');
    await expect(row(page, 'albert-park').locator('.is-stale')).toHaveCount(0);
    await expect(mark(page, 'bass')).toHaveClass(/is-leading/);
    await row(page, 'bass').locator('button').click();
    await expect(page.locator('#el-drawer')).toContainText('The source has not refreshed this contest');
  });

  test('a refresh keeps the selection, the focus, the scroll and the URL', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard flow');
    const control = await serve(page, 1);
    await open(page, 'event=vic-2026&race=albert-park');
    const url = page.url();
    await page.locator('#el-feed-toggle').click();
    control.stage = 2;
    await page.locator('#el-feed-toggle').focus();
    await page.evaluate(() => window.scrollTo(0, 300));
    await page.keyboard.press('Enter');
    await expect(page.locator('#el-drawer .el-cands').first()).toContainText('38');
    await expect(page.locator('#el-feed-toggle')).toBeFocused();
    await expect(page.locator('#el-drawer')).toBeVisible();
    await expect(page.locator('#el-drawer-title')).toHaveText('Albert Park');
    await expect(page.locator('.el-chamber-svg .is-selected')).toHaveAttribute('data-seat', 'albert-park');
    // A new party bar can grow the tally; the browser then anchors the scroll so the content does not jump.
    expect(Math.abs(await page.evaluate(() => window.scrollY) - 300)).toBeLessThan(40);
    expect(page.url()).toBe(url);
  });

  test('a focused seat mark keeps focus through a repaint', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard flow');
    const control = await serve(page, 0);
    await open(page);
    await page.evaluate(() => document.querySelector('.el-chamber-svg [data-seat="albert-park"]').focus());
    control.stage = 1;
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await expect(mark(page, 'albert-park')).toHaveClass(/is-leading/);
    await expect(mark(page, 'albert-park')).toBeFocused();
    await expect(page.locator('#el-live')).toContainText('Updated');
  });

  test('pause stops the checks and resume picks up what was missed', async ({ page }) => {
    const control = await serve(page, 0);
    await open(page);
    await page.locator('#el-feed-toggle').click();
    await expect(page.locator('.el-sources')).toContainText('Paused');
    control.stage = 1;
    const seen = control.requests.length;
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForTimeout(200);
    expect(control.requests.length).toBe(seen);
    await expect(mark(page, 'albert-park')).toHaveClass(/is-neutral/);
    await page.locator('#el-feed-toggle').click();
    await expect(mark(page, 'albert-park')).toHaveClass(/is-leading/);
  });

  test('each party gets its own bar against the majority line', async ({ page, isMobile }) => {
    await serve(page, 1);
    await open(page);
    const rows = page.locator('.el-tally-row');
    expect(await rows.count()).toBeGreaterThan(0);
    await expect(page.locator('.el-tally-bar')).toHaveCount(await rows.count());
    await expect(page.locator('.el-tally-mark')).toHaveCount(await rows.count());
    await expect(rows.first()).toContainText(/Labor|Coalition|Greens|Independent|Other/);
    if (!isMobile) {
      await page.setViewportSize({ width: 1024, height: 768 });
      const bar = await page.locator('.el-tally-bar').first().boundingBox();
      expect(bar.width).toBeGreaterThan(100);
    }
  });

  test('status words carry the party and a stale flag, at every width', async ({ page, isMobile }) => {
    const control = await serve(page, 1);
    await open(page);
    await expect(row(page, 'albert-park')).toContainText('Labor');
    await page.locator('#el-feed-toggle').evaluate((button) => button.click());
    control.patchSnapshot = (snapshot) => ({ ...snapshot, races: snapshot.races.map((race) => ({ ...race, coverage: 'stale' })) });
    await page.reload();
    await expect(row(page, 'albert-park').locator('.el-status')).toContainText('stale');
    if (!isMobile) await expect(mark(page, 'albert-park')).toHaveClass(/is-stale/);
    else await expect(row(page, 'albert-park').locator('.el-status')).toBeVisible();
  });

  test('a failed check keeps the last good data and says so, then recovers', async ({ page }) => {
    const control = await serve(page, 1);
    await open(page);
    await page.locator('#el-feed-toggle').click();
    control.status = 500;
    await page.locator('#el-feed-toggle').click();
    await expect(page.locator('#el-feed-note')).toContainText('This is the last good data');
    await expect(mark(page, 'albert-park')).toHaveClass(/is-leading/);
    await expect(page.locator('.el-strip b')).toHaveText('Synthetic test data — not a real result');
    control.status = 200;
    control.stage = 2;
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await expect(page.locator('#el-feed-note')).toHaveCount(0);
    await expect(page.locator('.el-changes')).toContainText('Correction');
  });

  test('a snapshot that does not match its pointer is refused', async ({ page }) => {
    const control = await serve(page, 1);
    await open(page);
    await page.locator('#el-feed-toggle').click();
    control.stage = 2;
    control.patchSnapshot = (snapshot) => ({ ...snapshot, snapshotId: 'something-else' });
    await page.locator('#el-feed-toggle').click();
    await expect(page.locator('#el-feed-note')).toContainText('This is the last good data');
    await expect(page.locator('.el-changes')).not.toContainText('Correction');
  });

  test('replay steps through recorded snapshots only and looks different from live', async ({ page }) => {
    const control = await serve(page, 4);
    await open(page);
    await page.locator('[data-replay="start"]').click();
    await expect(page.locator('.el-strip')).toHaveAttribute('data-mode', 'replay');
    await expect(page.locator('.el-strip b')).toHaveText('Replay of recorded snapshots — not live');
    await expect(page.locator('#el-replay-position')).toContainText('Snapshot 1 of 5');
    await expect(page.locator('#el-replay-position')).toContainText('4 Nov');
    await expect(mark(page, 'albert-park')).toHaveClass(/is-neutral/);
    await expect(page.locator('#el-feed-toggle')).toBeDisabled();

    await page.locator('[data-replay="next"]').click();
    await expect(page.locator('#el-replay-position')).toContainText('Snapshot 2 of 5');
    await expect(mark(page, 'albert-park')).toHaveClass(/is-leading/);
    await page.locator('#el-replay-range').fill('3');
    await expect(page.locator('#el-replay-position')).toContainText('Snapshot 4 of 5');
    await expect(mark(page, 'albert-park')).toHaveClass(/is-final/);
    await expect(page.locator('[data-replay="prev"]')).toBeEnabled();

    await page.locator('[data-replay="exit"]').click();
    await expect(page.locator('.el-strip')).toHaveAttribute('data-mode', 'synthetic');
    await expect(row(page, 'albert-park')).toContainText('Decision withdrawn');
    expect(control.requests.some((path) => path.includes('snapshots/'))).toBe(true);
  });

  test('a replay is not moved by new data', async ({ page }) => {
    const control = await serve(page, 3);
    await open(page);
    await page.locator('[data-replay="start"]').click();
    await expect(page.locator('#el-replay-position')).toContainText('of 4');
    control.stage = 4;
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await expect(page.locator('#el-replay-position')).toContainText('Snapshot 1 of 5');
    await expect(page.locator('.el-strip')).toHaveAttribute('data-mode', 'replay');
    await expect(mark(page, 'albert-park')).toHaveClass(/is-neutral/);
  });

  test('replay needs at least two recorded snapshots', async ({ page }) => {
    await serve(page, 0);
    await open(page);
    await expect(page.locator('.el-replay button')).toBeDisabled();
    await expect(page.locator('.el-replay')).toContainText('only one recorded snapshot');
  });

  test('text from a feed is escaped', async ({ page }) => {
    const control = await serve(page, 1);
    control.patchSnapshot = (snapshot) => ({ ...snapshot, races: snapshot.races.map((race) => ({ ...race, candidates: race.candidates.map((candidate) => ({ ...candidate, name: '<img src=x id=el-injected>' })) })) });
    await open(page, 'event=vic-2026&race=albert-park');
    await expect(page.locator('#el-drawer .el-cands').first()).toContainText('<img src=x id=el-injected>');
    await expect(page.locator('#el-injected')).toHaveCount(0);
  });

  test('moving to another event drops the data and its controls', async ({ page }) => {
    await serve(page, 1);
    await open(page);
    await page.locator('.el-events a', { hasText: 'US 2026' }).click();
    await expect(page.locator('.el-strip b')).toHaveText('Design preview — no live results');
    await expect(page.locator('.el-strip')).toContainText('Coverage 0/435');
    await expect(page.locator('.el-seat.is-leading')).toHaveCount(0);
    await expect(page.locator('#el-feed-toggle')).toHaveCount(0);
  });

  test('the Chinese document labels synthetic data and its states in Chinese', async ({ page }) => {
    await serve(page, 1);
    await page.goto('/zh/elections.html?event=vic-2026');
    await expect(page.locator('.el-strip b')).toHaveText('合成测试数据 — 不是真实结果');
    await expect(row(page, 'bass')).toContainText('来源暂不公布');
    await expect(page.locator('#el-foot')).toContainText('合成测试数据，只在本机显示');
    await noOverflow(page);
  });

  test('the race table with data still fits a phone, in both languages', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'phone layout');
    await page.setViewportSize({ width: 390, height: 844 });
    await serve(page, 1);
    for (const path of ['/en/elections.html?event=vic-2026', '/zh/elections.html?event=vic-2026']) {
      await page.goto(path);
      await expect(page.locator('.el-strip')).toHaveAttribute('data-mode', 'synthetic');
      const overflow = await page.locator('.el-table-scroll').evaluate((element) => element.scrollWidth - element.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      await noOverflow(page);
    }
  });

  test('has no serious axe violations with data on screen', async ({ page }) => {
    await serve(page, 2);
    await open(page, 'event=vic-2026&race=albert-park');
    await settled(page);
    const { violations } = await new AxeBuilder({ page }).include('main').analyze();
    expect(violations.filter((item) => ['serious', 'critical'].includes(item.impact)).map((item) => `${item.id}: ${item.nodes[0]?.target}`)).toEqual([]);
  });

  test('has no serious axe violations during a replay', async ({ page }) => {
    await serve(page, 4);
    await open(page);
    await page.locator('[data-replay="start"]').click();
    await expect(page.locator('#el-replay-position')).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).include('main').analyze();
    expect(violations.filter((item) => ['serious', 'critical'].includes(item.impact)).map((item) => `${item.id}: ${item.nodes[0]?.target}`)).toEqual([]);
  });
});
