import { defineConfig } from 'vitest/config';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../../node_modules/.vite/libs/identity/application',
  resolve: { tsconfigPaths: true },
  test: {
    name: 'identity-application',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../../coverage/libs/identity/application',
      provider: 'v8' as const,
      // Enforce thresholds on every run (not only when --coverage is passed on the CLI)
      // so any invocation of the test target (including CI's explicit
      // `nx affected -t test`) is gated by coverage requirements.
      enabled: true,
      // Ratchet, not aspiration: measured baseline was statements 97.53%,
      // branches 90.62%, functions 100%, lines 97.53% (`npx nx test
      // identity-application --skip-nx-cache -- --coverage`). Thresholds set ~5
      // points below measured to catch regressions while leaving headroom for minor
      // fluctuation.
      thresholds: { statements: 92, branches: 85, functions: 95, lines: 92 },
    },
  },
}));
