# Allure Report Validation Screenshots

## Success! No More Duplicate Hook Entries

### 1-global-setup-detail.png
Shows "Global Setup: (root)" synthetic test entry with:
- Broken status (yellow badge)
- Error message: "Simulated login failure in beforeAll"
- GlobalSetup tag
- Duration: 229ms
- **"beforeAll start" step with 3 sub-steps, 2 attachments**
- Clean suites list on left with ONLY 1 "Global Setup" entry (no WDIO duplicates)

### 2-nested-steps-expanded.png
Nested step hierarchy fully visible:
- Parent: "beforeAll start" (229ms)
- Children:
  - "navigate to example" (111ms, passed - green check)
  - "screenshot 1" (73ms, passed - green check, **1 attachment**)
  - "screenshot 2" (45ms, passed - green check, **1 attachment**)

### 3-screenshot-attachment-shown.png
"screenshot 1" step expanded showing:
- Screenshot attachment (41.3 KiB) ready to view

### 4-screenshot-image-embedded.png
Actual Example Domain screenshot displayed inline in the report:
- Full webpage screenshot visible
- Proves screenshots from failing beforeAll hooks are captured and displayable

## What This Proves

✅ **Eliminated duplicate WDIO "before all" hook test entries** - Previously 4 duplicates inflated test counts
✅ **Captured nested Allure steps** from failing hooks (beforeAll start → navigate, screenshot 1, screenshot 2)
✅ **Captured screenshot attachments** taken during hooks
✅ **Clean test counts** - Only "Global Setup" synthetic entries appear, not both custom + WDIO defaults
✅ **Proper typing** - No `as unknown` or `as never` casts, using conditional types on WDIORuntimeMessage
