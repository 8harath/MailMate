import '@testing-library/jest-dom'

// Mock Next.js server environment globals that aren't available in jsdom
if (typeof globalThis.crypto === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { webcrypto } = require('node:crypto')
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, writable: false })
}
