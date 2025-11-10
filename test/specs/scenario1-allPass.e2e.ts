import { step } from 'allure-js-commons'
import { browser } from '@wdio/globals'

// Spec-level root beforeAll (runs after global)
before('Spec-level setup', async () => {
  await step('Spec setup step', async () => {
    console.log('[SPEC-LEVEL] Spec setup executing')
    await browser.url('https://example.org')
  })

  await step('Spec setup screenshot', async () => {
    console.log('[SPEC-LEVEL] Taking spec screenshot')
    await browser.takeScreenshot()
  })
})

describe('Scenario 1: All hooks pass', () => {
  // Suite-level beforeAll
  before('Suite-level setup', async () => {
    await step('Suite setup step', async () => {
      console.log('[SUITE-LEVEL] Suite setup executing')
      const title = await browser.getTitle()
      console.log('[SUITE-LEVEL] Page title:', title)
    })

    await step('Suite setup screenshot', async () => {
      console.log('[SUITE-LEVEL] Taking suite screenshot')
      await browser.takeScreenshot()
    })
  })

  it('test should run successfully', async () => {
    console.log('[TEST] Test executing after all hooks passed')
    const title = await browser.getTitle()
    console.log('[TEST] Verified title:', title)
  })
})
