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

const GLOBAL_SETUP_BUFFER_KEY = '__WDIO_GLOBAL_SETUP_EVENTS__'

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

// Reporter that makes sure setup/hook evidence is visible even when no test is active yet.
export default class AllureFailingHookReporter extends WDIOReporter {
  private outputDir: string
  private hasRealTestStarted = false
  private inBeforeAll = false
  private inAfterAll = false
  private hookSuiteTitle = ''

  // Track active execution contexts to detect global fixtures
  private activeSuites = new Set<any>()
  private activeHooks = new Set<any>()
  private activeTests = new Set<any>()

  private bufferedEvents: BufferedEvent[] = []
  private globalSetupEvents: BufferedEvent[] = []
  private hookConsoleOutput = ''
  private hookErrorOutput = ''
  private allureStdoutWrapper: typeof process.stdout.write | null = null
  private allureStderrWrapper: typeof process.stderr.write | null = null
  private hookLogsPrepended = false
  private isFlushing = false  // Prevent re-buffering during flush
  private exitHandlerRan = false  // Ensure exit handler only runs once
  private lastGlobalError: { message?: string; trace?: string } | null = null
  private globalFixtureReplayed = false
  constructor(options: Partial<Reporters.Options>) {
    super(options)
    // Read shared allure output dir (passed from wdio.conf to our reporter)
    const o = (options || {}) as { outputDir?: string }
    this.outputDir = o.outputDir || 'allure-results'

    // If mochaGlobalSetup ran before reporters attached, harvest its buffered events.
    const preBuffered = (globalThis as any)[GLOBAL_SETUP_BUFFER_KEY]
    if (Array.isArray(preBuffered) && preBuffered.length > 0) {
      for (const entry of preBuffered) {
        if (entry && typeof entry.at === 'number' && entry.message) {
          this.globalSetupEvents.push({ at: entry.at, message: entry.message as WDIORuntimeMessage })
        }
      }
      preBuffered.length = 0
    }

    // Start capturing stdout immediately (for mochaGlobalSetup).
    this.wrapStdoutAndStderr();

    // Monitor uncaught exceptions without altering Node's default behavior
    process.on('uncaughtExceptionMonitor', (err) => {
      this.lastGlobalError = getMessageAndTraceFromErrorLocal(err)
    })

    // Exit-time fallback: if mochaGlobalSetup/Teardown failed before any test began, emit a synthetic result.
    process.on('exit', () => {
      if (this.exitHandlerRan) return
      this.exitHandlerRan = true

      if (this.hasRealTestStarted) return
      const pendingEvents = this.globalSetupEvents.length > 0 ? this.globalSetupEvents : this.bufferedEvents
      if (pendingEvents.length === 0 && !this.hookConsoleOutput.trim()) return

      try {
        const fs = require('node:fs') as typeof import('node:fs')
        const path = require('node:path') as typeof import('node:path')
        const { randomUUID } = require('node:crypto') as typeof import('node:crypto')

        // Ensure output dir exists
        fs.mkdirSync(this.outputDir, { recursive: true })

        const __ts = getBufferedMinMaxTimes(pendingEvents)
        const uuid: string = randomUUID()

        // Build steps from buffered step_start/step_stop events
        const steps: any[] = []
        const stepStack: any[] = []
        const attachmentsToWrite: Array<{ source: string; buffer: Buffer; type: string }> = []

        for (const ev of pendingEvents) {
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
            }
            if (stepStack.length > 0) stepStack[stepStack.length - 1].steps.push(step)
            else steps.push(step)
            stepStack.push(step)
          } else if (ev.message.type === 'step_stop') {
            if (stepStack.length > 0 && ev.message.data.stop) {
              const st = stepStack.pop()
              if (st) st.stop = ev.message.data.stop
            }
          } else if (ev.message.type === 'attachment_content') {
            const source = `${uuid}-${(ev.message.data.name || 'attachment').toString().replace(/\s+/g, '_')}-${attachmentsToWrite.length + 1}`
            const type = ev.message.data.contentType || 'application/octet-stream'
            const buf = ev.message.data.content
              ? Buffer.from(ev.message.data.content, ev.message.data.encoding || 'base64')
              : Buffer.alloc(0)
            attachmentsToWrite.push({ source, buffer: buf, type })
            const att = { name: ev.message.data.name || 'Attachment', source: `${source}${guessExt(type)}`, type }
            if (stepStack.length > 0) stepStack[stepStack.length - 1].attachments.push(att)
            else steps.push({ name: 'Attachment', status: 'passed', stage: 'finished', start: ev.at, stop: ev.at, steps: [], attachments: [att], parameters: [] })
          }
        }

        // Console and error output (stdout/stderr) as a combined attachment
        let consoleAttachment: { name: string; source: string; type: string } | null = null
        const combinedLogs = [
          this.hookConsoleOutput.trim() ? '===== STDOUT =====\n' + this.hookConsoleOutput : '',
          this.hookErrorOutput.trim() ? '\n===== STDERR =====\n' + this.hookErrorOutput : ''
        ].filter(Boolean).join('\n')
        if (combinedLogs.trim()) {
          const src = `${uuid}-console-output.txt`
          attachmentsToWrite.push({ source: src.replace(/\.txt$/, ''), buffer: Buffer.from(combinedLogs), type: 'text/plain' })
          consoleAttachment = { name: 'Console Output', source: src, type: 'text/plain' }
        }

        // Write attachments to disk
        for (const a of attachmentsToWrite) {
          const filename = `${a.source}${guessExt(a.type)}`
          fs.writeFileSync(path.join(this.outputDir, filename), a.buffer)
        }

        // Aggregate attachments at top-level (only console here)
        const topAttachments = consoleAttachment ? [consoleAttachment] : []

        const statusDetails = this.lastGlobalError
          || deriveStatusDetailsFromConsole(this.hookErrorOutput || this.hookConsoleOutput)
          || { message: 'mochaGlobalSetup/Teardown failed before tests could run' }
        const result = {
          uuid,
          name: 'Global fixture failure',
          historyId: `mochaGlobalSetup:${process.pid}`,
          status: 'broken',
          stage: 'finished',
          statusDetails,
          start: __ts.start,
          stop: __ts.stop,
          steps,
          attachments: topAttachments,
          parameters: [],
          links: [],
          labels: [
            { name: 'tag', value: 'GlobalFixtureFailure' },
            { name: 'parentSuite', value: '(global)' }
          ]
        }

        fs.writeFileSync(path.join(this.outputDir, `${uuid}-result.json`), JSON.stringify(result))
      } catch {
        // Swallow errors to not interfere with process exit
      } finally {
        this.clearBuffers()
      }
    })

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
    // Central runtime message tap – determines which buffer the event belongs to.
    process.on('allure:runtimeMessage', (payload) => {
      // Don't buffer if we're currently flushing (prevents infinite loop)
      if (this.isFlushing) return;

      // Buffer events when nothing is active (global fixtures) or during beforeAll/afterAll
      const nothingActive = this.activeSuites.size === 0 && this.activeHooks.size === 0 && this.activeTests.size === 0;
      const inGlobalFixture = nothingActive && !this.hasRealTestStarted;

      if (inGlobalFixture) {
        this.globalSetupEvents.push({ message: payload, at: Date.now() })
      } else if (this.inBeforeAll || this.inAfterAll) {
        this.bufferedEvents.push({ message: payload, at: Date.now() })
      }
    })
  }

  onRunnerStart(runnerStats: any): void {
    // Let allureReporter handle on its own, just track for our logic
  }

  // Suites let us know when the runner is about to create real tests.
  onSuiteStart(suiteStats: any): void {
    this.activeSuites.add(suiteStats);
    if (!this.globalFixtureReplayed && !this.hasRealTestStarted && this.globalSetupEvents.length > 0) {
      void this.replayBufferedGlobalFixture()
    }
  }

  onSuiteEnd(suiteStats: any): void {
    this.activeSuites.delete(suiteStats);
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
      this.wrapStdoutAndStderr()
    } else if (title.includes('"after all" hook')) {
      this.inAfterAll = true
      this.hookSuiteTitle = suiteTitle
    }

    // Don't call allureReporter - it gets events directly
  }

  // Hijack stdout/stderr so setup logs can be prepended once a test is available.
  private wrapStdoutAndStderr(): void {
    // Only wrap once
    if (this.allureStdoutWrapper || this.allureStderrWrapper) return

    // Save allure's wrappers (which are currently active)
    this.allureStdoutWrapper = process.stdout.write
    this.allureStderrWrapper = process.stderr.write

    const self = this
    // Replace stdout with our wrapper that ALWAYS calls through to allure
    process.stdout.write = function(
      chunk: Uint8Array | string,
      encoding?: BufferEncoding | ((error: Error | null | undefined) => void),
      cb?: ((error: Error | null | undefined) => void)
    ): boolean {
      const str = typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8')

      // Capture during hooks OR before any test starts (for mochaGlobalSetup)
      if (self.inBeforeAll || self.inAfterAll || !self.hasRealTestStarted) {
        self.hookConsoleOutput += str
      }

      // Prepend hook logs when we see the FIRST test log (after hooks complete)
      if (self.hasRealTestStarted && !self.hookLogsPrepended && self.hookConsoleOutput.trim() && !str.includes('[DEBUG]')) {
        self.hookLogsPrepended = true
        // Emit hook logs FIRST
        if (self.allureStdoutWrapper) {
          self.allureStdoutWrapper('\n========== Setup Hooks Console Output ==========' as any, undefined as any, undefined as any)
          self.allureStdoutWrapper(self.hookConsoleOutput as any, undefined as any, undefined as any)
          self.allureStdoutWrapper('=================================================\n\n' as any, undefined as any, undefined as any)
        }
        self.hookConsoleOutput = ''
      }

      // ALWAYS call allure's wrapper
      if (self.allureStdoutWrapper) {
        if (typeof encoding === 'function') {
          return (self.allureStdoutWrapper as any).call(process.stdout, chunk, undefined, encoding)
        }
        return (self.allureStdoutWrapper as any).call(process.stdout, chunk, encoding, cb)
      }
      return true
    }

    // Replace stderr too
    process.stderr.write = function(
      chunk: Uint8Array | string,
      encoding?: BufferEncoding | ((error: Error | null | undefined) => void),
      cb?: ((error: Error | null | undefined) => void)
    ): boolean {
      const str = typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8')
      if (self.inBeforeAll || self.inAfterAll || !self.hasRealTestStarted) {
        self.hookErrorOutput += str
      }
      if (self.allureStderrWrapper) {
        if (typeof encoding === 'function') {
          return (self.allureStderrWrapper as any).call(process.stderr, chunk, undefined, encoding)
        }
        return (self.allureStderrWrapper as any).call(process.stderr, chunk, encoding, cb)
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

    // Success case: rely on @wdio/allure-reporter to record fixtures/steps
    if (!hadError) {
      // Clear buffered low-level runtime messages to avoid double-replay
      if (this.bufferedEvents.length > 0) this.clearHookBuffer()
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

    // Don't call allureReporter - it gets events directly from BaseReporter
  }

  async onTestStart(testStats: any): Promise<void> {
    this.activeTests.add(testStats);
    this.hasRealTestStarted = true;

    // Merge any captured setup logs into the upcoming test's Console Logs
    if (this.hookConsoleOutput.trim()) {
      const msg = `\n========== Setup Hooks Console Output ==========\n${this.hookConsoleOutput}\n=================================================\n`;
      if (this.allureStdoutWrapper) (this.allureStdoutWrapper as any).call(process.stdout, msg, undefined, undefined);
      else process.stdout.write(msg);
    }
    if (this.hookErrorOutput.trim()) {
      const msg = `\n========== Setup Hooks Console Output ==========\n${this.hookErrorOutput}\n=================================================\n`;
      if (this.allureStderrWrapper) (this.allureStderrWrapper as any).call(process.stderr, msg, undefined, undefined);
      else process.stderr.write(msg);
    }
    this.hookConsoleOutput = '';
    this.hookErrorOutput = '';

    // If mochaGlobalSetup ran and buffered events exist but we didn't yet attach them, do it now.
    if (this.globalSetupEvents.length > 0) {
      await this.replayBufferedGlobalFixture()
    }
  }

  onTestEnd(testStats: any): void {
    this.activeTests.delete(testStats);
  }

  // Flush buffered mochaGlobalSetup events as a synthetic fixture so Allure renders them.
  private async replayBufferedGlobalFixture(): Promise<void> {
    if (this.globalSetupEvents.length === 0) return
    const ts = getBufferedMinMaxTimes(this.globalSetupEvents)
    const hookName = '"before all" hook: mochaGlobalSetup'
    this.emitRuntimeMessage('allure:hook:start', { type: 'before', name: hookName, start: ts.start })
    await this.flushBufferedEvents(this.globalSetupEvents)
    this.emitRuntimeMessage('allure:hook:end', {
      status: Status.PASSED,
      stop: ts.stop,
      duration: ts.stop - ts.start
    })
    this.globalFixtureReplayed = true
    this.clearGlobalSetupBuffer()
  }

  // (removed duplicate empty onRunnerEnd; single implementation below)

  // WDIO doesn’t emit allure:runtimeMessage for screenshots taken during hooks; capture them manually.
  onAfterCommand(command: { command?: string; result?: unknown }): void {
    // Capture screenshots from beforeAll/afterAll hooks or global fixtures
    const nothingActive = this.activeSuites.size === 0 && this.activeHooks.size === 0 && this.activeTests.size === 0;
    const inGlobalFixture = nothingActive && !this.hasRealTestStarted;

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
    const targetBuffer = inGlobalFixture ? this.globalSetupEvents : this.bufferedEvents
    targetBuffer.push({
      at: Date.now(),
      message: {
        type: 'attachment_content',
        data: { name: 'Screenshot', content: base64, contentType: ContentType.PNG, encoding: 'base64' }
      }
    })
  }

  // Remove onRunnerEnd synthetic: rely on exit fallback for mochaGlobalSetup cases

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
  // Replay runtime messages in order, avoiding recursive buffering while we emit.
  private async flushBufferedEvents(buffer: BufferedEvent[] = this.bufferedEvents): Promise<void> {
    // Prevent re-buffering via our process listener and avoid array growth during iteration
    this.isFlushing = true;
    const snapshot = buffer.slice();
    for (const ev of snapshot) {
      this.emitRuntimeMessage(ev.message.type, ev.message.data)
    }
    this.isFlushing = false;
  }

  private clearHookBuffer(): void {
    this.bufferedEvents = []
  }

  private clearGlobalSetupBuffer(): void {
    this.globalSetupEvents = []
  }

  private clearBuffers(): void {
    this.clearHookBuffer()
    this.clearGlobalSetupBuffer()
    this.hookSuiteTitle = ''
    this.hookErrorOutput = ''
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

function guessExt(contentType: string): string {
  const ct = (contentType || '').toLowerCase()
  if (ct.includes('png')) return '.png'
  if (ct.includes('jpeg') || ct.includes('jpg')) return '.jpg'
  if (ct.includes('gif')) return '.gif'
  if (ct.includes('webp')) return '.webp'
  if (ct.includes('json')) return '.json'
  if (ct.includes('text') || ct.includes('plain')) return '.txt'
  return ''
}

function deriveStatusDetailsFromConsole(consoleOut: string): { message?: string; trace?: string } | null {
  if (!consoleOut || !consoleOut.trim()) return null
  const lines = consoleOut.split(/\r?\n/)
  // Look for typical error header and stack frames
  const startIdx = lines.findIndex(l => /\b(AssertionError|Error)\b\s*[:]/.test(l))
  if (startIdx === -1) return null
  const lineAtIndex = lines[startIdx]
  if (!lineAtIndex) return null
  const messageLine = lineAtIndex.trim()
  const stackLines: string[] = []
  for (let i = startIdx + 1; i < lines.length; i++) {
    const ln = lines[i]
    if (!ln) continue
    if (/^\s*at\s+/.test(ln)) stackLines.push(ln)
  }
  return {
    message: messageLine,
    trace: [messageLine, ...stackLines].join('\n')
  }
}
