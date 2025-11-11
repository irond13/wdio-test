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
 * Global setup - runs once per worker process
 * Uses closure to initialize logger and avoid module-level state
 */
export const mochaGlobalSetup = async () => {
  const getLogger = (await import('@wdio/logger')).default
  const log = getLogger('globalSetup')

  log.info('Starting global setup')

  await step('Global Mocha step 1', async () => {
    log.debug('Executing global Mocha hook step 1')
    await browser.url('https://example.org')
  })

  await step('Global Mocha step 2: screenshot', async () => {
    log.debug('Taking global Mocha screenshot')
    await browser.takeScreenshot()
  })

  log.info('Global Mocha hook completed')

  // Uncomment to test global hook failure killing ALL tests:
  // throw new Error('Global Mocha hook failure - should kill ALL tests!')
}
