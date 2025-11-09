before('root before all fails', () => {
  const err = new Error('Root Boom')
  err.name = 'RootBeforeAllError'
  throw err
})

describe('Suite after failing root before', () => {
  it('never runs', () => {
    // won't run
  })
})

