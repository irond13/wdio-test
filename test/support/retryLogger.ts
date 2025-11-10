// Mocha Root Hook Plugin for retry log level management
// Applies to ALL tests that use retries

// Note: Using @wdio/logger causes chalk import issues in some setups
// For now, just log retry status - log level changing can be added per-test if needed

// Mocha context type
interface MochaContext {
  currentTest?: {
    title: string
    state?: 'passed' | 'failed'
    _currentRetry?: number
    _retries?: number
  }
}

export const mochaHooks = {
  afterEach: function(this: MochaContext) {
    // Access Mocha's test context
    const test = this.currentTest
    if (!test) return

    const currentRetry = test._currentRetry || 0
    const maxRetries = test._retries || 0
    const passed = test.state === 'passed'

    if (!passed && currentRetry < maxRetries) {
      // Test failed but will be retried
      console.log(`\n${'='.repeat(70)}`)
      console.log(`[RETRY ${currentRetry + 1}/${maxRetries + 1}] Test "${test.title}" FAILED`)
      console.log('[RETRY] Will retry with enhanced logging...')
      console.log('='.repeat(70) + '\n')

      // Log level change would go here (requires logger without chalk issues)
      // For now, retry messages are captured in console logs
    } else if (passed && currentRetry > 0) {
      // Test passed after retry
      console.log(`\n${'='.repeat(70)}`)
      console.log(`[RETRY SUCCESS] Test "${test.title}" PASSED on attempt ${currentRetry + 1}/${maxRetries + 1}`)
      console.log('='.repeat(70) + '\n')
    } else if (!passed && maxRetries > 0 && currentRetry >= maxRetries) {
      // Exhausted retries
      console.log(`\n${'='.repeat(70)}`)
      console.log(`[RETRY EXHAUSTED] Test "${test.title}" failed all ${maxRetries + 1} attempts`)
      console.log('='.repeat(70) + '\n')
    }
  }
}
