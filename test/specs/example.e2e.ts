import { $, browser } from '@wdio/globals'
import assert from 'node:assert/strict'

describe('Example Domain', () => {
  it('opens the page and verifies title and heading', async () => {
    await browser.url('https://example.org')

    const title = await browser.getTitle()
    assert.ok(title.includes('Example Domain'), `Expected title to include "Example Domain" but got: ${title}`)

    const heading = await $('h1')

    const headingText = await heading.getText()
    assert.strictEqual(headingText, 'Example Domain')
  })
})
