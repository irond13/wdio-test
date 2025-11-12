/*
 * AllureFailingHookReporter (TypeScript)
 * -------------------------------------
 * Purpose:
 *  - Capture beforeAll/afterAll evidence before any test is active and re‑emit it once a target exists
 *    (fixture for success or synthetic test for failure) without skewing test counts.
 *
 * The Problem:
 *  When beforeAll/afterAll hooks fail before any test runs, Allure loses all evidence (steps, screenshots)
 *  because there's no active test container to attach them to.
 *
 * The Solution:
 *  1. Buffer all Allure events (steps, screenshots, attachments) during beforeAll/afterAll hooks
 *  2. When a hook succeeds: replay buffered events as a "fixture" attached to the first test
 *  3. When a hook fails: create a synthetic test entry to hold the buffered evidence
 *
 * Why the complexity?
 *  - WebDriverIO executes hooks before creating test contexts
 *  - Allure needs an active test/fixture to attach evidence
 *  - Without buffering, screenshots and steps from failing hooks disappear into the void
 */

import AllureReporter from '@wdio/allure-reporter'
import type { Reporters } from '@wdio/types'
import type { WDIORuntimeMessage } from '@wdio/allure-reporter'
import { ContentType, Status, Stage } from 'allure-js-commons'

/*
 * Type Augmentation for Allure Events
 * -----------------------------------
 * Why this is needed:
 *  - @wdio/allure-reporter emits custom process events but doesn't type them
 *  - They bypass TypeScript with 'as never' casts in their own code
 *  - We need proper typing to avoid using 'as never' ourselves
 *
 * What WDIORuntimeMessage includes:
 *  - RuntimeMessage from allure-js-commons (step_start, step_stop with required status, attachments)
 *  - WDIO-specific messages (test:start, test:end, hook:start, hook:end, suite events)
 *
 * The 'allure:runtimeMessage' event carries all structured Allure data during test execution.
 */
declare global {
  namespace NodeJS {
    interface Process {
      on(event: 'allure:runtimeMessage', listener: (payload: WDIORuntimeMessage) => void): this
      emit(event: 'allure:runtimeMessage', payload: WDIORuntimeMessage): boolean
    }
  }
}

/*
 * BufferedEvent - stores Allure events that occur during hooks before tests start
 * message: The complete Allure runtime message (steps, screenshots, attachments, metadata)
 * at: Timestamp when the event occurred (used for accurate timing in reports)
 */
type BufferedEvent = {
  message: WDIORuntimeMessage
  at: number
}

export default class AllureFailingHookReporter extends AllureReporter {
  private hasRealTestStarted = false
  private inBeforeAll = false
  private inAfterAll = false
  private hookSuiteTitle = ''

  // Track active execution contexts to detect global fixtures
  private activeSuites = new Set<any>()
  private activeHooks = new Set<any>()
  private activeTests = new Set<any>()

  private bufferedEvents: BufferedEvent[] = []
  private hookConsoleOutput = ''
  private allureStdoutWrapper: typeof process.stdout.write | null = null
  private hookLogsPrepended = false
  private isFlushing = false  // Prevent re-buffering during flush
  private exitHandlerRan = false  // Ensure exit handler only runs once

  constructor(options: Partial<Reporters.Options>) {
    super(options)

    // Start capturing stdout immediately (for mochaGlobalSetup)
    this.wrapStdout();

    // Catch process exit to handle mochaGlobalSetup/Teardown failures
    // When these fail, Mocha emits EVENT_RUN_END but WDIO doesn't listen to it
    // So onRunnerEnd() is never called. We call our own onRunnerEnd() directly.
    process.on('exit', () => {
      // Only run once
      if (this.exitHandlerRan) return;
      this.exitHandlerRan = true;

      // If we have buffered events, global fixture failed
      if (this.bufferedEvents.length > 0) {
        this.isFlushing = true;  // Prevent re-buffering

        // Process must exit synchronously, so async onRunnerEnd() won't complete
        // Instead, build result and write directly using parent's writer (which uses writeFileSync)
        // @ts-ignore - accessing private property
        const runtime = this._allureRuntime;
        if (!runtime || !runtime.writer) {
          return;
        }

        const __ts = getBufferedMinMaxTimes(this.bufferedEvents);
        const uuid = require('crypto').randomUUID();

        // Build Allure result structure from buffered events
        const result: any = {
          uuid,
          historyId: 'mochaGlobalSetup',
          name: 'Global fixture failure',
          status: 'broken',
          stage: 'finished',
          start: __ts.start,
          stop: __ts.stop,
          labels: [
            { name: 'tag', value: 'GlobalFixtureFailure' },
            { name: 'parentSuite', value: '(global)' }
          ],
          statusDetails: {
            message: 'mochaGlobalSetup/Teardown failed before tests could run',
            trace: this.hookConsoleOutput || undefined
          },
          steps: [],
          attachments: [],
          parameters: [],
          links: []
        };

        // Extract steps from buffered events
        const stepStack: any[] = [];
        for (const ev of this.bufferedEvents) {
          if (ev.message.type === 'step_start') {
            const step = {
              name: ev.message.data.name || 'Step',
              status: 'passed',
              stage: 'finished',
              start: ev.at,
              stop: ev.at,
              steps: [],
              attachments: [],
              parameters: []
            };
            if (stepStack.length > 0) {
              stepStack[stepStack.length - 1].steps.push(step);
            } else {
              result.steps.push(step);
            }
            stepStack.push(step);
          } else if (ev.message.type === 'step_stop') {
            if (stepStack.length > 0) {
              const step = stepStack.pop();
              if (step && ev.message.data.stop) {
                step.stop = ev.message.data.stop;
              }
            }
          } else if (ev.message.type === 'attachment_content') {
            const attachment = {
              name: ev.message.data.name || 'Attachment',
              source: `${uuid}-${ev.message.data.name || 'attachment'}.png`,
              type: ev.message.data.contentType || 'image/png'
            };
            if (stepStack.length > 0) {
              stepStack[stepStack.length - 1].attachments.push(attachment);
            } else {
              result.attachments.push(attachment);
            }
            // Write attachment file
            if (ev.message.data.content) {
              const content = Buffer.from(ev.message.data.content, ev.message.data.encoding || 'base64');
              runtime.writer.writeAttachment(attachment.source, content);
            }
          }
        }

        // Write result synchronously
        runtime.writer.writeResult(result);

        this.clearBuffers();
      }
    });

    /*
     * Listen for all Allure runtime messages during hook execution
     * This captures:
     *  - step_start/step_stop: Allure step() calls with their status
     *  - attachment_content: Screenshots taken via browser.takeScreenshot()
     *  - attachment_path: File attachments
     *  - metadata: Labels, links, descriptions
     *
     * Why buffer everything:
     *  - These events fire during beforeAll/afterAll before any test context exists
     *  - If we don't buffer them, Allure drops them silently
     *  - We replay them later when we have a proper test/fixture container
     */
    process.on('allure:runtimeMessage', (payload) => {
      // Don't buffer if we're currently flushing (prevents infinite loop)
      if (this.isFlushing) return;

      // Buffer events when nothing is active (global fixtures) or during beforeAll/afterAll
      const nothingActive = this.activeSuites.size === 0 && this.activeHooks.size === 0 && this.activeTests.size === 0;
      const inGlobalFixture = nothingActive && !this.hasRealTestStarted;

      if (this.inBeforeAll || this.inAfterAll || inGlobalFixture) {
        this.bufferedEvents.push({ message: payload, at: Date.now() })
      }
    })
  }

  onRunnerStart(runnerStats: any): void {
    super.onRunnerStart(runnerStats);
  }

  onSuiteStart(suiteStats: any): void {
    this.activeSuites.add(suiteStats);
    super.onSuiteStart(suiteStats);
  }

  onSuiteEnd(suiteStats: any): void {
    this.activeSuites.delete(suiteStats);
    super.onSuiteEnd(suiteStats);
  }


  onHookStart(hook: any): void {
    this.activeHooks.add(hook);

    const h = hook as { title?: unknown; parent?: unknown; start?: number }
    const title = typeof h?.title === 'string' ? h.title : ''

    // Extract suite name from hook title patterns:
    // "before all" hook for Suite Name → "Suite Name"
    // "before all" hook in "{root}" → "(root)"
    let suiteTitle = '(root)'
    const forMatch = title.match(/hook for (.+)/)
    const inMatch = title.match(/hook in "(.+)"/)
    if (forMatch && forMatch[1]) {
      suiteTitle = forMatch[1]
    } else if (inMatch && inMatch[1]) {
      suiteTitle = inMatch[1] === '{root}' ? '(root)' : inMatch[1]
    }

    if (title.includes('"before all" hook')) {
      this.inBeforeAll = true
      this.hookSuiteTitle = suiteTitle

      // Install wrapper once (it stays active and accumulates across all hooks)
      this.wrapStdout()
    } else if (title.includes('"after all" hook')) {
      this.inAfterAll = true
      this.hookSuiteTitle = suiteTitle
    }

    super.onHookStart(hook);
  }

  private wrapStdout(): void {
    // Only wrap once
    if (this.allureStdoutWrapper) return

    // Save allure's wrapper (which is currently active)
    this.allureStdoutWrapper = process.stdout.write

    const self = this
    // Replace with our wrapper that ALWAYS calls through to allure
    process.stdout.write = function(
      chunk: Uint8Array | string,
      encoding?: BufferEncoding | ((error: Error | null | undefined) => void),
      cb?: ((error: Error | null | undefined) => void)
    ): boolean {
      const str = typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8')

      // Capture during hooks OR before any test starts (for mochaGlobalSetup)
      if (self.inBeforeAll || self.inAfterAll || !self.hasRealTestStarted) {
        self.hookConsoleOutput += str;
      }

      // Prepend hook logs when we see the FIRST test log (after hooks complete)
      if (self.hasRealTestStarted && !self.hookLogsPrepended && self.hookConsoleOutput.trim() && !str.includes('[DEBUG]')) {
        self.hookLogsPrepended = true
        // Emit hook logs FIRST
        if (self.allureStdoutWrapper) {
          self.allureStdoutWrapper('\n========== Setup Hooks Console Output ==========\n', undefined, undefined)
          self.allureStdoutWrapper(self.hookConsoleOutput, undefined, undefined)
          self.allureStdoutWrapper('=================================================\n\n', undefined, undefined)
        }
        self.hookConsoleOutput = ''
      }

      // ALWAYS call allure's wrapper
      if (self.allureStdoutWrapper) {
        if (typeof encoding === 'function') {
          return self.allureStdoutWrapper.call(process.stdout, chunk, undefined, encoding)
        }
        return self.allureStdoutWrapper.call(process.stdout, chunk, encoding, cb)
      }
      return true
    }
  }


  async onHookEnd(hook: any): Promise<void> {
    this.activeHooks.delete(hook);

    const h = hook as { title?: unknown; error?: unknown;
      parent?: unknown; start?: number; end?: number }
    const title = typeof h?.title === 'string' ? h.title : ''
    const hadError = !!h?.error
    const isBeforeAll = title.includes('"before all" hook')
    const isAfterAll = title.includes('"after all" hook')

    // Don't unwrap - keep wrapper active to capture all future hooks too
    // We only capture when inBeforeAll/inAfterAll flags are true

    if (isBeforeAll) this.inBeforeAll = false
    if (isAfterAll) this.inAfterAll = false

    /*
     * Success case: Hook passed
     * Clear event buffer but KEEP hook console output for prepending in onTestStart
     */
    if (!hadError) {
      if (this.bufferedEvents.length > 0) {
        this.clearBuffers()
      }
      // DON'T clear hookConsoleOutput - we'll prepend it to test console logs
      return
    }

    /*
     * Failure case: beforeAll/afterAll failed before any test started
     * Create a synthetic "test" entry to hold the failure and all buffered evidence
     * This ensures screenshots and steps from the failing hook appear in the Allure report
     * Status is BROKEN (infrastructure failure) rather than FAILED (test assertion)
     */
    if (hadError && !this.hasRealTestStarted) {
      const isBefore = title.includes('"before all" hook')
      const hookType = isBefore ? 'beforeAll' : 'afterAll'
      const syntheticName = `${this.hookSuiteTitle}: ${hookType} hook failure`
      const __ts = getBufferedMinMaxTimes(this.bufferedEvents)

      this.emitRuntimeMessage('allure:test:start', { name: syntheticName, start: __ts.start })

      // Labels help filter and organize synthetic entries in Allure UI
      const tagValue = isBefore ? 'BeforeAllFailure' : 'AfterAllFailure'
      const labels = [
        { name: 'tag', value: tagValue },
        { name: 'parentSuite', value: this.hookSuiteTitle }
      ]
      this.emitRuntimeMessage('metadata', { labels })

      // Replay all buffered evidence (steps, screenshots) into the synthetic test
      await this.flushBufferedEvents()

      // Attach hook console logs if we captured any
      if (this.hookConsoleOutput.trim()) {
        this.emitRuntimeMessage('attachment_content', {
          name: 'Hook Console Logs',
          content: Buffer.from(`.........Hook Console Logs.........\n\n${this.hookConsoleOutput}`).toString('base64'),
          encoding: 'base64',
          contentType: 'text/plain'
        })
      }

      this.emitRuntimeMessage('allure:test:end', {
        status: Status.BROKEN,
        stage: Stage.FINISHED,
        statusDetails: getMessageAndTraceFromErrorLocal(h?.error),
        stop: __ts.stop
      })
      this.clearBuffers()
      this.hookConsoleOutput = ''
      return
    }

    super.onHookEnd(hook);
  }

  async onTestStart(testStats: any): Promise<void> {
    this.activeTests.add(testStats);

    this.hasRealTestStarted = true;
    super.onTestStart(testStats);
  }

  onTestEnd(testStats: any): void {
    this.activeTests.delete(testStats);
    super.onTestEnd(testStats);
  }

  onAfterCommand(command: { command?: string; result?: unknown }): void {
    // Capture screenshots from beforeAll/afterAll hooks or global fixtures
    const nothingActive = this.activeSuites.size === 0 && this.activeHooks.size === 0 && this.activeTests.size === 0;
    const inGlobalFixture = nothingActive && !this.hasRealTestStarted;

    if (this.hasRealTestStarted) return
    if (!(this.inBeforeAll || this.inAfterAll || inGlobalFixture)) return
    if (command?.command !== 'takeScreenshot') return

    // Extract base64 from WDIO's result format: {value: "base64string"}
    const result = command.result as { value?: string } | string | undefined
    const base64 = typeof result === 'string'
      ? result
      : typeof result === 'object' && result !== null && typeof result.value === 'string'
        ? result.value
        : undefined

    if (!base64) return

    /*
     * Capture screenshots taken during hooks
     * WebDriverIO's takeScreenshot() doesn't automatically go through allure:runtimeMessage
     * during hooks, so we manually create an attachment_content message
     * This ensures screenshots from failing hooks appear in the report
     */
    this.bufferedEvents.push({
      at: Date.now(),
      message: {
        type: 'attachment_content',
        data: { name: 'Screenshot', content: base64, contentType: ContentType.PNG, encoding: 'base64' }
      }
    })
  }

  async onRunnerEnd(runnerStats?: any): Promise<void> {
    // First, let parent process any queued messages
    await super.onRunnerEnd(runnerStats);

    // Then handle our buffered global fixture events
    if (this.bufferedEvents.length > 0 && !this.hasRealTestStarted) {
      const __ts = getBufferedMinMaxTimes(this.bufferedEvents);

      // Create synthetic test entry (same pattern as onHookEnd)
      this.emitRuntimeMessage('allure:test:start', {
        name: 'Global fixture failure',
        start: __ts.start
      });

      const labels = [
        { name: 'tag', value: 'GlobalFixtureFailure' },
        { name: 'parentSuite', value: '(global)' }
      ];
      this.emitRuntimeMessage('metadata', { labels });

      // Replay all buffered evidence (steps, screenshots)
      await this.flushBufferedEvents();

      // Attach console output if captured
      if (this.hookConsoleOutput.trim()) {
        this.emitRuntimeMessage('attachment_content', {
          name: 'Console Output',
          content: Buffer.from(this.hookConsoleOutput).toString('base64'),
          encoding: 'base64',
          contentType: 'text/plain'
        });
      }

      this.emitRuntimeMessage('allure:test:end', {
        status: Status.BROKEN,
        stage: Stage.FINISHED,
        statusDetails: { message: 'Global fixture failed before tests could run' },
        stop: __ts.stop
      });

      this.clearBuffers();
      this.hookConsoleOutput = '';
    }
  }

  // ==================== Helper Methods ====================

  /**
   * Emit properly-typed runtime messages to the Allure reporter
   * Uses conditional types to extract the correct payload type for each message type
   * This allows type-safe emissions without verbose intermediate variables
   */
  private emitRuntimeMessage<T extends WDIORuntimeMessage['type']>(
    type: T,
    data: Extract<WDIORuntimeMessage, { type: T }>['data']
  ): void {
    const message = { type, data } as WDIORuntimeMessage
    process.emit('allure:runtimeMessage', message)
  }

  /**
   * Replay all buffered events (steps, screenshots, attachments)
   * This re-emits them in the order they occurred so Allure processes them
   * as if they happened in the current test/fixture context
   */
  private async flushBufferedEvents(): Promise<void> {
    for (const ev of this.bufferedEvents) {
      this.emitRuntimeMessage(ev.message.type, ev.message.data)
    }
  }

  private clearBuffers(): void {
    this.bufferedEvents = []
    this.hookSuiteTitle = ''
  }
}

/**
 * Calculate timing bounds from buffered events
 * Returns the earliest and latest timestamps for accurate duration reporting
 * Used to set start/stop times on synthetic test entries and fixtures
 */
function getBufferedMinMaxTimes(events: BufferedEvent[]): { start: number; stop: number } {
  if (events.length === 0) {
    const now = Date.now()
    return { start: now, stop: now }
  }
  let min = Number.POSITIVE_INFINITY
  let max = 0
  for (const ev of events) {
    if (ev.at < min) min = ev.at
    if (ev.at > max) max = ev.at
  }
  if (!isFinite(min)) min = Date.now()
  if (max === 0) max = min
  return { start: min, stop: max }
}

/**
 * Extract error details for Allure status details
 * Handles various error types (Error objects, strings, unknowns)
 * Returns message and stack trace formatted for Allure's statusDetails field
 */
function getMessageAndTraceFromErrorLocal(err: unknown): { message?: string; trace?: string } {
  const out: { message?: string; trace?: string } = {}
  if (typeof err === 'object' && err !== null) {
    const e = err as { message?: unknown; stack?: unknown }
    if (typeof e.message === 'string') out.message = e.message
    if (typeof e.stack === 'string') out.trace = e.stack
    return out
  }
  if (typeof err === 'string') return { message: err, trace: err }
  return { message: String(err) }
}
