const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1400 } });

  await page.goto('http://localhost:9999');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Navigate to Suites using the nav link
  console.log('Navigating to Suites...');
  await page.locator('.side-nav__text:has-text("Suites")').click();
  await page.waitForTimeout(2000);

  // Click on the link with text "Global Setup"
  console.log('Clicking Global Setup entry...');
  await page.locator('a:has-text("Global Setup")').click();
  await page.waitForTimeout(2000);

  console.log('Capturing detail page...');
  await page.screenshot({ path: './screenshots/3-global-setup-detail.png', fullPage: true });

  await browser.close();
  console.log('Done!');
})();
