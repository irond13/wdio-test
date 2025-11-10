# addConsoleLogs Feature Explanation

## Configuration
```typescript
['allure', {
  addConsoleLogs: true
}]
```

## What Gets Captured

The console log attachment includes:
1. **Your console.log() calls**: `[TEST] Test executing...`
2. **WDIO internal logs**: `INFO devtools: COMMAND getTitle()`
3. **Command timestamps**: `2025-11-10T02:31:25.427Z`
4. **Results**: `RESULT Example Domain`

## Source of Timestamps

The timestamps come from **WDIO's built-in logger**, controlled by:
- `logLevel: 'info'` in wdio.conf.ts
- WDIO automatically timestamps all commands/results
- Shows exact timing of browser interactions

## Does It Redirect stdout?

**NO** - it's a passive capture:
- ✅ Logs still appear in terminal during test run
- ✅ Logs appear in your CI/logfiles
- ✅ ALSO captured into Allure report as text attachment

You get logs in **both** places - no redirection or loss.

## Example Output

```
.........Console Logs.........

[TEST] Test executing after all hooks passed
2025-11-10T02:31:25.427Z INFO devtools: COMMAND getTitle()
2025-11-10T02:31:25.427Z INFO devtools: RESULT Example Domain
[TEST] Verified title: Example Domain
```

This shows:
- Test's console.log calls
- DevTools protocol commands executed
- Exact timing of each operation
- Results returned

**Extremely useful for debugging** - you can see the exact sequence of operations and their timing in the Allure report alongside test results.
