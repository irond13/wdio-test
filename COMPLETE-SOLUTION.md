# Complete AllureFailingHookReporter Solution

## Executive Summary

A type-safe WebdriverIO reporter that captures evidence from failing hooks and includes hook console logs in test reports.

**No patches required** - just configuration and clever stdout wrapping.

## Features

### 1. Failure Case - Synthetic Test Entries
When beforeAll/afterAll hooks fail:
- ✅ Creates synthetic test entry (e.g., "Scenario: beforeAll hook failure")
- ✅ Captures all steps executed before failure
- ✅ Captures screenshot attachments
- ✅ Shows error message and stack trace
- ✅ Attaches hook console logs separately
- ✅ No duplicate WDIO hook test entries

### 2. Success Case - Enhanced Fixtures
When hooks pass:
- ✅ Multi-level fixtures shown (Global + Spec + Suite)
- ✅ Each fixture shows steps with timing
- ✅ **Hook console logs prepended to test Console Logs**
- ✅ Includes WDIO command timestamps

### 3. Console Logs Enhancement

**Test Console Logs include:**
```
========== Setup Hooks Console Output ==========
[GLOBAL MOCHA] Global hook logs with timestamps
[SPEC-LEVEL] Spec hook logs with timestamps
[SUITE-LEVEL] Suite hook logs with timestamps
=================================================

[TEST] Test logs with timestamps
```

**Hook console logs for failures:**
- Separate "Hook Console Logs" attachment on synthetic test entries
- Shows exactly what executed before the failure

## Configuration

### wdio.conf.ts
```typescript
export const config: WebdriverIO.Config = {
  // ... other config

  framework: 'mocha',
  mochaOpts: {
    ui: 'bdd',
    timeout: 60000,
    require: ['./test/support/globalSetup.ts']  // Optional: Global hooks
  },

  reporters: [
    'spec',
    [AllureFailingHookReporter, {}],  // ← MUST be before allure
    [
      'allure',
      {
        outputDir: 'allure-results',
        addConsoleLogs: true  // Enable console log capture
      }
    ]
  ],

  tsConfigPath: './tsconfig.json'
}
```

### Global Hooks (Optional)

```typescript
// test/support/globalSetup.ts
import { browser } from '@wdio/globals'
import { step } from 'allure-js-commons'

export const mochaHooks = {
  beforeAll: async function() {
    await step('Global setup step', async () => {
      await browser.url('https://example.org')
    })
  }
}
```

## How It Works

### Reporter Ordering
**Critical**: Custom reporter MUST be before allure reporter.

**Why**:
- Custom reporter's `onHookEnd` runs first
- Emits `allure:test:start` for failures
- Allure reporter sees pending test, skips creating duplicate

### Console Log Capture

**The Creative Solution:**
1. Wrap `process.stdout.write` (after allure sets up its wrapper)
2. Capture output only when `inBeforeAll || inAfterAll` is true
3. Always call through to allure's wrapper
4. Accumulate across ALL hooks (don't clear between hooks)
5. Prepend to test logs lazily (when detecting first test output)

**Why lazy prepending works:**
- Allure clears buffer in its `onTestStart`
- Custom reporter's `onTestStart` runs BEFORE allure's (reporter ordering)
- Emitting in `onTestStart` gets wiped by allure's clear
- **Solution**: Emit in wrapper when detecting first test output (AFTER allure clears)

### Type Safety
- Global `NodeJS.Process` augmentation for `allure:runtimeMessage`
- Conditional types: `Extract<WDIORuntimeMessage, { type: T }>['data']`
- No `as unknown` or type assertions

## Test Results

- 3 test scenarios created (all pass, spec fails, suite fails)
- Console logs show complete 3-level hook hierarchy
- Screenshots validate both success and failure cases
- All working without patches

## Limitations Addressed

**WDIO `before` hook**: Errors are swallowed, not recommended (confirmed by testing)

**mochaOpts.require**: Works with TypeScript via Mocha Root Hook Plugin API

**addConsoleLogs**: Originally only captured test logs, now enhanced to include hook logs

## Final Status

✅ All type assertions removed
✅ Multi-level hooks (Global + Spec + Suite)
✅ Hook console logs in both success and failure cases
✅ No patches to node_modules
✅ Clean test counts (no duplicates)
✅ Comprehensive screenshots validating all scenarios

**Total solution**: ~300 lines of TypeScript + configuration
