// True Mocha global hook with TypeScript
// Loaded via mochaOpts.require

import { before, browser } from '@wdio/globals'
import { step } from 'allure-js-commons'

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
})
