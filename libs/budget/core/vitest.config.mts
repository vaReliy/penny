import { defineConfig } from 'vitest/config';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../../node_modules/.vite/libs/budget/core',
  resolve: { tsconfigPaths: true },
  test: {
    name: 'budget-core',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../../coverage/libs/budget/core',
      provider: 'v8' as const,
      // Enforce thresholds on every run (not only when --coverage is passed on the CLI)
      // so any invocation of the test target (including CI's explicit
      // `nx affected -t test`) is gated by coverage requirements.
      enabled: true,
      thresholds: { statements: 90, branches: 90, functions: 90, lines: 90 },
    },
  },
}));
