#!/usr/bin/env node

/**
 * Root-level ESLint linter that runs from the workspace root.
 *
 * This covers path-anchored rules in the root config that would be dead under
 * per-project linting. When per-project linting runs via `nx lint <project>`,
 * ESLint resolves root-config file globs against the project's own basePath,
 * stripping path segments that depend on repo structure. This script runs from
 * the repo root where root-relative globs work natively.
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

const eslintCmd = spawn(
  'npx',
  ['eslint', '.', '--config', 'eslint.config.mjs'],
  {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  },
);

eslintCmd.on('close', (code) => {
  process.exit(code);
});

eslintCmd.on('error', (err) => {
  console.error('Failed to run ESLint:', err);
  process.exit(1);
});
