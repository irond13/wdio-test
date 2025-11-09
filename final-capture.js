const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1920, height: 1400 } });
  const page = await context.newPage();

  await page.goto('http://localhost:9999');
  await page.waitForSelector('.widget', { timeout: 15000 });
  await page.waitForTimeout(2000);

  // 1. Capture overview
  await page.screenshot({ path: '/tmp/1-overview.png', fullPage: false });

  // 2. Navigate to Suites and capture
  await page.click('text=Suites');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/tmp/2-suites-list.png', fullPage: false });

  // 3. Click on "Global Setup: (root)" entry
  console.log('Clicking Global Setup entry...');
  const globalSetup = await page.locator('text=/^Global Setup:.*root/').first();
  await globalSetup.click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/tmp/3-global-setup-collapsed.png', fullPage: true });

  // 4. Expand all steps to show nested structure
  console.log('Expanding all steps...');
  const allToggles = await page.locator('[class*="toggle"]').all();
  for (const toggle of allToggles) {
    try {
      await toggle.click({ timeout: 200 });
      await page.waitForTimeout(200);
    } catch (e) {}
  }
  await page.screenshot({ path: '/tmp/4-global-setup-expanded.png', fullPage: true });

  await browser.close();
  console.log('All validation screenshots saved!');
})();
