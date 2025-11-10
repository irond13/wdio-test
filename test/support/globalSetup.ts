// Mocha Root Hook Plugin - The Proper Way!
// See: https://mochajs.org/#root-hook-plugins

import { browser } from '@wdio/globals'
import { step } from 'allure-js-commons'

export const mochaHooks = {
  beforeAll: async function() {
    console.log('[GLOBAL MOCHA ROOT HOOK] Starting global setup')

    await step('Global Mocha step 1', async () => {
      console.log('[GLOBAL MOCHA] Executing global Mocha hook step 1')
      await browser.url('https://example.org')
    })

    await step('Global Mocha step 2: screenshot', async () => {
      console.log('[GLOBAL MOCHA] Taking global Mocha screenshot')
      await browser.takeScreenshot()
    })

    console.log('[GLOBAL MOCHA] Global Mocha hook completed')

    // Uncomment to test global hook failure killing ALL tests:
    // throw new Error('Global Mocha hook failure - should kill ALL tests!')
  }
}
