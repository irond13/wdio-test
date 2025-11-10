import { step } from 'allure-js-commons'

describe('Debug passing hook', () => {
  before('setup with steps', async () => {
    await step('Test step in passing hook', async () => {
      console.log('Step executed')
    })
  })

  it('test after passing hook', () => {
    console.log('Test ran')
  })
})
