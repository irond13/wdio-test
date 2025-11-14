Allure Global Setup Capture — Architecture & Status
===================================================

Context
-------
WebdriverIO already ships with `@wdio/allure-reporter`, which buffers “pending hooks” until a real test starts. The gap we had to close:

- mochaGlobalSetup runs before Mocha emits suites/tests, so Allure never receives hook envelopes and drops the evidence.
- A failing beforeAll/afterAll before the first test leaves no container to hold screenshots/logs.
- Allure’s CLI “single-file” output embeds *every* `*-result.json`; the validator needs to read those payloads before asserting anything in the UI.

Reporter Flow (AllureFailingHookReporter.ts)
--------------------------------------------
1. **Tap the runtime bus** — Register `process.on('allure:runtimeMessage', …)` just like `@wdio/allure-reporter` does. When no suite/test is active (mochaGlobalSetup) or when a `"before all"/"after all"` hook is running, buffer every step and attachment.
2. **Replay into Allure’s pending hook queue** — On the first `onSuiteStart`, emit:
   - `allure:hook:start` with `{ type: 'before', name: '"before all" hook: mochaGlobalSetup' }`
   - every buffered runtime message in order
   - `allure:hook:end` with `{ status: passed }`
   This exactly matches what `_attachPendingHookToCurrentTest` (see `node_modules/@wdio/allure-reporter/build/index.js`) expects, so the first test shows a proper “Before” fixture without any consumer changes.
3. **Handle catastrophic failures** — If a beforeAll/afterAll (or mochaGlobalSetup) throws before any test starts, open a synthetic test (`"Suite: beforeAll hook failure"` or `"Global fixture failure"`) and flush every buffered step/screenshot plus captured stdout/stderr so Allure has somewhere to display the evidence.
4. **Exit-time guard** — Mocha can bail out before we ever see `onHookEnd`. A final `process.on('exit')` pass looks at the buffered events and, if no real test ever started, writes a last-ditch `*-result.json` so the run is visible in Allure.

Root Setup (`test/support/rootSetup.ts`)
---------------------------------------
- mochaGlobalSetup remains the single authority for setup actions. It calls `step_start/step_stop` around real work (navigate + screenshot) so the reporter merely replays what was emitted.
- Environment flags (`GLOBAL_SETUP_FAIL`, `GLOBAL_HOOK_FAIL`) intentionally throw inside mochaGlobalSetup/beforeAll so we can verify both the “fixture replay” and “synthetic failure” paths.

Validator (`test/validators/reportValidator.e2e.ts`)
----------------------------------------------------
- Regenerates the UI via `allure-commandline --single-file`, serves it with `http-server`, and drives it through WebdriverIO.
- Reads the embedded `d('data/test-cases/...', '<base64>')` payloads to assert invisible details (e.g., the actual step list for “Global fixture failure”).
- When several workers/spec retries produce multiple “Global fixture failure” entries, the validator searches for the entry that actually contains “Global setup step 1/2”; the run still fails if *no* entry has the evidence.
- Static server teardown now force-destroys open sockets before calling `close()` so the validator process never hangs on lingering SSE/WebSocket connections.

Status — Verified Behaviors
---------------------------
- **mochaGlobalSetup success** → buffered steps/screenshots replay as a `Before` fixture on the first test, and the validator screenshot proves they display in the UI.
- **mochaGlobalSetup failure** → at least one “Global fixture failure” result carries the exact two setup steps, screenshots, and combined console logs.
- **Nested beforeAll failures** → synthetic test entries capture `Hook Console Logs` attachments and suite-level screenshots before any real test runs.
- **Single-file validation** → `uidFor()` and `collectStepNames()` operate on the embedded JSON payloads so the validator never depends on `data/test-cases/*.json` directories.

Next Steps / Extension Points
-----------------------------
- To assert additional metadata (labels/links/parameters), emit them inside mochaGlobalSetup and extend the validator predicates accordingly.
- If you need the global fixture to attach to a specific suite instead of “first test in worker”, change the replay trigger (currently the first `onSuiteStart`).
- Keep mochaGlobalSetup short; everything before the first suite start is buffered and re-emitted in one shot, so long blocking calls delay the first test’s start time.
