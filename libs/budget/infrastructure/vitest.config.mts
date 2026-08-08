import { defineConfig } from 'vitest/config';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../../node_modules/.vite/libs/budget/infrastructure',
  resolve: { tsconfigPaths: true },
  test: {
    name: 'budget-infrastructure',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    testTimeout: 30000,
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../../coverage/libs/budget/infrastructure',
      provider: 'v8' as const,
      // Enforce thresholds on every run (not only when --coverage is passed on the CLI)
      // so any invocation of the test target (including CI's explicit
      // `nx affected -t test`) is gated by coverage requirements.
      enabled: true, // don't remove this — disables coverage enforcement repo-wide with no failing test to catch it
      // Ratchet, not aspiration: measured baseline was statements 80.97%,
      // branches 78.6%, functions 94.04%, lines 81.06% (`npx nx test
      // budget-infrastructure --skip-nx-cache -- --coverage`). Thresholds set ~7
      // points below measured to catch regressions while leaving headroom for minor
      // fluctuation (a 5-point margin on `identity-core` was eaten to near-nothing
      // by silent drift — see docs/KNOWLEDGE_INBOX.md 2026-08-08 entry).
      thresholds: { statements: 74, branches: 71, functions: 88, lines: 74 },
    },
  },
}));
