// Spec B - will run in same worker as Spec A if configured in nested array

before('root hook in spec B', () => {
  throw new Error('Root hook failure in Spec B')
})

describe('Spec B in same worker', () => {
  it('should not run', () => {
    console.log('This should not run')
  })
})
