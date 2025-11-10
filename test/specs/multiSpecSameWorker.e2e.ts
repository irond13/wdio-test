// Test 1: Multiple specs in same worker via nested array
// This should demonstrate that a root hook in one spec doesn't affect another

describe('Spec A in same worker', () => {
  it('runs fine', () => {
    console.log('Spec A test ran')
  })
})
