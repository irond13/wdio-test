/**
 * Root Setup Hook
 * ================
 *
 * Runs once per worker process using module-level flag.
 * Must use mochaHooks (not mochaGlobalSetup) because Allure can only capture
 * events from hooks that execute within the Mocha runner lifecycle.
 *
 * Why not mochaGlobalSetup:
 * - Executes BEFORE runner starts emitting events
 * - WDIO reporters attach listeners AFTER mochaGlobalSetup runs
 * - Failures occur in event-free "no-man's land"
 * - Source: node_modules/mocha/lib/mocha.js lines 1007 (globalSetup) vs 1094 (EVENT_RUN_BEGIN)
 *
 * Source: https://mochajs.org/#root-hook-plugins
 */

import { browser } from '@wdio/globals';

const GLOBAL_SETUP_BUFFER_KEY = '__WDIO_GLOBAL_SETUP_EVENTS__'

// Optional: mochaGlobalSetup support
// Enable via env GLOBAL_SETUP_CAPTURE=1 to run early (before Mocha runner events)
// If it fails (GLOBAL_SETUP_FAIL=1 or GLOBAL_HOOK_FAIL=1), our custom reporter will
// write a synthetic "Global fixture failure" result on process exit.
export const mochaGlobalSetup = async () => {
  if (!process.env.GLOBAL_SETUP_CAPTURE) return;

  const getLogger = (await import('@wdio/logger')).default;
  const log = getLogger('globalSetup');
  log.info('Starting mochaGlobalSetup');

  // Shared buffer to bridge events emitted before reporters attach
  const sharedBuffer: Array<{ at: number; message: { type: string; data: any } }> = Array.isArray((globalThis as any)[GLOBAL_SETUP_BUFFER_KEY])
    ? (globalThis as any)[GLOBAL_SETUP_BUFFER_KEY]
    : []
  sharedBuffer.length = 0
  ;(globalThis as any)[GLOBAL_SETUP_BUFFER_KEY] = sharedBuffer

  const emitRuntimeMessage = (type: string, data: any) => {
    const message = { type, data }
    sharedBuffer.push({ at: Date.now(), message })
    process.emit('allure:runtimeMessage' as any, message as any)
  }

  const start1 = Date.now()
  emitRuntimeMessage('step_start', { name: 'Global setup step 1: Navigate', start: start1 })
  await browser.url('https://example.org')
  emitRuntimeMessage('step_stop', { status: 'passed', stop: Date.now() })

  const start2 = Date.now()
  emitRuntimeMessage('step_start', { name: 'Global setup step 2: Screenshot', start: start2 })
  const screenshot = await browser.takeScreenshot()
  emitRuntimeMessage('attachment_content', {
    name: 'Global setup screenshot',
    content: screenshot,
    contentType: 'image/png',
    encoding: 'base64'
  })
  emitRuntimeMessage('step_stop', { status: 'passed', stop: Date.now() })

  log.info('mochaGlobalSetup completed');

  if (process.env.GLOBAL_SETUP_FAIL || process.env.GLOBAL_HOOK_FAIL) {
    log.error('mochaGlobalSetup intentionally failing');
    throw new Error('mochaGlobalSetup failure - captured by exit fallback');
  }
};
