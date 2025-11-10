import AllureFailingHookReporter from './test/support/AllureFailingHookReporter'
import logger from '@wdio/logger'

// Get loggers for different components
const devtoolsLog = logger('devtools')
const webdriverLog = logger('webdriver')
const wdioLog = logger('webdriverio')

export const config: WebdriverIO.Config = {
  runner: 'local',
  specs: [
    './test/specs/retryDemo.e2e.ts',
    './test/specs/scenario1-allPass.e2e.ts'
    // './test/specs/scenario2-globalFails.e2e.ts',  // Uncomment to test global failure
    // './test/specs/scenario3-specFails.e2e.ts',
    // './test/specs/scenario4-suiteFails.e2e.ts'
  ],
  exclude: [],
  maxInstances: 1,
  capabilities: [
    {
      browserName: 'chrome'
    }
  ],
  automationProtocol: 'devtools',
  logLevel: 'info',
  bail: 0,
  baseUrl: 'http://localhost',
  waitforTimeout: 10000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 2,

  services: [],

  framework: 'mocha',
  mochaOpts: {
    ui: 'bdd',
    timeout: 60000,
    require: ['./test/support/globalSetup.ts'],
    retries: 2  // Retry failing tests up to 2 times
  },

  // WDIO before/after hooks: Not recommended for critical setup
  // - Errors are logged but don't stop test execution
  // - Services may not be loaded yet
  // - Better to use Mocha hooks via spec files

  /**
   * afterTest hook: Runs after each test
   * Used to change log level on retries for enhanced debugging
   */
  afterTest: async function(test, _context, { passed }) {
    // Access Mocha's internal retry tracking
    const currentRetry = (test as any)._currentRetry || 0
    const maxRetries = (test as any)._retries || 0

    if (!passed && currentRetry < maxRetries) {
      // Test failed but will be retried - increase log level for enhanced debugging
      const attemptNum = currentRetry + 1
      const totalAttempts = maxRetries + 1

      console.log(`\n${'='.repeat(70)}`)
      console.log(`[RETRY ${attemptNum}/${totalAttempts}] Test "${test.title}" FAILED`)
      console.log('[RETRY] Switching to DEBUG log level for next attempt')
      console.log('[RETRY] Enhanced WDIO command logging will be captured')
      console.log('='.repeat(70) + '\n')

      // Set all loggers to debug for enhanced diagnostics on retry
      devtoolsLog.setLevel('debug')
      webdriverLog.setLevel('debug')
      wdioLog.setLevel('debug')
    } else if (!passed && maxRetries > 0 && currentRetry >= maxRetries) {
      // Exhausted all retries
      console.log(`\n${'='.repeat(70)}`)
      console.log(`[RETRY EXHAUSTED] Test "${test.title}" failed all ${maxRetries + 1} attempts`)
      console.log('='.repeat(70) + '\n')
      devtoolsLog.setLevel('info')
      webdriverLog.setLevel('info')
      wdioLog.setLevel('info')
    } else if (passed && currentRetry > 0) {
      // Test passed after retry
      console.log(`\n${'='.repeat(70)}`)
      console.log(`[RETRY SUCCESS] Test "${test.title}" PASSED on attempt ${currentRetry + 1}/${maxRetries + 1}`)
      console.log('='.repeat(70) + '\n')
      devtoolsLog.setLevel('info')
      webdriverLog.setLevel('info')
      wdioLog.setLevel('info')
    }
  },

  reporters: [
    'spec',
    [AllureFailingHookReporter, {}],
    [
      'allure',
      {
        outputDir: 'allure-results',
        // disableWebdriverStepsReporting: false,
        disableWebdriverScreenshotsReporting: false,
        addConsoleLogs: true
      }
    ]
  ],

  tsConfigPath: './tsconfig.json'
}
