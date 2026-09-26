import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Regression guard for the single-implicit-workspace placeholder: budget
 * data is scoped by the `:workspaceId` route segment only, so neither the
 * old placeholder constant nor its literal value may reappear anywhere in
 * application or library source. Scans every `.ts` file under `apps/` and
 * `libs/` (excluding this file and build/dependency output).
 */

const thisFile = resolve(__filename);
const workspaceRoot = resolve(__dirname, '../../../..');
const SCANNED_ROOTS = ['apps', 'libs'] as const;
const SKIPPED_DIRECTORIES: ReadonlySet<string> = new Set([
  'node_modules',
  'dist',
  'coverage',
  'out-tsc',
  '.angular',
]);
const FORBIDDEN_PATTERN = /DEFAULT_WORKSPACE_ID|'default-workspace'/;

function collectTypeScriptFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRECTORIES.has(entry.name)) {
        files.push(...collectTypeScriptFiles(path));
      }
    } else if (
      entry.isFile() &&
      entry.name.endsWith('.ts') &&
      path !== thisFile
    ) {
      files.push(path);
    }
  }
  return files;
}

function findOffenders(files: readonly string[]): string[] {
  const offenders: string[] = [];
  for (const file of files) {
    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((line, index) => {
        if (FORBIDDEN_PATTERN.test(line)) {
          offenders.push(`${relative(workspaceRoot, file)}:${index + 1}`);
        }
      });
  }
  return offenders;
}

const scannedFiles = SCANNED_ROOTS.flatMap((root) =>
  collectTypeScriptFiles(join(workspaceRoot, root)),
);

describe('default-workspace placeholder removal guard', () => {
  it('scans source files under both apps/ and libs/', () => {
    for (const root of SCANNED_ROOTS) {
      expect(
        scannedFiles.some((file) =>
          relative(workspaceRoot, file).startsWith(`${root}/`),
        ),
        `no .ts files found under ${root}/`,
      ).toBe(true);
    }
  });

  it('finds no DEFAULT_WORKSPACE_ID identifier or placeholder literal in apps/ or libs/', () => {
    expect(findOffenders(scannedFiles)).toEqual([]);
  });
});
