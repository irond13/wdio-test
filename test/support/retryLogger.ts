// Mocha Root Hook Plugin for retry tracking and log level switching
// Applies to ALL tests that use retries

import type { Context } from 'mocha'
import { browser } from '@wdio/globals'

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
      // Test failed but will be retried - switch log level to DEBUG
      console.log(`\n${'='.repeat(70)}`)
      console.log(`[RETRY ${currentRetry + 1}/${maxRetries + 1}] Test "${test.title}" FAILED`)
      console.log('[RETRY] Switching to DEBUG log level for next attempt')
      console.log('='.repeat(70) + '\n')

      // Dynamically import logger to avoid chalk issues at module load time
      try {
        const getLogger = (await import('@wdio/logger')).default

        // Set log levels using setLogLevelsConfig (sets defaults for all loggers)
        getLogger.setLogLevelsConfig({
          devtools: 'debug',
          webdriver: 'debug',
          webdriverio: 'debug'
        }, 'debug')

        console.log('[RETRY] Log level changed to DEBUG via setLogLevelsConfig')
      } catch (error) {
        console.log('[RETRY] Could not change log level:', (error as Error).message)
      }

      // Also take diagnostic screenshot
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

      // Reset to INFO level
      try {
        const getLogger = (await import('@wdio/logger')).default
        getLogger.setLogLevelsConfig({
          devtools: 'info',
          webdriver: 'info',
          webdriverio: 'info'
        }, 'info')
        console.log('[RETRY] Log level reset to INFO')
      } catch (error) {
        // Ignore logger errors
      }

    } else if (!passed && maxRetries > 0 && currentRetry >= maxRetries) {
      // Exhausted all retries - reset log level
      console.log(`\n${'='.repeat(70)}`)
      console.log(`[RETRY EXHAUSTED] Test "${test.title}" failed all ${maxRetries + 1} attempts`)
      console.log('='.repeat(70) + '\n')

      // Reset to INFO level
      try {
        const getLogger = (await import('@wdio/logger')).default
        getLogger.setLogLevelsConfig({
          devtools: 'info',
          webdriver: 'info',
          webdriverio: 'info'
        }, 'info')
      } catch (error) {
        // Ignore
      }
    }
  }
}
