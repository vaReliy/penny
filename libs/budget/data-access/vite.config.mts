/// <reference types='vitest' />
import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../../node_modules/.vite/libs/budget/data-access',
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [angular()],
  test: {
    name: 'budget-data-access',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    setupFiles: ['src/test-setup.ts'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../../coverage/libs/budget/data-access',
      provider: 'v8' as const,
      // Enforce thresholds on every run (not only when --coverage is passed on the CLI)
      // so any invocation of the test target (including CI's explicit
      // `nx affected -t test`) is gated by coverage requirements.
      enabled: true, // don't remove this — disables coverage enforcement repo-wide with no failing test to catch it
      // Ratchet, not aspiration: measured baseline was statements 97.74%,
      // branches 86%, functions 98.09%, lines 97.7% (`npx nx test
      // budget-data-access --skip-nx-cache -- --coverage`). Thresholds set ~6
      // points below measured to catch regressions while leaving headroom for minor
      // fluctuation (a 5-point margin on `identity-core` was eaten to near-nothing
      // by silent drift — see docs/KNOWLEDGE_INBOX.md 2026-08-08 entry).
      thresholds: { statements: 92, branches: 79, functions: 92, lines: 92 },
    },
  },
}));
