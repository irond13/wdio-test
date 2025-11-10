import { step } from 'allure-js-commons'
import { browser } from '@wdio/globals'

// Global and spec-level pass, but suite-level fails
before('Spec-level setup passes', async () => {
  await step('Spec setup step', async () => {
    console.log('[SPEC] Spec setup executing')
    await browser.url('https://example.org')
  })

  await step('Spec setup screenshot', async () => {
    console.log('[SPEC] Taking spec screenshot')
    await browser.takeScreenshot()
  })
})

describe('Scenario 4: Suite-level failure', () => {
  before('Suite setup that fails', async () => {
    await step('Suite setup step', async () => {
      console.log('[SUITE] Suite setup executing')
      const title = await browser.getTitle()
      console.log('[SUITE] Page title:', title)
    })

    await step('Suite setup screenshot', async () => {
      console.log('[SUITE] Taking screenshot before failure')
      await browser.takeScreenshot()
    })

    console.log('[SUITE] About to fail')
    throw new Error('Suite-level beforeAll failure')
  })

  it('test (skipped)', () => {
    console.log('[TEST] This should not run')
  })
})
