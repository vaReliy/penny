import { defineConfig } from 'vitest/config';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../../node_modules/.vite/libs/workspace/application',
  resolve: { tsconfigPaths: true },
  test: {
    name: 'workspace-application',
    // Empty shell until W2b — see README.md.
    passWithNoTests: true,
    watch: false,
    globals: true,
    environment: 'node',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../../coverage/libs/workspace/application',
      provider: 'v8' as const,
    },
  },
}));
