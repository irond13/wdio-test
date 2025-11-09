const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1920, height: 1400 } });
  const page = await context.newPage();

  await page.goto('http://localhost:9999');
  await page.waitForSelector('.widget', { timeout: 15000 });
  await page.waitForTimeout(2000);

  // Navigate to Suites
  await page.click('text=Suites');
  await page.waitForTimeout(2000);

  // Click on row #5 which is "Global Setup: (root)"
  console.log('Clicking on Global Setup entry...');
  await page.click('text=Global Setup: (root)');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/tmp/global-setup-detail.png', fullPage: true });

  // Try to expand all visible toggles
  console.log('Expanding all steps...');
  const toggles = await page.locator('[class*="toggle"], [class*="title"]:has-text("beforeAll")').all();
  for (let i = 0; i < Math.min(toggles.length, 5); i++) {
    try {
      await toggles[i].click({ timeout: 500 });
      await page.waitForTimeout(300);
    } catch (e) {}
  }

  await page.screenshot({ path: '/tmp/global-setup-expanded.png', fullPage: true });

  await browser.close();
  console.log('Screenshots saved!');
})();
