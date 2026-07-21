#!/usr/bin/env node
// Single source of truth for producing the git-ignored Angular environment files
// from the checked-in example. Referenced by every CI job that runs an nx target
// against `web` (typecheck/test/build) and usable locally for first-time setup.
// Without these files, `../environments/environment` fails to resolve (TS2307 /
// esbuild "Failed to resolve import"), breaking web typecheck, test, and build.
import { copyFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const ENV_DIR = path.join(REPO_ROOT, 'apps/web/src/environments');
const SOURCE = path.join(ENV_DIR, 'environment.example.ts');
const TARGETS = ['environment.ts', 'environment.development.ts'];

const force = process.argv.includes('--force');

if (!existsSync(SOURCE)) {
  console.error(
    `generate-web-env: source not found: ${path.relative(REPO_ROOT, SOURCE)}`,
  );
  process.exit(1);
}

for (const target of TARGETS) {
  const dest = path.join(ENV_DIR, target);
  const rel = path.relative(REPO_ROOT, dest);
  if (existsSync(dest) && !force) {
    console.log(
      `generate-web-env: ${rel} exists, leaving as-is (use --force to overwrite).`,
    );
    continue;
  }
  copyFileSync(SOURCE, dest);
  console.log(`generate-web-env: wrote ${rel} from environment.example.ts.`);
}
