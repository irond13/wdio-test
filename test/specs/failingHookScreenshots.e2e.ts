import { step } from 'allure-js-commons'

describe('beforeAll with nested steps and screenshots', () => {
  before('visual login flow', async () => {
    await step('beforeAll start', async () => {
      await step('navigate to example', async () => {
        await browser.url('https://example.org')
      })
      await step('screenshot 1', async () => {
        await browser.takeScreenshot()
      })
      await step('screenshot 2', async () => {
        await browser.takeScreenshot()
      })
      throw new Error('Simulated login failure in beforeAll')
    })
  })

  it('is skipped due to failing beforeAll', () => {
    // will not run
  })
})

