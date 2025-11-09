const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1920, height: 1400 } });
  const page = await context.newPage();

  // Navigate directly to the specific test by UUID
  const uuid = '157198eb-7eeb-4a30-ba07-7b4879463834';
  console.log('Opening test with nested steps...');
  await page.goto(`http://localhost:9999/#suites/${uuid}`);
  await page.waitForTimeout(3000);

  await page.screenshot({ path: '/tmp/nested-steps-collapsed.png', fullPage: true });

  // Click all expand arrows/toggles
  console.log('Expanding all steps...');
  const allClickables = await page.locator('button, [role="button"], .pane__section-title, .step__title').all();
  for (const elem of allClickables) {
    try {
      await elem.click({ timeout: 300 });
      await page.waitForTimeout(200);
    } catch (e) {}
  }

  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/nested-steps-expanded.png', fullPage: true });

  await browser.close();
  console.log('Done!');
})();
