// True global hooks that run once for ALL specs across ALL workers
// Configured via mochaOpts.require in wdio.conf.ts

import { step } from 'allure-js-commons'

// Use global before() provided by Mocha
declare const before: (name: string, fn: () => void | Promise<void>) => void

before('Global setup with steps', async function() {
  await step('Global setup step 1', async () => {
    console.log('[GLOBAL HOOK] Step 1 executed')
  })
  await step('Global setup step 2', async () => {
    console.log('[GLOBAL HOOK] Step 2 executed')
  })
})
