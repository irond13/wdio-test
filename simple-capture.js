const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1400 } });

  await page.goto('http://localhost:9999/#suites');
  await page.waitForTimeout(5000);

  // Click on 5th row in the table (Global Setup)
  console.log('Clicking row 5...');
  const rows = await page.locator('tbody tr').all();
  console.log(`Found ${rows.length} rows`);
  if (rows.length >= 5) {
    await rows[4].click(); // 0-indexed, so row 5 is index 4
    await page.waitForTimeout(3000);
  }

  await page.screenshot({ path: './screenshots/3-global-setup-detail.png', fullPage: true });

  await browser.close();
  console.log('Screenshot saved!');
})();
