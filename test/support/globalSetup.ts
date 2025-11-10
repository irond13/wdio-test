// True Mocha global hook with TypeScript
// Loaded via mochaOpts.require

import { browser } from '@wdio/globals'
import { step } from 'allure-js-commons'

// Access Mocha's global 'before' function
// It's not exported from @wdio/globals, but is available globally
declare const before: (name: string | Function, fn?: Function) => void

// Wait for next tick to ensure Mocha globals are set up
process.nextTick(() => {
  if (typeof before === 'function') {
    before('Global Mocha beforeAll', async function() {
      await step('Global Mocha step 1', async () => {
        console.log('[GLOBAL MOCHA] Executing global Mocha hook step 1')
        await browser.url('https://example.org')
      })

      await step('Global Mocha step 2: screenshot', async () => {
        console.log('[GLOBAL MOCHA] Taking global Mocha screenshot')
        await browser.takeScreenshot()
      })

      console.log('[GLOBAL MOCHA] Global Mocha hook completed')

      // Test: Does error in global Mocha hook stop ALL tests?
      // throw new Error('Global Mocha hook failure - should kill ALL tests!')
    })
  } else {
    console.error('[GLOBAL SETUP] before() is not available!')
  }
})
