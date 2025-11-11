# WebdriverIO Test Project

WebdriverIO v9 test framework with TypeScript, Mocha, and Allure reporting.

## Prerequisites

- Node.js 20+
- Google Chrome (uses DevTools protocol)
- Java (for Allure HTML reports only)

## Installation

```bash
npm install
```

## Running Tests

```bash
npm test
```

## Project Structure

```
├── test/
│   ├── specs/           # Test files
│   └── support/         # Test infrastructure
│       ├── AllureFailingHookReporter.ts  # Captures hook failures in Allure
│       ├── globalSetup.ts                # Global Mocha setup hooks
│       └── retryLogger.ts                # Dynamic log level switching on retry
├── wdio.conf.ts         # WebdriverIO configuration
├── allure-results/      # Test results (gitignored)
└── allure-report/       # HTML reports (gitignored)
```

## Key Features

### 1. Dynamic Debug Logging on Retries

When a test fails and will be retried, ALL WDIO loggers automatically switch to DEBUG level for enhanced diagnostics. Log levels are restored after the test passes or exhausts retries.

**Implementation:** `test/support/retryLogger.ts`

**How it works:**
- Saves original `config.logLevel` and `config.logLevels` settings
- Switches to DEBUG via `process.env.WDIO_LOG_LEVEL` + `setLogLevelsConfig()`
- Restores original settings after retry completes

**Configuration:** `wdio.conf.ts`
```typescript
mochaOpts: {
  require: ['./test/support/retryLogger.ts'],
  retries: 1  // Enable retries globally or per-test
}
```

### 2. Allure Hook Failure Reporting

Captures console logs, screenshots, and steps from `beforeAll`/`afterAll` hooks that fail before any test runs.

**Implementation:** `test/support/AllureFailingHookReporter.ts`

**Why needed:** WDIO executes hooks before creating test contexts, so evidence from failing hooks would normally be lost.

**Solution:**
- Buffers all Allure events during hook execution
- When hook fails: Creates synthetic test entry to hold evidence
- When hook succeeds: Prepends hook logs to first real test

### 3. Allure Folders

| Folder | Purpose | Gitignored |
|--------|---------|------------|
| `allure-results/` | Raw JSON test results, screenshots, attachments | Yes |
| `allure-report/` | Generated HTML report (view in browser) | Yes |
| `allure-validate/` | _(Unknown - check contents)_ | TBD |

**Commands:**
```bash
npm run allure:generate  # Generate HTML from results
npm run allure:open      # Open report in browser
```

## Configuration Notes

### Log Levels (wdio.conf.ts)

```typescript
logLevel: 'info',        // Global default
logLevels: {             // Per-logger overrides (optional)
  'webdriver': 'silent',
  'devtools': 'debug'
}
```

**Priority:** External `WDIO_LOG_LEVEL` env var > `config.logLevel`

### Mocha Configuration

```typescript
mochaOpts: {
  ui: 'bdd',
  timeout: 60000,
  require: [
    './test/support/globalSetup.ts',   # Global setup hooks
    './test/support/retryLogger.ts'    # Retry log level management
  ],
  retries: 1  # Can override per-test with this.retries(n)
}
```

## References

- WebdriverIO: https://webdriver.io/docs/gettingstarted
- Mocha: https://mochajs.org/
- Allure: https://allurereport.org/
- Retry logger issue: https://github.com/webdriverio/webdriverio/issues/10520
