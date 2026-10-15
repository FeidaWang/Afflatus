import {test,expect} from './site-fixture.js';
test('decorative simulations complete in a worker and initialize the footer on view',async({page})=>{
  await page.goto('/en/portfolio.html');
  await expect(page.locator('#pfTiles')).toHaveAttribute('data-simulation-ready','true');
  const finale=page.locator('#pfFinale');
  await finale.scrollIntoViewIfNeeded();
  await expect(finale).toHaveAttribute('data-simulation-ready','true');
});
