const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1400 } });

  await page.goto('http://localhost:9999');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  console.log('Page loaded, taking initial screenshot...');
  await page.screenshot({ path: './screenshots/debug-1-loaded.png' });

  // Navigate to Suites
  console.log('Clicking Suites...');
  await page.locator('text=Suites').click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: './screenshots/debug-2-suites.png' });

  // Find ALL links/rows and list them
  const allLinks = await page.locator('a').all();
  console.log(`Found ${allLinks.length} links`);

  for (let i = 0; i < Math.min(allLinks.length, 20); i++) {
    const text = await allLinks[i].textContent();
    console.log(`Link ${i}: "${text}"`);
  }

  // Click specifically on the link containing "Global Setup"
  console.log('Clicking Global Setup link...');
  await page.locator('a:has-text("Global Setup")').first().click();
  await page.waitForTimeout(3000);

  await page.screenshot({ path: './screenshots/debug-3-global-detail.png' });

  console.log('Press Ctrl+C to close browser...');
  await page.waitForTimeout(30000);

  await browser.close();
})();
