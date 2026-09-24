import { defineConfig } from 'vitest/config';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../../node_modules/.vite/libs/workspace/testing',
  resolve: { tsconfigPaths: true },
  test: {
    name: 'workspace-testing',
    // Empty shell until W2a — see README.md.
    passWithNoTests: true,
    watch: false,
    globals: true,
    environment: 'node',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../../coverage/libs/workspace/testing',
      provider: 'v8' as const,
    },
  },
}));
