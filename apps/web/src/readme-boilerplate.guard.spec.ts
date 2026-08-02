import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Regression guard for the shipped-with-unmodified-generator-boilerplate bug
 * class found in `libs/budget/*` READMEs: `@nx/angular:library` and
 * `@nx/js:library` both emit a templated README whose body is never
 * required to be edited by any build/lint/test step, so a lib can ship
 * forever with generator placeholder prose instead of this repo's one-line
 * convention (name + tags + summary, see e.g. `libs/budget/core/README.md`).
 * Nothing red-flags this — no build error, no lint error, no test failure —
 * until a manual governance-docs read catches it.
 *
 * Marker strings below are copied verbatim from the actual generator
 * templates shipped in this workspace's installed `node_modules` (not
 * invented):
 *   - `@nx/angular/dist/src/generators/library/files/base/README.md__tpl__`
 *   - `@nx/js/dist/src/generators/library/files/readme/README.md`
 * Both templates emit the literal line
 *   "This library was generated with [Nx](https://nx.dev)."
 * and, when unit testing is enabled, a body line of the form
 *   "Run `<cli> test <name>` to execute the unit tests[ via Jest/Vitest]."
 */
describe('Nx-generator README boilerplate guard', () => {
  const workspaceRoot = resolve(__dirname, '../../..');
  const libsRoot = join(workspaceRoot, 'libs');

  // Literal substrings emitted by the @nx/angular:library and @nx/js:library
  // README templates — see file-level comment for the exact template paths.
  const boilerplateMarkers: string[] = [
    'This library was generated with [Nx]',
    'to execute the unit tests',
  ];

  function collectReadmeFiles(dir: string): string[] {
    const out: string[] = [];
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return out;
    }
    for (const entry of entries) {
      if (entry === 'node_modules' || entry === 'dist' || entry === '.git') {
        continue;
      }
      const full = join(dir, entry);
      const info = statSync(full);
      if (info.isDirectory()) {
        out.push(...collectReadmeFiles(full));
      } else if (entry === 'README.md') {
        out.push(full);
      }
    }
    return out;
  }

  // Every `libs/<scope>/<name>/README.md` in the workspace, discovered by
  // walking the directory tree (not a hardcoded lib list) so it
  // automatically covers libraries that don't exist yet.
  const readmeFiles: string[] = [];
  for (const scope of readdirSync(libsRoot)) {
    const scopeDir = join(libsRoot, scope);
    if (!statSync(scopeDir).isDirectory()) continue;
    for (const name of readdirSync(scopeDir)) {
      const libDir = join(scopeDir, name);
      if (!statSync(libDir).isDirectory()) continue;
      readmeFiles.push(...collectReadmeFiles(libDir));
    }
  }

  it('finds at least one library README to scan (guards against a silently-empty sweep)', () => {
    expect(readmeFiles.length).toBeGreaterThan(0);
  });

  it('contains no unmodified Nx-generator boilerplate markers in any library README', () => {
    const offenders: string[] = [];

    for (const file of readmeFiles) {
      const content = readFileSync(file, 'utf8');
      for (const marker of boilerplateMarkers) {
        if (content.includes(marker)) {
          offenders.push(`${file} — contains "${marker}"`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('would flag a sample of the real generator output (positive control against a silently-emptied marker list)', () => {
    // Guards against a mutation where `boilerplateMarkers` is accidentally
    // emptied or narrowed to the point the "no offenders" test above passes
    // vacuously instead of because the READMEs are actually clean.
    const sampleGeneratedReadme = [
      '# my-lib',
      '',
      'This library was generated with [Nx](https://nx.dev).',
      '',
      '## Running unit tests',
      '',
      'Run `nx test my-lib` to execute the unit tests via [Vitest](https://vitest.dev).',
      '',
    ].join('\n');

    expect(boilerplateMarkers.length).toBeGreaterThan(0);
    for (const marker of boilerplateMarkers) {
      expect(sampleGeneratedReadme.includes(marker)).toBe(true);
    }
  });
});
