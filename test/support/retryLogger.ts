// Mocha Root Hook Plugin for retry tracking and log level switching
// Applies to ALL tests that use retries

import type { Context } from 'mocha'
import { browser } from '@wdio/globals'
import { enableDebugMode, disableDebugMode } from './debugMode'

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
      // Test failed but will be retried - enable debug mode for test code
      console.log(`\n${'='.repeat(70)}`)
      console.log(`[RETRY ${currentRetry + 1}/${maxRetries + 1}] Test "${test.title}" FAILED`)
      console.log('[RETRY] Enabling DEBUG mode for next attempt')
      console.log('[RETRY] Tests can now use debugLog() for enhanced diagnostics')
      console.log('='.repeat(70) + '\n')

      // Enable debug mode - tests can check this flag
      enableDebugMode()

      // Also try to increase WDIO logger verbosity
      try {
        const getLogger = (await import('@wdio/logger')).default
        getLogger('devtools').setLevel('debug')
        getLogger('webdriver').setLevel('debug')
        console.log('[RETRY] WDIO log level set to DEBUG')
      } catch (error) {
        console.log('[RETRY] WDIO logger unavailable, using debug mode flag only')
      }

      // Take diagnostic screenshot
      try {
        await browser.takeScreenshot()
        const url = await browser.getUrl()
        const title = await browser.getTitle()
        console.log(`[RETRY] Diagnostic screenshot captured`)
        console.log(`[RETRY] Browser state - URL: ${url}, Title: ${title}`)
      } catch (e) {
        console.log('[RETRY] Could not capture diagnostics')
      }

    } else if (passed && currentRetry > 0) {
      // Test passed after retry - reset log level
      console.log(`\n${'='.repeat(70)}`)
      console.log(`[RETRY SUCCESS] Test "${test.title}" PASSED on attempt ${currentRetry + 1}/${maxRetries + 1}`)
      console.log('='.repeat(70) + '\n')

      // Disable debug mode and reset log level
      disableDebugMode()

      try {
        const getLogger = (await import('@wdio/logger')).default
        getLogger('devtools').setLevel('info')
        getLogger('webdriver').setLevel('info')
        console.log('[RETRY] Debug mode disabled, log level reset to INFO')
      } catch (error) {
        // Ignore
      }

    } else if (!passed && maxRetries > 0 && currentRetry >= maxRetries) {
      // Exhausted all retries - reset log level
      console.log(`\n${'='.repeat(70)}`)
      console.log(`[RETRY EXHAUSTED] Test "${test.title}" failed all ${maxRetries + 1} attempts`)
      console.log('='.repeat(70) + '\n')

      // Disable debug mode
      disableDebugMode()

      try {
        const getLogger = (await import('@wdio/logger')).default
        getLogger('devtools').setLevel('info')
        getLogger('webdriver').setLevel('info')
      } catch (error) {
        // Ignore
      }
    }
  }
}
