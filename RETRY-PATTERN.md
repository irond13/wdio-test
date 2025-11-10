# Retry Pattern with Dynamic Log Level

## Comparison to Jest/Puppeteer Approach

Your colleague's Jest/Puppeteer setup:
- ✅ Tests retry on failure
- ✅ Log level switches to DEBUG on retry
- ✅ Enhanced diagnostics in stdout log file

Our WebdriverIO implementation:
- ✅ Tests retry on failure (via `mochaOpts.retries` or `this.retries()`)
- ✅ Log level switches to DEBUG on retry (via `@wdio/logger`)
- ✅ Enhanced diagnostics captured in Allure Console Logs
- ✅ BONUS: Visible in Allure report with retry history

## Configuration

```typescript
// wdio.conf.ts
import logger from '@wdio/logger'

const devtoolsLog = logger('devtools')
const webdriverLog = logger('webdriver')

export const config: WebdriverIO.Config = {
  mochaOpts: {
    retries: 2  // Global retry limit
  },

  afterTest: async function(test, _context, { passed }) {
    const currentRetry = (test as any)._currentRetry || 0
    const maxRetries = (test as any)._retries || 0

    if (!passed && currentRetry < maxRetries) {
      // Retry will happen - switch to DEBUG
      console.log(`[RETRY ${currentRetry + 1}/${maxRetries + 1}] FAILED - switching to DEBUG`)
      devtoolsLog.setLevel('debug')
      webdriverLog.setLevel('debug')
    } else if (passed && currentRetry > 0) {
      // Passed after retry - reset to INFO
      console.log(`[RETRY SUCCESS] Passed on attempt ${currentRetry + 1}`)
      devtoolsLog.setLevel('info')
      webdriverLog.setLevel('info')
    }
  }
}
```

## How It Works

### First Attempt (Fails)
1. Test executes with `logLevel: 'info'` (default)
2. Test fails
3. `afterTest` hook runs
4. Detects `currentRetry < maxRetries`
5. Calls `devtoolsLog.setLevel('debug')`
6. Logs `[RETRY 1/3] FAILED - switching to DEBUG`

### Retry Attempt (More Verbose)
1. Test re-executes with DEBUG log level
2. More detailed WDIO commands logged
3. If passes: `afterTest` resets to INFO level
4. Logs `[RETRY SUCCESS] Passed on attempt 2`

### Console Logs in Allure

With `addConsoleLogs: true` + our hook console prepending:

```
========== Setup Hooks Console Output ==========
[GLOBAL MOCHA] Hook logs from all attempts...
=================================================

[RETRY 1/3] Test failed - switching to DEBUG
[TEST] Attempt #1 logs...
[RETRY 2/3] Test failed - switching to DEBUG
[TEST] Attempt #2 logs with more verbose WDIO commands...
[RETRY SUCCESS] Passed on attempt 3
```

## Outcome Comparison

| Feature | Jest/Puppeteer | WebdriverIO + Our Reporter |
|---------|---------------|----------------------------|
| Retry on failure | ✅ | ✅ |
| Dynamic log level | ✅ | ✅ |
| Logs in stdout file | ✅ | ✅ |
| Logs in HTML report | ❌ | ✅ (Allure) |
| Hook logs included | ? | ✅ |
| Retry attempt visible | ? | ✅ (clear markers) |
| Screenshots per attempt | ? | ✅ (if taken) |

## Enhancements Over Jest Approach

1. **Allure Integration**: Retry history visible in report, not just log files
2. **Hook Logs**: Includes setup hook output (global + spec + suite)
3. **Visual Markers**: Clear `[RETRY]` annotations in console logs
4. **Structured**: Steps, screenshots, and logs organized per attempt

## Usage Example

```typescript
it('flaky test', async function() {
  this.retries(2)  // This specific test gets 2 retries

  // Your test code
  // If it fails, retry runs with DEBUG log level automatically
})
```

## Limitations

- DEBUG log level may not significantly increase verbosity for DevTools protocol
- Could enhance with custom logging/screenshots in `afterTest` hook
- Log level change is global (affects all subsequent tests in worker)

## Next Steps for Enhancement

- Add screenshot capture on first failure
- Implement custom verbose logging in retry attempts
- Track and display retry metadata in Allure report
