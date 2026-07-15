/**
 * Test-only helper: generates a unique MongoDB database name per spec-file
 * run so Mongo-backed integration specs never share a database when Vitest
 * executes spec files in parallel workers.
 *
 * Not exported from the library's public `index.ts` — this is test
 * infrastructure, not part of the package's runtime surface.
 */
export function generateTestDbName(prefix: string): string {
  const randomBytes = new Uint8Array(12);

  if (
    typeof globalThis.crypto !== 'undefined' &&
    globalThis.crypto.getRandomValues
  ) {
    globalThis.crypto.getRandomValues(randomBytes);
  } else {
    for (let i = 0; i < randomBytes.length; i++) {
      randomBytes[i] = Math.floor(Math.random() * 256);
    }
  }

  const suffix = Array.from(randomBytes, (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');

  return `${prefix}-${suffix}`;
}
