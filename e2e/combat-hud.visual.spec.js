import { expect, settlePage, test } from './site-fixture.js';

test.describe('CIC HUD visual contract', () => {
  test('keeps the namespaced shell stable at desktop and mobile widths', async ({ page }, testInfo) => {
    await page.goto('/?combatview=2d', { waitUntil: 'domcontentloaded' });
    await settlePage(page);
    await page.evaluate(() => {
      document.body.classList.remove('hud-off');
      const hud = document.querySelector('#combatHud');
      hud?.setAttribute('aria-hidden', 'false');
    });
    await page.addStyleTag({
      content: `
        #cicPilotFeed,
        #cicRadarCanvas,
        #cicBattleFeed,
        #cicThreatReadout,
        #cicPerfReadout,
        #battleLog,
        #combatHud .cic-condition-grid b,
        #combatHud .cic-weapon-state,
        #combatHud .cic-recommend,
        #combatHud .cic-weapon-rail i {
          visibility: hidden !important;
        }
        #combatHud .cic-weapon {
          border-color: rgba(130, 216, 244, 0.22) !important;
          background: #050a0f !important;
          box-shadow: none !important;
          transform: none !important;
        }
        #combatHud .cic-viewport {
          background:
            radial-gradient(circle at 52% 44%, rgba(80, 176, 202, .16), transparent 28%),
            linear-gradient(155deg, #0b1823, #030609 72%) !important;
        }
      `,
    });

    const shell = page.locator('#combatHud .cic-shell');
    await expect(shell).toBeVisible();
    const metrics = await shell.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const columns = getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean);
      return {
        heightRatio: box.height / window.innerHeight,
        columns: columns.length,
        viewportWidth: window.innerWidth,
      };
    });

    if (metrics.viewportWidth <= 860) {
      expect(metrics.heightRatio).toBeGreaterThanOrEqual(0.25);
      expect(metrics.heightRatio).toBeLessThanOrEqual(0.28);
      expect(metrics.columns).toBe(1);
    } else {
      expect(metrics.columns).toBe(3);
    }

    await expect(shell).toHaveScreenshot(`cic-shell-${testInfo.project.name}.png`, {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      maxDiffPixelRatio: 0.006,
    });
  });
});
