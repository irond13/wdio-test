import AllureFailingHookReporter from './test/support/AllureFailingHookReporter'

export const config: WebdriverIO.Config = {
  runner: 'local',
  specs: [
    './test/specs/scenario1-allPass.e2e.ts',
    // './test/specs/scenario2-globalFails.e2e.ts',  // Uncomment to test global failure
    './test/specs/scenario3-specFails.e2e.ts',
    './test/specs/scenario4-suiteFails.e2e.ts'
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
    timeout: 60000
    // Note: mochaOpts.require for global hooks doesn't work well with WDIO's async initialization
    // Mocha globals (before/after) aren't available when require files execute
    // Alternative: Use WDIO's before/after hooks (below) or spec-level root hooks
  },

  // WDIO before/after hooks: Not recommended for critical setup
  // - Errors are logged but don't stop test execution
  // - Services may not be loaded yet
  // - Better to use Mocha hooks via spec files

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
