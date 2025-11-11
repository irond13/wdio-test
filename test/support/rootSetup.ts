/**
 * Root Setup Hook
 * ================
 *
 * Runs once per worker process using module-level flag.
 * Must use mochaHooks (not mochaGlobalSetup) because Allure can only capture
 * events from hooks that execute within the Mocha runner lifecycle.
 *
 * Why not mochaGlobalSetup:
 * - Executes BEFORE runner starts emitting events
 * - WDIO reporters attach listeners AFTER mochaGlobalSetup runs
 * - Failures occur in event-free "no-man's land"
 * - Source: node_modules/mocha/lib/mocha.js lines 1007 (globalSetup) vs 1094 (EVENT_RUN_BEGIN)
 *
 * Source: https://mochajs.org/#root-hook-plugins
 */

import { browser } from '@wdio/globals';
import { step } from 'allure-js-commons';

// Module-level flag - each worker is separate process with own memory
let hasRun = false;

export const mochaHooks = async () => {
  const getLogger = (await import('@wdio/logger')).default;
  const log = getLogger('rootSetup');

  return {
    beforeAll: async function() {
      // Only run once per worker (flag prevents re-execution across multiple specs)
      if (hasRun) {
        log.debug('Root setup already ran in this worker, skipping');
        return;
      }
      hasRun = true;

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

      // Enable failure via: GLOBAL_HOOK_FAIL=1 npm run test
      if (process.env.GLOBAL_HOOK_FAIL) {
        log.error('Root hook intentionally failing (GLOBAL_HOOK_FAIL set)');
        throw new Error('Root setup failure - captured in Allure!');
      }
    }
  };
};
