import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, relative, sep } from 'node:path';

/**
 * Regression guard for the "silently-unscanned lib" bug class fixed in
 * `apps/web/src/styles.css` (missing `@source '../../../libs/budget/**'`
 * globs). Tailwind v4's content scanner has no error path for a lib that
 * contains templates but isn't listed in `@source` — utility classes used
 * only in that lib simply don't generate CSS, with no build/type error.
 *
 * This test finds every `libs/*\/*\/src` directory that contains at least
 * one `.html` template and asserts it is covered by an `@source` glob in
 * `apps/web/src/styles.css`, so adding a new lib with templates and
 * forgetting to wire it into the content scan fails CI instead of
 * shipping unstyled markup.
 */
describe('Tailwind @source glob coverage guard', () => {
  const webSrcDir = resolve(__dirname);
  const workspaceRoot = resolve(__dirname, '../../..');
  const stylesPath = join(webSrcDir, 'styles.css');
  const stylesContent = readFileSync(stylesPath, 'utf8');

  const sourcePaths = [...stylesContent.matchAll(/@source\s+'([^']+)'/g)].map(
    (match) => resolve(webSrcDir, match[1]),
  );

  function hasHtmlFile(dir: string): boolean {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return false;
    }
    for (const entry of entries) {
      if (entry === 'node_modules' || entry === 'dist' || entry === '.git') {
        continue;
      }
      const full = join(dir, entry);
      const info = statSync(full);
      if (info.isDirectory()) {
        if (hasHtmlFile(full)) {
          return true;
        }
      } else if (entry.endsWith('.html')) {
        return true;
      }
    }
    return false;
  }

  // Every `libs/<scope>/<name>/src` directory in the workspace.
  const libsRoot = join(workspaceRoot, 'libs');
  const libSrcDirs: string[] = [];
  for (const scope of readdirSync(libsRoot)) {
    const scopeDir = join(libsRoot, scope);
    if (!statSync(scopeDir).isDirectory()) continue;
    for (const name of readdirSync(scopeDir)) {
      const srcDir = join(scopeDir, name, 'src');
      try {
        if (statSync(srcDir).isDirectory()) {
          libSrcDirs.push(srcDir);
        }
      } catch {
        // no src dir for this lib — skip
      }
    }
  }

  const libSrcDirsWithTemplates = libSrcDirs.filter(hasHtmlFile);

  it('finds at least one lib src dir containing templates (guards against a silently-empty sweep)', () => {
    expect(libSrcDirsWithTemplates.length).toBeGreaterThan(0);
  });

  it('every libs/**/src dir with .html templates is covered by an @source glob', () => {
    const uncovered = libSrcDirsWithTemplates
      .filter(
        (dir) =>
          !sourcePaths.some(
            (sourcePath) =>
              dir === sourcePath || dir.startsWith(sourcePath + sep),
          ),
      )
      .map((dir) => relative(workspaceRoot, dir));

    expect(uncovered).toEqual([]);
  });
});
