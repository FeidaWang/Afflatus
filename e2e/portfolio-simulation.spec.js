import {test,expect} from './site-fixture.js';
test('decorative simulations complete in a worker and initialize the footer on view',async({page})=>{
  await page.goto('/en/portfolio.html');
  await expect(page.locator('#pfTiles')).toHaveAttribute('data-simulation-ready','true');
  const finale=page.locator('#pfFinale');
  await finale.scrollIntoViewIfNeeded();
  await expect(finale).toHaveAttribute('data-simulation-ready','true');
});
test('distant charts retain geometry and render when approached',async({page})=>{
  await page.goto('/en/portfolio.html');
  const scatter=page.locator('#pfScatter > svg');
  await expect(scatter).toHaveCount(1);
  await expect(scatter.locator('.pf-sc-dot')).toHaveCount(0);
  await scatter.scrollIntoViewIfNeeded();
  await expect(scatter.locator('.pf-sc-dot')).toHaveCount(63);
  const waffle=page.locator('#pfBookWaffle > svg');
  await waffle.scrollIntoViewIfNeeded();
  await expect(waffle.locator('.pf-wf-cell')).toHaveCount(100);
});
