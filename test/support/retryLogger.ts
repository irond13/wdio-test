// Mocha Root Hook Plugin for retry tracking and enhanced logging
// Applies to ALL tests that use retries

import type { Context } from 'mocha'
import { browser } from '@wdio/globals'

// Note: @wdio/logger.setLevel() has chalk dependency issues in some versions
// Alternative: Add custom verbose logging on retries instead

export const mochaHooks = {
  afterEach: async function(this: Context) {
    // Access Mocha's test context (properly typed - from @types/mocha)
    const test = this.currentTest
    if (!test) return

    // Mocha's internal retry tracking (_currentRetry is 0-indexed)
    const currentRetry = (test as any)._currentRetry || 0
    const maxRetries = (test as any)._retries || 0
    const passed = test.state === 'passed'

    if (!passed && currentRetry < maxRetries) {
      // Test failed but will be retried
      console.log(`\n${'='.repeat(70)}`)
      console.log(`[RETRY ${currentRetry + 1}/${maxRetries + 1}] Test "${test.title}" FAILED`)
      console.log('[RETRY] Next attempt will have enhanced diagnostics:')
      console.log('[RETRY] - Taking diagnostic screenshot')
      console.log('[RETRY] - Capturing browser state')
      console.log('='.repeat(70) + '\n')

      // Take diagnostic screenshot before retry
      try {
        await browser.takeScreenshot()
        console.log('[RETRY] Diagnostic screenshot captured')
      } catch (e) {
        console.log('[RETRY] Could not capture screenshot:', (e as Error).message)
      }

      // Log browser state
      try {
        const url = await browser.getUrl()
        const title = await browser.getTitle()
        console.log(`[RETRY] Browser URL: ${url}`)
        console.log(`[RETRY] Page Title: ${title}`)
      } catch (e) {
        console.log('[RETRY] Could not capture browser state')
      }

    } else if (passed && currentRetry > 0) {
      // Test passed after retry
      console.log(`\n${'='.repeat(70)}`)
      console.log(`[RETRY SUCCESS] Test "${test.title}" PASSED on attempt ${currentRetry + 1}/${maxRetries + 1}`)
      console.log('='.repeat(70) + '\n')
    } else if (!passed && maxRetries > 0 && currentRetry >= maxRetries) {
      // Exhausted all retries
      console.log(`\n${'='.repeat(70)}`)
      console.log(`[RETRY EXHAUSTED] Test "${test.title}" failed all ${maxRetries + 1} attempts`)
      console.log('='.repeat(70) + '\n')
    }
  }
}
