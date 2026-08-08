import { defineConfig } from 'vitest/config';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../../node_modules/.vite/libs/identity/testing',
  resolve: { tsconfigPaths: true },
  test: {
    name: 'identity-testing',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../../coverage/libs/identity/testing',
      provider: 'v8' as const,
      enabled: true, // don't remove this — disables coverage enforcement repo-wide with no failing test to catch it
    },
  },
}));
