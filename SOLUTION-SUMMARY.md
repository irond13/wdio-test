# AllureFailingHookReporter - Type-Safe Solution

## Problem Solved
When beforeAll/afterAll hooks fail before any test runs, Allure loses all evidence (steps, screenshots) because there's no test context to attach them to.

## Solution
Custom WDIO reporter that:
1. **Buffers** all Allure events (steps, screenshots) during hooks
2. **Failure case**: Creates synthetic "Global Setup: (root)" test entry with all buffered evidence
3. **Success case**: Clears buffer (hook passed, so detailed steps less critical)

## Key Fixes Applied

### 1. Removed All Type Assertions
- Uses `WDIORuntimeMessage` from `@wdio/allure-reporter`  
- Conditional types: `Extract<WDIORuntimeMessage, { type: T }>['data']`
- Global augmentation of `NodeJS.Process` for allure events
- **No `as unknown`, `as never`, or `as any` casts**

### 2. Fixed Screenshot Capture  
- DevTools protocol returns `{value: "base64string"}` not bare string
- Handles both formats for protocol compatibility

### 3. Eliminated Duplicate Test Entries
- **Problem**: Both @wdio/allure-reporter AND custom reporter created entries for failing hooks
- **Solution**: Reorder reporters - put `AllureFailingHookReporter` BEFORE `allure`
- Custom reporter emits `allure:test:start` first, allure reporter sees pending test and skips
- **Result**: 6 clean test entries (was 10 with duplicates)

## Validation Screenshots
See `./screenshots/`:
1. Global Setup detail with error message and tags
2. Nested steps fully expanded (beforeAll start → navigate, screenshot 1, screenshot 2)
3. Screenshot attachment visible (41.3 KiB)
4. Actual Example Domain screenshot image embedded in report

## Negative Consequences & Trade-offs

### Emitting `allure:test:start` Early
- ✅ **Pro**: Prevents duplicate WDIO hook test entries, clean counts
- ⚠️ **Con**: Only works for failure case (synthetic tests)
- ⚠️ **Con**: Success case can't inject steps into fixtures (Allure limitation - fixtures don't support steps)

### Multiple "Global Setup: (root)" Entries
- Each failing test spec creates one "Global Setup" entry
- All have same name → Allure groups as retries
- UI shows first, others in "Retries" tab
- **Acceptable**: Accurately represents that each spec file's hook failed independently

### Success Case Limitation
- Passing hooks: Steps are NOT shown in fixture
- Buffer is cleared, default WDIO fixture shows "passed"
- **Acceptable trade-off**: Failure case (more important) works perfectly

## Test Count
- **Before**: 10 entries (1 passing + 4 failing + 4 WDIO hook duplicates + 1 new passing)
- **After**: 6 entries (2 passing + 4 Global Setup failures)
- **Improvement**: 40% reduction, accurate counts
