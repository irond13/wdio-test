import type { WebdriverIO } from '@wdio/types'
import base from './wdio.conf'
import AllureFailingHookReporter from './test/support/AllureFailingHookReporter'

const cfg: WebdriverIO.Config = {
  ...base.config,
  specs: ['./test/specs/failingHookScreenshots.e2e.ts'],
}

// swap allure outputDir to a clean folder for validation run and set reporter pruning target
cfg.reporters = (base.config.reporters || []).map((r) => {
  if (Array.isArray(r) && r[0] === 'allure') {
    return ['allure', { ...r[1], outputDir: 'allure-validate' }]
  }
  // Use TS reporter unchanged; no pruning
  if (Array.isArray(r) && r[0] === AllureFailingHookReporter) {
    return [AllureFailingHookReporter, {}]
  }
  return r
})

export const config = cfg
