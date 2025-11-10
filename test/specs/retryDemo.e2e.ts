import { browser } from '@wdio/globals'
import { debug, isDebugLogging } from '../support/debugLogger'

describe('Retry Demo', () => {
  let attemptCount = 0

  it('fails first time, passes on retry', async function() {
    this.retries(2)  // Configure retries for this test
    attemptCount++

    console.log(`[RETRY DEMO] Attempt #${attemptCount}`)

    // Check if debug stream is enabled (after first failure)
    if (isDebugLogging()) {
      console.log('[RETRY DEMO] ⚡ DEBUG STREAM ACTIVE')
    }

    await browser.url('https://example.org')

    // Debug logging - always called, but output goes to /dev/null or stdout
    debug('Navigated to example.org')
    debug('Window size:', await browser.getWindowSize())

    const title = await browser.getTitle()
    console.log(`[RETRY DEMO] Page title: ${title}`)

    // More debug logging - always executed
    debug('Document ready state:', await browser.execute(() => document.readyState))
    debug('Current URL:', await browser.getUrl())
    debug('Viewport:', await browser.getWindowSize())

    // Fail on first attempt, pass on second
    if (attemptCount === 1) {
      debug('About to fail on first attempt')
      console.log('[RETRY DEMO] Intentionally failing first attempt')
      throw new Error('Intentional failure to demonstrate retry with debug stream')
    }

    console.log('[RETRY DEMO] Success on retry!')
    debug('Test completed successfully')
  })
})
