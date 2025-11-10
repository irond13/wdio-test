import AllureFailingHookReporter from './test/support/AllureFailingHookReporter'

export const config: WebdriverIO.Config = {
  runner: 'local',
  specs: [
    './test/specs/example.e2e.ts',
    './test/specs/debugPassingHook.e2e.ts',
    // Nested array: these 2 specs run in same worker
    ['./test/specs/multiSpecSameWorker.e2e.ts', './test/specs/multiSpecSameWorker2.e2e.ts'],
    './test/specs/failingHook.e2e.ts',
    './test/specs/failingHookScreenshots.e2e.ts',
    './test/specs/failingHookStep.e2e.ts',
    './test/specs/failingRootHook.e2e.ts'
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
  },

  reporters: [
    'spec',
    [AllureFailingHookReporter, {}],
    [
      'allure',
      {
        outputDir: 'allure-results',
        // disableWebdriverStepsReporting: false,
        disableWebdriverScreenshotsReporting: false
      }
    ]
  ],

  tsConfigPath: './tsconfig.json'
}
