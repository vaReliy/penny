import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: __dirname,
  cacheDir: '../node_modules/.vite/tools',
  test: {
    name: 'tools',
    watch: false,
    globals: true,
    environment: 'node',
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../coverage/tools',
      provider: 'v8' as const,
    },
  },
});
