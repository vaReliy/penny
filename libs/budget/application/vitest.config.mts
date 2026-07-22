import { defineConfig } from 'vitest/config';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../../node_modules/.vite/libs/budget/application',
  resolve: { tsconfigPaths: true },
  test: {
    name: 'budget-application',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../../coverage/libs/budget/application',
      provider: 'v8' as const,
      // Enforce thresholds on every run (not only when --coverage is passed on the CLI)
      // so any invocation of the test target (including CI's explicit
      // `nx affected -t test`) is gated by coverage requirements.
      enabled: true,
      // Ratchet, matching `identity-application`'s baseline convention:
      // thresholds set below the measured baseline to catch regressions
      // while leaving headroom for minor fluctuation.
      thresholds: { statements: 92, branches: 85, functions: 95, lines: 92 },
    },
  },
}));
