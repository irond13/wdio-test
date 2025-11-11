/**
 * Mocha Root Hook Plugin for Dynamic Log Level Switching During Retries
 * ========================================================================
 *
 * Purpose:
 * --------
 * Automatically switch ALL WDIO loggers to DEBUG level when a test fails and
 * will be retried. Restore original log levels after the test passes or
 * exhausts all retry attempts.
 *
 * Configuration (wdio.conf.ts):
 * ------------------------------
 * mochaOpts: {
 *   require: ['./test/support/retryLogger.ts'],
 *   retries: 1
 * }
 *
 * How WDIO Logger Configuration Works:
 * -------------------------------------
 *
 * 1. Initial Setup:
 *    WDIO reads config.logLevel and config.logLevels from wdio.conf.ts:
 *
 *    logLevel: 'info'              → Default level for all loggers
 *    logLevels: {                  → Per-logger overrides (optional)
 *      'webdriver': 'silent',
 *      'devtools': 'info'
 *    }
 *
 *    WDIO CLI calls: logger.setLogLevelsConfig(config.logLevels, config.logLevel)
 *
 * 2. Environment Variable (process.env.WDIO_LOG_LEVEL):
 *    - Set by setLogLevelsConfig() during initialization
 *    - Can also be set externally by user (takes precedence over config!)
 *    - Acts as the global default for all new loggers
 *    - Priority: External env var > config.logLevel
 *
 *    Implementation detail (from @wdio/logger source):
 *    if (process.env.WDIO_LOG_LEVEL === undefined) {
 *      process.env.WDIO_LOG_LEVEL = config.logLevel
 *    }
 *
 * 3. Logger Creation Priority:
 *    When getLogger(name) is called, log level determined by:
 *    a. logLevelsConfig[name] if exists (from config.logLevels)
 *    b. process.env.WDIO_LOG_LEVEL if set (from config.logLevel or external)
 *    c. DEFAULT_LEVEL ('info') if nothing set
 *
 * Dynamic Switching Strategy:
 * ----------------------------
 *
 * Problem: We need to temporarily override BOTH config.logLevel AND config.logLevels
 * during retries to enable debug logging across all loggers.
 *
 * Solution - Three-step process:
 *
 * 1. Save Original State:
 *    - process.env.WDIO_LOG_LEVEL          → Saves global default
 *    - logger.getLevel() for each logger   → Saves per-logger overrides
 *
 * 2. Switch to Debug (on retry):
 *    - process.env.WDIO_LOG_LEVEL = 'debug'
 *    - getLogger.setLogLevelsConfig({}, 'debug')
 *      → Empty {} clears all per-logger overrides
 *      → 'debug' becomes new global default
 *      → All existing loggers switch to debug level
 *
 * 3. Restore Original (after retry):
 *    - process.env.WDIO_LOG_LEVEL = savedValue
 *    - logger.setLevel(savedLevel) for each logger
 *      → Manually restore preserves config.logLevels overrides
 *
 * Why Both Steps Required:
 * - Env var alone: Doesn't affect existing loggers
 * - setLogLevelsConfig alone: Won't override env var (checks if undefined first)
 * - Must do both: Change env var THEN call setLogLevelsConfig
 *
 * Logger Initialization:
 * ----------------------
 *
 * mochaHooks can be an async function that returns the hooks object.
 * This allows us to initialize the logger in the function closure,
 * avoiding module-level 'any' types.
 *
 * Why async function instead of module-level import:
 *
 * 1. @wdio/logger is ESM-only since v8+
 *    Source: https://github.com/webdriverio/webdriverio/issues/10520
 *    Static imports fail in CommonJS: "require() of ES Module not supported"
 *
 * 2. CommonJS projects (module: "CommonJS" in tsconfig.json) cannot use top-level await
 *    Error: "Top-level await is currently not supported with the 'cjs' output format"
 *
 * 3. mochaHooks as async function:
 *    Source: https://mochajs.org/next/features/root-hook-plugins/
 *    "If you need to perform some logic, mochaHooks can be a function which returns the expected object"
 *
 * References:
 * -----------
 * - Mocha Root Hook Plugins: https://mochajs.org/#root-hook-plugins
 * - WDIO Logger ESM-only: https://github.com/webdriverio/webdriverio/issues/10520
 */

import type { Context } from 'mocha'
import type { LogLevelDesc } from 'loglevel'

/**
 * mochaHooks as async function - allows logger initialization in closure
 * Avoids module-level 'any' types by deferring initialization
 */
export const mochaHooks = async () => {
  const getLogger = (await import('@wdio/logger')).default
  const log = getLogger('retryLogger')

  // Store original log configuration to restore after retry
  let originalLogLevel: LogLevelDesc | undefined
  let originalLoggerLevels: Record<string, number> = {}

  return {
    afterEach: async function(this: Context) {
      const test = this.currentTest
      if (!test) return

      const currentRetry = (test as any)._currentRetry || 0
      const maxRetries = (test as any)._retries || 0
      const passed = test.state === 'passed'

      if (!passed && currentRetry < maxRetries) {
        // Test failed and will be retried - switch to debug logging
        log.info(`\n${'='.repeat(70)}`)
        log.info(`[RETRY ${currentRetry + 1}/${maxRetries + 1}] Test "${test.title}" FAILED`)
        log.info('[RETRY] Enabling DEBUG logging for next attempt')
        log.info('='.repeat(70) + '\n')

        try {
          const loglevel = await import('loglevel')

          // Save original configuration (only once per test)
          if (!originalLogLevel) {
            originalLogLevel = (process.env.WDIO_LOG_LEVEL as LogLevelDesc) || 'info'

            // Save individual logger levels to preserve config.logLevels overrides
            const allLoggers = loglevel.default.getLoggers()
            originalLoggerLevels = {}
            for (const [name, logger] of Object.entries(allLoggers)) {
              originalLoggerLevels[name] = logger.getLevel()
            }

            log.trace(`Saved original log level: ${originalLogLevel}`)
            log.trace(`Saved ${Object.keys(originalLoggerLevels).length} logger-specific levels`)
          }

          // Switch all loggers to debug
          process.env.WDIO_LOG_LEVEL = 'debug'
          getLogger.setLogLevelsConfig({}, 'debug')
          log.trace('ALL loggers switched to DEBUG level')
        } catch (error) {
          log.warn('Failed to switch log levels:', error)
        }

      } else if (passed && currentRetry > 0) {
        // Test passed after retry - restore original log levels
        log.info(`\n${'='.repeat(70)}`)
        log.info(`[RETRY SUCCESS] Test "${test.title}" PASSED on attempt ${currentRetry + 1}/${maxRetries + 1}`)
        log.info('='.repeat(70) + '\n')

        try {
          const loglevel = await import('loglevel')
          const levelToRestore = originalLogLevel || 'info'

          // Restore environment variable
          process.env.WDIO_LOG_LEVEL = String(levelToRestore)

          // Restore individual logger levels (preserves config.logLevels)
          const allLoggers = loglevel.default.getLoggers()
          const restoredCount = Object.keys(originalLoggerLevels).length
          for (const [name, savedLevel] of Object.entries(originalLoggerLevels)) {
            if (allLoggers[name]) {
              allLoggers[name].setLevel(savedLevel as LogLevelDesc)
            }
          }

          log.trace(`Restored ${restoredCount} logger levels`)
          originalLogLevel = undefined
          originalLoggerLevels = {}
        } catch (error) {
          log.warn('Failed to restore logger levels:', error)
        }

      } else if (!passed && maxRetries > 0 && currentRetry >= maxRetries) {
        // Test exhausted all retries - restore original log levels
        log.info(`\n${'='.repeat(70)}`)
        log.info(`[RETRY EXHAUSTED] Test "${test.title}" failed all ${maxRetries + 1} attempts`)
        log.info('='.repeat(70) + '\n')

        try {
          const loglevel = await import('loglevel')
          const levelToRestore = originalLogLevel || 'info'

          // Restore environment variable
          process.env.WDIO_LOG_LEVEL = String(levelToRestore)

          // Restore individual logger levels (preserves config.logLevels)
          const allLoggers = loglevel.default.getLoggers()
          const restoredCount = Object.keys(originalLoggerLevels).length
          for (const [name, savedLevel] of Object.entries(originalLoggerLevels)) {
            if (allLoggers[name]) {
              allLoggers[name].setLevel(savedLevel as LogLevelDesc)
            }
          }

          log.trace(`Restored ${restoredCount} logger levels`)
          originalLogLevel = undefined
          originalLoggerLevels = {}
        } catch (error) {
          log.warn('Failed to restore logger levels:', error)
        }
      }
    }
  }
}
