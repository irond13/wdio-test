// True Mocha global hook (JavaScript, not TypeScript)
// Loaded via mochaOpts.require

// Note: This runs in Mocha context where 'before' is a global
// Cannot use TypeScript here unless we configure ts-node properly

before('Global Mocha hook', function() {
  // Note: Cannot use browser or allure.step here - they're not available yet!
  // This is a limitation of Mocha's require - it runs before WDIO initializes
  console.log('[GLOBAL MOCHA HOOK] This runs but cannot access browser or allure APIs')
})
