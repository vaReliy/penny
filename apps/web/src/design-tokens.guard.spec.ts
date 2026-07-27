import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * ADR-009 regression guard.
 *
 * Tailwind v4 silently falls back to its built-in defaults when a
 * `--radius-*`/`--shadow-*`/`--color-*` custom property referenced by a
 * utility class is missing from `@theme` — it does not error the build.
 * That means a template still using a pre-ADR-009 token name (dropped or
 * renamed in `apps/web/src/styles.css`) renders wrong but passes every
 * other gate (build, typecheck, lint). This test greps every template in
 * the workspace so a missed migration surfaces as a failing test instead
 * of a silent visual regression.
 */
describe('ADR-009 design-token migration guard', () => {
  const workspaceRoot = resolve(__dirname, '../../..');
  const scanDirs = [join(workspaceRoot, 'apps'), join(workspaceRoot, 'libs')];

  // Pre-ADR-009 token/class names that must not reappear in any template.
  const bannedPatterns: RegExp[] = [
    /\brounded-sm\b/,
    /\brounded-md\b/,
    /\brounded-lg\b/,
    /\bshadow-card\b/,
    /--radius-sm\b/,
    /--radius-md\b/,
    /--radius-lg\b/,
    /--shadow-card\b/,
  ];

  function collectHtmlFiles(dir: string): string[] {
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
        out.push(...collectHtmlFiles(full));
      } else if (entry.endsWith('.html')) {
        out.push(full);
      }
    }
    return out;
  }

  const htmlFiles = scanDirs.flatMap((dir) => collectHtmlFiles(dir));

  it('finds at least one template to scan (guards against a silently-empty sweep)', () => {
    expect(htmlFiles.length).toBeGreaterThan(0);
  });

  it('contains no pre-ADR-009 radius/shadow class or token names in any template', () => {
    const offenders: string[] = [];

    for (const file of htmlFiles) {
      const content = readFileSync(file, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        for (const pattern of bannedPatterns) {
          if (pattern.test(line)) {
            offenders.push(`${file}:${index + 1} — ${line.trim()}`);
          }
        }
      });
    }

    expect(offenders).toEqual([]);
  });
});
