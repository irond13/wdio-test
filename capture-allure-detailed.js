const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1920, height: 1200 } });
  const page = await context.newPage();

  console.log('Loading Allure report...');
  await page.goto('http://localhost:9999');
  await page.waitForSelector('.widget', { timeout: 15000 });
  await page.waitForTimeout(2000);

  // Navigate to Suites
  console.log('Navigating to Suites...');
  await page.click('text=Suites');
  await page.waitForTimeout(2000);

  // Find and click "Global Setup: (root)" entry WITH steps
  console.log('Looking for Global Setup with nested steps...');
  const globalSetupTests = await page.locator('text=/Global Setup:.*root/').all();

  for (let i = 0; i < globalSetupTests.length; i++) {
    await globalSetupTests[i].click();
    await page.waitForTimeout(1500);

    // Check if this entry has steps by looking for "Set up" or "Execution" section
    const hasSetup = await page.locator('text=Set up').count() > 0;
    const hasBody = await page.locator('text=beforeAll start').count() > 0;

    if (hasSetup || hasBody) {
      console.log(`Found Global Setup entry ${i} with steps!`);

      // Expand Set up if it exists
      if (hasSetup) {
        await page.click('text=Set up');
        await page.waitForTimeout(500);
      }

      // Expand all step toggles recursively
      const toggles = await page.locator('.step__toggle').all();
      for (const toggle of toggles) {
        try {
          await toggle.click({ timeout: 500 });
          await page.waitForTimeout(300);
        } catch (e) {}
      }

      await page.screenshot({ path: `/tmp/global-setup-${i}-expanded.png`, fullPage: true });
      break;
    }
  }

  await browser.close();
  console.log('Screenshots saved!');
})();
