import { step } from 'allure-js-commons'
import { browser } from '@wdio/globals'

// This spec will be affected by global hook failure
// We'll make global hook fail by setting an env var

describe('Scenario 2: Would run if global passed', () => {
  before('Spec setup (never runs if global fails)', async () => {
    await step('Spec step', async () => {
      console.log('[SPEC] This should not appear if global fails')
    })
  })

  it('test (never runs if global fails)', () => {
    console.log('[TEST] This should not run')
  })
})
