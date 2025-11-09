const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  console.log('Loading Allure report...');
  await page.goto('http://localhost:9999');

  // Wait for data to load
  await page.waitForSelector('.widget', { timeout: 15000 });
  await page.waitForTimeout(2000);

  console.log('Capturing overview...');
  await page.screenshot({ path: '/tmp/allure-overview.png', fullPage: true });

  // Navigate to Suites
  console.log('Navigating to Suites...');
  await page.click('text=Suites');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/tmp/allure-suites.png', fullPage: true });

  // Click on a test with nested steps
  console.log('Opening test with nested steps...');
  const nestedStepTest = await page.locator('text="before all" hook for beforeAll with nested steps and screenshots').first();
  if (await nestedStepTest.count() > 0) {
    await nestedStepTest.click();
    await page.waitForTimeout(2000);

    // Expand the "Set up" section to show nested steps
    console.log('Expanding Set up section...');
    await page.click('text=Set up');
    await page.waitForTimeout(1000);

    // Expand the hook to show nested steps inside
    console.log('Expanding hook...');
    const hookToggle = await page.locator('.step__toggle').first();
    if (await hookToggle.count() > 0) {
      await hookToggle.click();
      await page.waitForTimeout(1000);
    }

    await page.screenshot({ path: '/tmp/allure-test-detail.png', fullPage: true });
  }

  await browser.close();
  console.log('Screenshots saved!');
})();
