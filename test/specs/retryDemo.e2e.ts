import { browser } from '@wdio/globals'
import { isDebugMode, debugLog } from '../support/debugMode'

describe('Retry Demo', () => {
  let attemptCount = 0

  it('fails first time, passes on retry', async function() {
    this.retries(2)  // Configure retries for this test
    attemptCount++

    console.log(`[RETRY DEMO] Attempt #${attemptCount}`)

    // Check if debug mode is enabled (set by retry hook after failure)
    if (isDebugMode) {
      console.log('[RETRY DEMO] ⚡ DEBUG MODE ENABLED - Enhanced logging active')
    }

    await browser.url('https://example.org')

    // Debug-only logging
    debugLog('Navigated to example.org')
    debugLog('Window size:', await browser.getWindowSize())

    const title = await browser.getTitle()
    console.log(`[RETRY DEMO] Page title: ${title}`)

    // More debug logging
    debugLog('Document ready state:', await browser.execute(() => document.readyState))
    debugLog('Current URL:', await browser.getUrl())

    // Fail on first attempt, pass on second
    if (attemptCount === 1) {
      console.log('[RETRY DEMO] Intentionally failing first attempt')
      throw new Error('Intentional failure to demonstrate retry with debug mode')
    }

    console.log('[RETRY DEMO] Success on retry!')
    debugLog('Test completed successfully with debug info')
  })
})
