// Global debug mode flag for enhanced test logging on retries
// Tests can check this flag to emit more verbose output

export let isDebugMode = false

export function enableDebugMode() {
  isDebugMode = true
}

export function disableDebugMode() {
  isDebugMode = false
}

// Helper for conditional debug logging in tests
export function debugLog(...args: any[]) {
  if (isDebugMode) {
    console.log('[DEBUG]', ...args)
  }
}
