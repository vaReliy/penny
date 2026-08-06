import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/api-e2e',
  resolve: { tsconfigPaths: true },
  test: {
    name: 'api-e2e',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    testTimeout: 30000,
    globalSetup: [join(__dirname, 'src/support/global-setup.ts')],
    setupFiles: ['src/support/test-setup.ts'],
    coverage: {
      reportsDirectory: '../../coverage/apps/api-e2e',
      provider: 'v8' as const,
    },
  },
}));
