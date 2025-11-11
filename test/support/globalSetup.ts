/**
 * Global Mocha Setup Hook
 * ========================
 *
 * Provides global beforeAll hook that runs once per worker process.
 * Demonstrates Mocha root hook plugin pattern and establishes baseline browser state.
 *
 * Source: https://mochajs.org/#root-hook-plugins
 */

import { browser } from '@wdio/globals'
import { step } from 'allure-js-commons'

/**
 * mochaHooks as async function - allows logger initialization in closure
 * Avoids module-level 'any' types
 */
export const mochaHooks = async () => {
  const getLogger = (await import('@wdio/logger')).default
  const log = getLogger('globalSetup')

  return {
    beforeAll: async function() {
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
  }
}
