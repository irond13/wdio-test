# Comprehensive Test Scenarios

## Overview (SCENARIOS-1-overview.png)
- **2 test cases total**: 1 passed (green), 1 broken (orange)
- **50% pass rate**
- Shows test categorization and trends

## Scenario 1: All Hooks Pass ✅

### SCENARIOS-3-all-pass-fixtures.png
**Success case** - passing test with multiple fixture levels:
- **Set up** section shows 3 fixtures:
  1. Spec-level root hook: **4 sub-steps, 1 attachment** (171ms)
  2. Empty root hook: 0s
  3. Suite-level hook: **4 sub-steps, 2 attachments** (45ms)
- **Test body**: getTitle + Console Logs (256 B)

### SCENARIOS-4-fixtures-expanded.png
Shows the fixture hierarchy fully expanded with nested steps visible.

**Key demonstration:**
- ✅ Spec-level `before()` steps preserved in fixture
- ✅ Suite-level `before()` steps preserved in fixture
- ✅ All hooks shown in Set up section
- ✅ Console logs captured via `addConsoleLogs: true`

## Scenario 3: Spec-Level Failure ❌

### SCENARIOS-6-spec-failure-steps.png
**Failure case** - spec-level beforeAll fails:
- Synthetic test: **"(root): beforeAll hook failure"**
- **Broken** status (orange badge)
- **BeforeAllFailure** tag
- **Test body** shows captured steps:
  - "Spec setup step" (270ms, passed ✓)
  - "Spec setup screenshot" - 1 attachment (72ms, passed ✓)
- Error message: "Spec-level beforeAll failure"

**Key demonstration:**
- ✅ Steps executed BEFORE failure are preserved
- ✅ Screenshot attachment captured
- ✅ Synthetic test entry created (not WDIO duplicate)
- ✅ Clear identification of which hook failed

## Scenario 4: Suite-Level Failure ❌

### SCENARIOS-8-suite-failure.png
**Failure case** - suite-level beforeAll fails (spec-level passed):
- Synthetic test: **"Scenario 4: Suite-level failure: beforeAll hook failure"**
- **Broken** status
- **Set up** section: Shows passing spec-level fixture (collapsed)
- **Test body**: Shows failing suite-level hook steps:
  - "Suite setup step" (1ms, passed ✓)
  - "Suite setup screenshot" - 1 attachment (55ms, passed ✓)
- Error: "Suite-level beforeAll failure"

**Key demonstration:**
- ✅ Spec-level hook PASSED → shown in Set up fixtures
- ✅ Suite-level hook FAILED → shown in Test body with all evidence
- ✅ Proper nesting: passing fixtures + failing synthetic test

## Features Demonstrated

1. **addConsoleLogs**: Console output captured and shown (256 B in test body)
2. **Multi-level hooks**: Spec-root + suite-level properly distinguished
3. **Success case**: Steps in fixtures (no custom reporter interference)
4. **Failure case**: Synthetic tests with full evidence (steps + screenshots + errors)
5. **No duplicates**: Clean test counts, no WDIO hook test entries
6. **Proper typing**: No type assertions, conditional types throughout
