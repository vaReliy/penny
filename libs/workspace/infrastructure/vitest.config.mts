import { defineConfig } from 'vitest/config';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../../node_modules/.vite/libs/workspace/infrastructure',
  resolve: { tsconfigPaths: true },
  test: {
    name: 'workspace-infrastructure',
    // Empty shell until W2a — see README.md.
    passWithNoTests: true,
    watch: false,
    globals: true,
    environment: 'node',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../../coverage/libs/workspace/infrastructure',
      provider: 'v8' as const,
    },
  },
}));
