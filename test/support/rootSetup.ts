/**
 * Root Mocha Setup Hook
 * ======================
 *
 * Runs once per spec file (before all tests in that spec).
 * Establishes baseline browser state and is capturable by AllureFailingHookReporter.
 *
 * Trade-off: Runs per-spec instead of once-per-worker, but this allows Allure
 * to capture failures (mochaGlobalSetup failures kill process before reporters run).
 *
 * Source: https://mochajs.org/#root-hook-plugins
 */

import { browser } from '@wdio/globals';
import { step } from 'allure-js-commons';

/**
 * Root beforeAll hook - runs once per spec file
 * Failures are captured by AllureFailingHookReporter with steps/screenshots/logs
 */
export const mochaHooks = async () => {
  const getLogger = (await import('@wdio/logger')).default;
  const log = getLogger('rootSetup');

  return {
    beforeAll: async function() {
      log.info('Starting root setup');

      await step('Root setup step 1: Navigate', async () => {
        log.debug('Navigating to example.org');
        await browser.url('https://example.org');
      });

      await step('Root setup step 2: Screenshot', async () => {
        log.debug('Taking root setup screenshot');
        await browser.takeScreenshot();
      });

      log.info('Root setup completed');

      // Enable root hook failure via: ROOT_HOOK_FAIL=1 npm run test
      if (process.env.ROOT_HOOK_FAIL) {
        log.error('Root hook intentionally failing (ROOT_HOOK_FAIL set)');
        throw new Error('Root beforeAll hook failure - captured in Allure!');
      }
    }
  };
};
