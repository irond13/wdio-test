/**
 * Global Mocha Setup - FAILING VERSION for testing
 * ==================================================
 *
 * Demonstrates global hook failure that kills ALL tests in worker.
 */

import { browser } from '@wdio/globals';
import { step } from 'allure-js-commons';

export const mochaGlobalSetup = async () => {
  const getLogger = (await import('@wdio/logger')).default;
  const log = getLogger('globalSetup');

  log.info('Starting global setup (will fail)');

  await step('Global Mocha step 1', async () => {
    log.debug('Executing global Mocha hook step 1');
    await browser.url('https://example.org');
  });

  await step('Global Mocha step 2: screenshot before failure', async () => {
    log.debug('Taking screenshot before intentional failure');
    await browser.takeScreenshot();
  });

  log.error('Global hook about to fail');
  throw new Error('Global Mocha hook failure - should kill ALL tests!');
};
