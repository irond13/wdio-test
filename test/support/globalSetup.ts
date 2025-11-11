/**
 * Global Mocha Setup
 * ===================
 *
 * Runs once per worker process (not once per test suite).
 * Establishes baseline browser state before any tests run.
 *
 * Source: https://mochajs.org/next/features/global-fixtures/
 */

import { browser } from '@wdio/globals'
import { step } from 'allure-js-commons'

/**
 * mochaHooks with root-level beforeAll
 * Runs once per spec file, captured by AllureFailingHookReporter
 */
export const mochaHooks = async () => {
  const getLogger = (await import('@wdio/logger')).default;
  const log = getLogger('globalSetup');

  return {
    beforeAll: async function() {
      log.info('Starting global setup');

      await step('Global Mocha step 1', async () => {
        log.debug('Executing global Mocha hook step 1');
        await browser.url('https://example.org');
      });

      await step('Global Mocha step 2: screenshot', async () => {
        log.debug('Taking global Mocha screenshot');
        await browser.takeScreenshot();
      });

      log.info('Global Mocha hook completed');

      // Enable global failure via: GLOBAL_HOOK_FAIL=1 npm run test
      if (process.env.GLOBAL_HOOK_FAIL) {
        log.error('Global hook intentionally failing (GLOBAL_HOOK_FAIL set)');
        throw new Error('Global Mocha hook failure - should be captured in Allure!');
      }
    }
  };
};
