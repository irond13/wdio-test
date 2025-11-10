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
    timeout: 60000,
    require: ['./test/support/globalSetup.js']
  },

  /**
   * WDIO Hook: Runs once per worker before any tests
   * This is the true "global" hook that affects all specs in the worker
   */
  before: async function() {
    const { step } = await import('allure-js-commons')

    await step('Global worker setup step 1', async () => {
      console.log('[GLOBAL WORKER HOOK] Navigating to example.org')
      await browser.url('https://example.org')
    })

    await step('Global worker setup step 2: screenshot', async () => {
      console.log('[GLOBAL WORKER HOOK] Taking global screenshot')
      await browser.takeScreenshot()
    })

    console.log('[GLOBAL WORKER HOOK] Global setup completed')
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
