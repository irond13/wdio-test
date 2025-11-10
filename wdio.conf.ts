import AllureFailingHookReporter from './test/support/AllureFailingHookReporter'
import { enableDebugLogging, disableDebugLogging } from './test/support/debugLogger'

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
    require: [
      './test/support/globalSetup.ts',
      './test/support/retryLogger.ts'  // Retry log level management
    ],
    retries: 1  // Global retry limit (can override per-test with this.retries(n))
  },

  // WDIO before/after hooks: Not recommended for critical setup
  // - Errors are logged but don't stop test execution
  // - Services may not be loaded yet
  // - Better to use Mocha hooks via spec files

  /**
   * WDIO afterTest hook - runs after each test with retry info
   * Use this to change logging behavior on retries
   */
  afterTest: async function(test, _context, { passed }) {
    const currentRetry = (test as any)._currentRetry || 0
    const maxRetries = (test as any)._retries || 0

    if (!passed && currentRetry < maxRetries) {
      console.log(`\n${'='.repeat(70)}`)
      console.log(`[RETRY ${currentRetry + 1}/${maxRetries + 1}] Test "${test.title}" FAILED`)
      console.log('[RETRY] Enabling DEBUG logging stream for next attempt')
      console.log('='.repeat(70) + '\n')

      // Enable debug logging stream - output goes to stdout instead of /dev/null
      enableDebugLogging()
    } else if (passed && currentRetry > 0) {
      console.log(`\n${'='.repeat(70)}`)
      console.log(`[RETRY SUCCESS] Test "${test.title}" PASSED on attempt ${currentRetry + 1}/${maxRetries + 1}`)
      console.log('='.repeat(70) + '\n')

      // Disable debug logging - back to /dev/null
      disableDebugLogging()
    } else if (!passed && currentRetry >= maxRetries) {
      console.log(`\n${'='.repeat(70)}`)
      console.log(`[RETRY EXHAUSTED] Test "${test.title}" failed all ${maxRetries + 1} attempts`)
      console.log('='.repeat(70) + '\n')

      // Disable debug logging
      disableDebugLogging()
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
