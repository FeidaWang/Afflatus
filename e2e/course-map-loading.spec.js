import {test,expect} from './site-fixture.js';
test('course map loads cover art when the visitor enters the map',async({page})=>{
  await page.goto('/en/course.html');
  await expect(page.locator('.hope-node')).toHaveCount(24);
  await expect(page.locator('.hope-node').first()).toHaveCSS('background-image','none');
  await page.locator('#courseStart').click();
  await expect(page.locator('#hopeMap')).toHaveClass(/is-interactive/);
  await expect(page.locator('.hope-node[style*="background-image"]')).toHaveCount(24);
});
