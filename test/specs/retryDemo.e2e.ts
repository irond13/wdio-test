import { browser } from '@wdio/globals'

describe('Retry Demo', () => {
  let attemptCount = 0

  it('fails first time, passes on retry', async function() {
    this.retries(2)  // Configure retries for this test
    attemptCount++

    console.log(`Attempt #${attemptCount}`)

    await browser.url('https://example.org')

    const title = await browser.getTitle()
    console.log(`Page title: ${title}`)

    const url = await browser.getUrl()
    const viewport = await browser.getWindowSize()
    console.log(`Current URL: ${url}`)
    console.log(`Viewport: ${JSON.stringify(viewport)}`)

    // Fail on first attempt, pass on second
    if (attemptCount < 2) {
      console.log('Intentionally failing first attempt')
      throw new Error('Intentional failure to demonstrate retry with debug logging')
    }

    console.log('Success on retry!')
  })
})
