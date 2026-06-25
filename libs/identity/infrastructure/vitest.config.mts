import { defineConfig } from 'vitest/config';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../../node_modules/.vite/libs/identity/infrastructure',
  resolve: { tsconfigPaths: true },
  test: {
    name: 'identity-infrastructure',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    testTimeout: 30000,
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../../coverage/libs/identity/infrastructure',
      provider: 'v8' as const,
    },
  },
}));
