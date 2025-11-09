import { step } from 'allure-js-commons'
import { browser } from '@wdio/globals'

describe('Passing beforeAll with steps', () => {
  before('setup that succeeds', async () => {
    await step('Setup step 1', async () => {
      await browser.url('https://example.org')
    })
    await step('Setup step 2', async () => {
      await browser.takeScreenshot()
    })
    // Hook succeeds (no error thrown)
  })

  it('runs successfully after beforeAll', async () => {
    const title = await browser.getTitle()
    console.log('Title:', title)
  })
})
