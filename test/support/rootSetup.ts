/**
 * Global Mocha Setup
 * ===================
 *
 * Runs once per worker process via mochaGlobalSetup.
 * Registers a root before() hook that will be captured by AllureFailingHookReporter if it fails.
 *
 * Source: https://mochajs.org/next/features/global-fixtures/
 */

import { browser } from '@wdio/globals';
import { step } from 'allure-js-commons';

// Track if setup has run in this worker process
let hasRun = false;

export const mochaGlobalSetup = async () => {
  const getLogger = (await import('@wdio/logger')).default;
  const log = getLogger('globalSetup');

  // Register root before() hook that only executes once per worker
  before('Global setup', async function() {
    if (hasRun) {
      log.debug('Setup already ran in this worker, skipping');
      return;
    }
    hasRun = true;

    log.info('Starting global setup');

    await step('Global setup step 1: Navigate', async () => {
      log.debug('Navigating to example.org');
      await browser.url('https://example.org');
    });

    await step('Global setup step 2: Screenshot', async () => {
      log.debug('Taking global setup screenshot');
      await browser.takeScreenshot();
    });

    log.info('Global setup completed');

    // Enable failure via: GLOBAL_HOOK_FAIL=1 npm run test
    if (process.env.GLOBAL_HOOK_FAIL) {
      log.error('Global hook intentionally failing (GLOBAL_HOOK_FAIL set)');
      throw new Error('Global setup failure - captured in Allure!');
    }
  });
};
