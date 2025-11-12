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

export const mochaGlobalSetup = async () => {
  const getLogger = (await import('@wdio/logger')).default;
  const log = getLogger('globalSetup');

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
    log.error('Global setup intentionally failing (GLOBAL_HOOK_FAIL set)');
    throw new Error('Global setup failure - captured by AllureFailingHookReporter!');
  }
};
