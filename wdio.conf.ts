import AllureFailingHookReporter from './test/support/AllureFailingHookReporter'

// Enable mochaGlobalSetup capture (can be disabled by explicitly setting env var)
if (!('GLOBAL_SETUP_CAPTURE' in process.env)) {
  process.env.GLOBAL_SETUP_CAPTURE = '1'
}

// Single source of truth for Allure output directory
const ALLURE_RESULTS_DIR = process.env.ALLURE_RESULTS_DIR || 'allure-results'

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
  // Optional: Set specific log levels per logger (overrides logLevel for these loggers)
  // logLevels: {
  //   'webdriver': 'info',
  //   '@wdio/appium-service': 'silent'
  // },
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
      './test/support/rootSetup.ts',
      './test/support/retryLogger.ts'
    ],
    retries: 1  // Global retry limit (can override per-test with this.retries(n))
  },

  // WDIO before/after hooks: Not recommended for critical setup
  // - Errors are logged but don't stop test execution
  // - Services may not be loaded yet
  // - Better to use Mocha hooks via spec files
  //
  // Retry handling is done in test/support/retryLogger.ts (Mocha afterEach hook)

  reporters: [
    'spec',
    [
      'allure',
      {
        outputDir: ALLURE_RESULTS_DIR,
        disableWebdriverScreenshotsReporting: false,
        addConsoleLogs: true
      }
    ],
    [AllureFailingHookReporter, { outputDir: ALLURE_RESULTS_DIR }]
  ],

  tsConfigPath: './tsconfig.json'
}
