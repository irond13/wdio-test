const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1400 } });

  await page.goto('http://localhost:9999');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Navigate to Suites
  await page.locator('.side-nav__text:has-text("Suites")').click();
  await page.waitForTimeout(2000);

  // Click on the WDIO "before all" hook test that HAS nested steps
  console.log('Clicking test with nested steps...');
  await page.locator('a:has-text("beforeAll with nested steps and screenshots")').first().click();
  await page.waitForTimeout(2000);

  await page.screenshot({ path: './screenshots/4-wdio-hook-with-steps.png', fullPage: true });

  await browser.close();
  console.log('Screenshot saved!');
})();
