import { defineConfig } from 'vitest/config';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../../node_modules/.vite/libs/identity/core',
  resolve: { tsconfigPaths: true },
  test: {
    name: 'identity-core',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../../coverage/libs/identity/core',
      provider: 'v8' as const,
      // Enforce thresholds on every run (not only when --coverage is passed on the CLI)
      // so any invocation of the test target (including CI's explicit
      // `nx affected -t test`) is gated by coverage requirements.
      enabled: true,
      // Ratchet, not aspiration: measured baseline was statements 81.81%,
      // branches 100%, functions 78.94%, lines 81.81% (`npx nx test identity-core
      // --skip-nx-cache -- --coverage`). Thresholds set ~5 points below measured to
      // catch regressions while leaving headroom for minor fluctuation.
      thresholds: { statements: 76, branches: 95, functions: 73, lines: 76 },
    },
  },
}));
