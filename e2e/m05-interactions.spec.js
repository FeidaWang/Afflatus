import { expect, test } from './site-fixture.js';

const screenshots = 'docs/refactor/screenshots';

async function waitForHome(page, path = '/?experience=static') {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-chapter="01-cold-void"]').waitFor({ state: 'visible' });
  await page.evaluate(() => document.fonts?.ready);
}

test.describe('M05 Command Button states', () => {
  test('keeps pointer movement bounded and the layout box stable', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium');
    await waitForHome(page);

    const toggle = page.getByRole('switch', { name: /Motion/ });
    if (await toggle.getAttribute('aria-checked') === 'false') await toggle.click();

    const command = page.getByRole('button', { name: 'Enter Command' });
    const before = await command.boundingBox();
    await page.mouse.move(before.x + before.width - 2, before.y + 3);
    await expect(command).toHaveAttribute('data-interaction-state', 'pointer-hover');

    const offset = await command.evaluate((node) => ({
      x: Number.parseFloat(node.style.getPropertyValue('--command-x')),
      y: Number.parseFloat(node.style.getPropertyValue('--command-y')),
    }));
    expect(Math.abs(offset.x)).toBeLessThanOrEqual(5);
    expect(Math.abs(offset.y)).toBeLessThanOrEqual(5);
    expect(Math.abs(offset.x) + Math.abs(offset.y)).toBeGreaterThan(0);

    const during = await command.boundingBox();
    expect(during).toEqual(before);
    await command.dispatchEvent('pointerdown', { pointerType: 'mouse' });
    await expect(command).toHaveAttribute('data-interaction-state', 'pointer-down');
    await command.dispatchEvent('pointerup', { pointerType: 'mouse' });
    await expect(command).toHaveAttribute('data-interaction-state', 'release');
  });

  test('keyboard focus is immediate, magnetic-free and trapped inside Command preview', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium');
    await waitForHome(page);

    const command = page.getByRole('button', { name: 'Enter Command' });
    await page.locator('body').press('Tab');
    for (let index = 0; index < 8 && !(await command.evaluate((node) => node === document.activeElement)); index += 1) {
      await page.keyboard.press('Tab');
    }
    await expect(command).toBeFocused();
    await expect(command).toHaveAttribute('data-interaction-state', 'focus');
    await expect(command).toHaveCSS('outline-style', 'solid');
    expect(await command.evaluate((node) => [
      node.style.getPropertyValue('--command-x') || '0px',
      node.style.getPropertyValue('--command-y') || '0px',
    ])).toEqual(['0px', '0px']);
    await page.screenshot({ path: `${screenshots}/m05-keyboard-focus-1440x1000.png` });

    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(page.locator('.command-preview-close')).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(page.locator('.command-preview a')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(command).toBeFocused();
  });
});

test.describe('M05 Motion Toggle', () => {
  test('persists an explicit setting across reload', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium');
    await page.addInitScript(() => {
      if (sessionStorage.getItem('m05-motion-seeded')) return;
      localStorage.setItem('afflatus:motion:v1', 'off');
      sessionStorage.setItem('m05-motion-seeded', 'true');
    });
    await waitForHome(page);
    const toggle = page.getByRole('switch', { name: /Motion/ });
    const initial = await toggle.getAttribute('aria-checked');
    expect(initial).toBe('false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'on');
    expect(await page.evaluate(() => localStorage.getItem('afflatus:motion:v1'))).toBe('on');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('switch', { name: /Motion/ })).toHaveAttribute('aria-checked', 'true');
  });

  test('touch never receives hover-dependent displacement', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'galaxy-s26-ultra-chromium');
    await waitForHome(page);
    await page.evaluate(() => {
      localStorage.setItem('afflatus:motion:v1', 'on');
      location.reload();
    });
    await page.waitForLoadState('domcontentloaded');
    const command = page.getByRole('button', { name: 'Enter Command' });
    await command.dispatchEvent('pointermove', { pointerType: 'touch', clientX: 300, clientY: 20 });
    await expect(command).toHaveAttribute('data-interaction-state', 'idle');
    expect(await command.evaluate((node) => [
      node.style.getPropertyValue('--command-x') || '0px',
      node.style.getPropertyValue('--command-y') || '0px',
    ])).toEqual(['0px', '0px']);
    await page.screenshot({ path: `${screenshots}/m05-touch-412x892.png` });
  });

  test('reduced experience locks all authored motion off', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-16-pro-max-webkit');
    await waitForHome(page, '/?experience=reduced');
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'off');
    const toggle = page.getByRole('switch', { name: /Motion/ });
    await expect(toggle).toBeDisabled();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    const command = page.getByRole('button', { name: 'Enter Command' });
    expect(await command.evaluate((node) => getComputedStyle(node.querySelector('.command-button__surface')).transform)).toBe('none');
    await page.screenshot({ path: `${screenshots}/m05-reduced-motion-440x956.png`, fullPage: false });
  });
});
