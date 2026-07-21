// Exercises generate-web-env.mjs as a subprocess against a throwaway repo
// layout (tempRoot/tools/generate-web-env.mjs + tempRoot/apps/web/src/environments/*),
// because the script resolves REPO_ROOT from its own file location
// (import.meta.url), not from process.cwd() or an env var. Copying the script
// into a temp fixture tree is the lightest way to exercise real filesystem
// behavior without modifying the production script for testability.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
  cpSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_SOURCE = fileURLToPath(
  new URL('./generate-web-env.mjs', import.meta.url),
);
const EXAMPLE_CONTENTS = 'export const environment = { source: true };\n';
const CUSTOM_CONTENTS = 'export const environment = { custom: true };\n';

describe('generate-web-env', () => {
  let tempRoot;
  let scriptPath;
  let envDir;
  let examplePath;

  beforeEach(() => {
    tempRoot = mkdtempSync(path.join(tmpdir(), 'generate-web-env-'));
    const toolsDir = path.join(tempRoot, 'tools');
    mkdirSync(toolsDir, { recursive: true });
    scriptPath = path.join(toolsDir, 'generate-web-env.mjs');
    cpSync(SCRIPT_SOURCE, scriptPath);

    envDir = path.join(tempRoot, 'apps/web/src/environments');
    mkdirSync(envDir, { recursive: true });
    examplePath = path.join(envDir, 'environment.example.ts');
    writeFileSync(examplePath, EXAMPLE_CONTENTS);
  });

  afterEach(() => {
    rmSync(tempRoot, { recursive: true, force: true });
  });

  function run(args = []) {
    return execFileSync('node', [scriptPath, ...args], { encoding: 'utf8' });
  }

  it('creates both target files from source when they do not exist', () => {
    const envFile = path.join(envDir, 'environment.ts');
    const devFile = path.join(envDir, 'environment.development.ts');

    const output = run();

    expect(existsSync(envFile)).toBe(true);
    expect(existsSync(devFile)).toBe(true);
    expect(readFileSync(envFile, 'utf8')).toBe(EXAMPLE_CONTENTS);
    expect(readFileSync(devFile, 'utf8')).toBe(EXAMPLE_CONTENTS);
    expect(output).toContain('wrote apps/web/src/environments/environment.ts');
    expect(output).toContain(
      'wrote apps/web/src/environments/environment.development.ts',
    );
  });

  it('leaves existing destination files alone without --force', () => {
    const envFile = path.join(envDir, 'environment.ts');
    writeFileSync(envFile, CUSTOM_CONTENTS);

    const output = run();

    expect(readFileSync(envFile, 'utf8')).toBe(CUSTOM_CONTENTS);
    expect(output).toContain('environment.ts exists, leaving as-is');
    // The other target still gets created since it didn't exist.
    const devFile = path.join(envDir, 'environment.development.ts');
    expect(existsSync(devFile)).toBe(true);
    expect(readFileSync(devFile, 'utf8')).toBe(EXAMPLE_CONTENTS);
  });

  it('overwrites existing destination files with --force', () => {
    const envFile = path.join(envDir, 'environment.ts');
    writeFileSync(envFile, CUSTOM_CONTENTS);

    const output = run(['--force']);

    expect(readFileSync(envFile, 'utf8')).toBe(EXAMPLE_CONTENTS);
    expect(output).toContain('wrote apps/web/src/environments/environment.ts');
  });

  it('exits non-zero with a clear stderr message when source is missing', () => {
    rmSync(examplePath);

    try {
      run();
      expect.fail('expected generate-web-env to exit non-zero');
    } catch (error) {
      expect(error.status).toBe(1);
      expect(error.stderr.toString()).toContain('source not found');
    }
  });
});
