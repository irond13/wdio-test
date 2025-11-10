// Dual logging approach: Always capture debug logs, conditionally output them

import fs from 'fs'
import { Writable } from 'stream'

// Debug log stream - can be redirected to /dev/null or stdout
let debugStream: Writable = fs.createWriteStream('/dev/null')
let isDebugEnabled = false

export function enableDebugLogging() {
  // Redirect debug logs to stdout
  debugStream = process.stdout
  isDebugEnabled = true
}

export function disableDebugLogging() {
  // Redirect debug logs to /dev/null
  if (debugStream !== process.stdout) {
    debugStream.end()
  }
  debugStream = fs.createWriteStream('/dev/null')
  isDebugEnabled = false
}

export function debug(...args: any[]) {
  // Always write to debug stream (goes to /dev/null or stdout depending on mode)
  const message = args.map(arg =>
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
  ).join(' ')

  debugStream.write(`[DEBUG] ${message}\n`)
}

export function isDebugLogging() {
  return isDebugEnabled
}
