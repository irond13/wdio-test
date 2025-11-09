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

import WDIOReporter from '@wdio/reporter'
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

export default class AllureFailingHookReporter extends WDIOReporter {
  private hasRealTestStarted = false
  private inBeforeAll = false
  private inAfterAll = false
  private hookSuiteTitle = ''

  private bufferedEvents: BufferedEvent[] = []

  constructor(options: Partial<Reporters.Options>) {
    super(options)

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
      if (!this.hasRealTestStarted && (this.inBeforeAll || this.inAfterAll)) {
        this.bufferedEvents.push({ message: payload, at: Date.now() })
      }
    })
  }

  async onTestStart(): Promise<void> {
    // Mark that a real test has started (hooks are done)
    this.hasRealTestStarted = true
  }

  onHookStart(hook: unknown): void {
    const h = hook as { title?: unknown; parent?: unknown }
    const title = typeof h?.title === 'string' ? h.title : ''
    const suiteTitle = typeof (h?.parent as { title?: unknown })?.title === 'string'
      ? String((h?.parent as { title?: unknown })?.title)
      : '(root)'

    if (title.includes('"before all" hook')) {
      this.inBeforeAll = true
      this.hookSuiteTitle = suiteTitle
    } else if (title.includes('"after all" hook')) {
      this.inAfterAll = true
      this.hookSuiteTitle = suiteTitle
    }
  }

  async onHookEnd(hook: unknown): Promise<void> {
    const h = hook as { title?: unknown; error?: unknown;
      parent?: unknown; start?: number; end?: number }
    const title = typeof h?.title === 'string' ? h.title : ''
    const hadError = !!h?.error
    const isBeforeAll = title.includes('"before all" hook')
    const isAfterAll = title.includes('"after all" hook')

    if (isBeforeAll) this.inBeforeAll = false
    if (isAfterAll) this.inAfterAll = false

    /*
     * Success case: beforeAll/afterAll succeeded with buffered events
     * Clear the buffer since the steps aren't needed (hook passed, test will run normally)
     * The default WDIO fixture shows the hook passed, which is sufficient
     */
    if (!hadError && !this.hasRealTestStarted && this.bufferedEvents.length > 0 && (isBeforeAll || isAfterAll)) {
      this.clearBuffers()
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
      const syntheticName = `${isBefore ? 'Global Setup' : 'Global Teardown'}: ${this.hookSuiteTitle || '(root)'} `
      const __ts = getBufferedMinMaxTimes(this.bufferedEvents)

      this.emitRuntimeMessage('allure:test:start', { name: syntheticName, start: __ts.start })

      // Labels help filter these synthetic entries in Allure UI
      const tagValue = isBefore ? 'GlobalSetup' : 'GlobalTeardown'
      this.emitRuntimeMessage('metadata', { labels: [{ name: 'tag', value: tagValue }] })

      // Replay all buffered evidence (steps, screenshots) into the synthetic test
      await this.flushBufferedEvents()

      this.emitRuntimeMessage('allure:test:end', {
        status: Status.BROKEN,
        stage: Stage.FINISHED,
        statusDetails: getMessageAndTraceFromErrorLocal(h?.error),
        stop: __ts.stop
      })
      this.clearBuffers()
    }
  }

  onAfterCommand(command: { command?: string; result?: unknown }): void {
    if (this.hasRealTestStarted) return
    if (!(this.inBeforeAll || this.inAfterAll)) return
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

  async onRunnerEnd(): Promise<void> { return }

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
