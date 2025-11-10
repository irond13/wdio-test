import { browser } from '@wdio/globals'

describe('Retry Demo', () => {
  let attemptCount = 0

  // Note: Retry logging handled globally by retryLogger.ts
  // No need for per-test afterEach

  it('fails first time, passes on retry', async function() {
    this.retries(2)  // Configure retries for this test
    attemptCount++
    console.log(`[RETRY DEMO] Attempt #${attemptCount}`)

    await browser.url('https://example.org')
    const title = await browser.getTitle()

    console.log(`[RETRY DEMO] Page title: ${title}`)

    // Fail on first attempt, pass on second
    if (attemptCount === 1) {
      console.log('[RETRY DEMO] Intentionally failing first attempt')
      throw new Error('Intentional failure to demonstrate retry with debug logs')
    }

    console.log('[RETRY DEMO] Success on retry!')
  })
})
