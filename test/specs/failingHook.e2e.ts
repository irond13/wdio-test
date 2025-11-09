describe('Failing root hook demo', () => {
  before('global setup that fails', () => {
    // simulate assertion-style failure
    const { fail } = require('node:assert') as typeof import('node:assert')
    fail('Boom from beforeAll')
  })

  it('should not run', () => {
    // will be skipped due to failing beforeAll
  })
})
