const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1920, height: 1400 } });
  const page = await context.newPage();

  await page.goto('http://localhost:9999');
  await page.waitForTimeout(3000);

  // Navigate to Suites
  await page.click('text=Suites');
  await page.waitForTimeout(2000);

  //  Click the table row containing "Global Setup"
  console.log('Clicking Global Setup row...');
  const row = await page.locator('tr:has-text("Global Setup: (root)")').first();
  await row.click();
  await page.waitForTimeout(3000);

  console.log('Capturing detail view...');
  await page.screenshot({ path: './screenshots/global-setup-detail.png', fullPage: true });

  // Scroll down and look for steps section
  await page.evaluate(() => window.scrollTo(0, 300));
  await page.waitForTimeout(500);
  await page.screenshot({ path: './screenshots/global-setup-scrolled.png', fullPage: true });

  await browser.close();
  console.log('Done!');
})();
