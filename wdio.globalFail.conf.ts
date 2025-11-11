import AllureFailingHookReporter from './test/support/AllureFailingHookReporter';

export const config: WebdriverIO.Config = {
  runner: 'local',
  specs: ['./test/specs/scenario2-globalFails.e2e.ts'],
  exclude: [],
  maxInstances: 1,
  capabilities: [{browserName: 'chrome'}],
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
      './test/support/globalSetup.failing.ts',  // Use failing version
      './test/support/retryLogger.ts'
    ],
    retries: 1
  },
  reporters: [
    'spec',
    [AllureFailingHookReporter, {}],
    ['allure', {
      outputDir: 'allure-results',
      disableWebdriverScreenshotsReporting: false,
      addConsoleLogs: true
    }]
  ],
  tsConfigPath: './tsconfig.json'
};
