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
    },
  },
}));
