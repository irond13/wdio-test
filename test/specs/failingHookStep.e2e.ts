import { step } from 'allure-js-commons'

describe('Failing beforeAll with explicit step', () => {
  before('wrapped in allure.step', async () => {
    await step('beforeall', async () => {
      const err = new Error('Wrapped step failure from beforeAll')
      err.name = 'WrappedBeforeAllError'
      throw err
    })
  })

  it('will be skipped due to failing beforeAll', () => {
    // never runs
  })
})

