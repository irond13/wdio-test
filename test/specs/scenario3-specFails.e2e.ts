import { step } from 'allure-js-commons'
import { browser } from '@wdio/globals'

// Global passes, but spec-level fails
before('Spec-level setup that fails', async () => {
  await step('Spec setup step', async () => {
    console.log('[SPEC] Spec setup executing')
    await browser.url('https://example.org')
  })

  await step('Spec setup screenshot', async () => {
    console.log('[SPEC] Taking screenshot before failure')
    await browser.takeScreenshot()
  })

  console.log('[SPEC] About to fail')
  throw new Error('Spec-level beforeAll failure')
})

describe('Scenario 3: Suite after spec-level failure', () => {
  before('Suite setup (never runs)', async () => {
    await step('Suite step', async () => {
      console.log('[SUITE] This should not run')
    })
  })

  it('test (skipped)', () => {
    console.log('[TEST] This should not run')
  })
})
