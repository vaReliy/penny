import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Regression guard for the "silently-unfenced tag" bug class: `@nx/enforce-module-boundaries`
 * only fences a project along a dimension (scope/type) that has a matching `sourceTag` entry in
 * `depConstraints`. A tag with no matching entry is not fenced by default — no lint error, no
 * build error — so a new domain's or layer's onion/scope boundary can silently not exist until
 * someone notices in review.
 *
 * `eslint.config.mjs` declares TWO independent `depConstraints` arrays: one on the main
 * `**\/*.ts`/`.tsx`/`.js`/`.jsx` block, one on the `**\/*.spec.ts` override block. Per that
 * file's own comment, flat-config rule keys REPLACE rather than merge across matching config
 * objects, so each block must independently carry a complete depConstraints set — a tag covered
 * in only one block still leaves the other block's matching files completely unfenced. This
 * guard therefore inspects each block's depConstraints array separately (by importing the actual
 * config module rather than regex-scanning the whole file as one blob, which would hide a
 * per-block gap behind a global union) and cross-checks every `libs/*\/*\/project.json`'s
 * `scope:*`/`type:*` tags against EACH block independently.
 */

const webSrcDir = resolve(__dirname);
const workspaceRoot = resolve(webSrcDir, '../../..');
const eslintConfigPath = join(workspaceRoot, 'eslint.config.mjs');

interface FlatConfigItem {
  files?: string[];
  rules?: Record<string, unknown>;
}

// Import the real config module (not a regex scan over the source text) so each
// `depConstraints` array is inspected as its own independent block — a regex over the whole
// file's text would merge both blocks' sourceTag entries into one flat set and hide a
// gap that exists in only one of them. Done at module (top-level await) scope, since a
// `describe()` callback body runs synchronously.
const eslintConfigModule = (await import(
  pathToFileURL(eslintConfigPath).href
)) as {
  default: FlatConfigItem[];
};

describe('depConstraints tag-coverage guard', () => {
  interface ProjectTags {
    file: string;
    tags: string[];
  }

  interface DepConstraintBlock {
    label: string;
    sourceTags: Set<string>;
  }

  function extractDepConstraintBlocks(
    config: FlatConfigItem[],
  ): DepConstraintBlock[] {
    const blocks: DepConstraintBlock[] = [];
    for (const item of config) {
      const rule = item.rules?.['@nx/enforce-module-boundaries'];
      if (!Array.isArray(rule)) continue;
      const options = rule[1] as
        | { depConstraints?: Array<{ sourceTag: string }> }
        | undefined;
      if (!Array.isArray(options?.depConstraints)) continue;
      blocks.push({
        label: item.files?.join(', ') ?? '(config block with no files glob)',
        sourceTags: new Set(
          options.depConstraints.map((constraint) => constraint.sourceTag),
        ),
      });
    }
    return blocks;
  }

  function extractProjectTags(projectJson: unknown): string[] {
    if (
      typeof projectJson !== 'object' ||
      projectJson === null ||
      !('tags' in projectJson) ||
      !Array.isArray((projectJson as { tags: unknown }).tags)
    ) {
      return [];
    }
    return (projectJson as { tags: unknown[] }).tags.filter(
      (tag): tag is string =>
        typeof tag === 'string' &&
        (tag.startsWith('scope:') || tag.startsWith('type:')),
    );
  }

  function findMissingTagCoverage(
    projects: ProjectTags[],
    blocks: DepConstraintBlock[],
  ): string[] {
    const offenders: string[] = [];
    for (const project of projects) {
      for (const tag of project.tags) {
        for (const block of blocks) {
          if (!block.sourceTags.has(tag)) {
            offenders.push(
              `${project.file} — tag "${tag}" has no matching sourceTag entry in the ` +
                `depConstraints block for files [${block.label}]. Add ` +
                `{ sourceTag: '${tag}', onlyDependOnLibsWithTags: [...] } to that block's ` +
                `depConstraints array in eslint.config.mjs.`,
            );
          }
        }
      }
    }
    return offenders;
  }

  const depConstraintBlocks = extractDepConstraintBlocks(
    eslintConfigModule.default,
  );

  // Every `libs/<scope>/<name>/project.json` in the workspace, discovered by
  // walking the directory tree (not a hardcoded lib list), matching how the
  // Tailwind/README guards discover libs.
  const libsRoot = join(workspaceRoot, 'libs');
  const projects: ProjectTags[] = [];
  for (const scope of readdirSync(libsRoot)) {
    const scopeDir = join(libsRoot, scope);
    if (!statSync(scopeDir).isDirectory()) continue;
    for (const name of readdirSync(scopeDir)) {
      const projectJsonPath = join(scopeDir, name, 'project.json');
      try {
        const raw = readFileSync(projectJsonPath, 'utf8');
        const parsed: unknown = JSON.parse(raw);
        projects.push({
          file: relative(workspaceRoot, projectJsonPath),
          tags: extractProjectTags(parsed),
        });
      } catch {
        // no project.json for this lib — skip
      }
    }
  }

  it('finds at least one libs/*/*/project.json with scope:*/type:* tags (guards against a silently-empty sweep)', () => {
    const totalTags = projects.reduce((sum, p) => sum + p.tags.length, 0);
    expect(totalTags).toBeGreaterThan(0);
  });

  it('finds at least two independent depConstraints blocks in eslint.config.mjs (guards against a silently-empty block sweep)', () => {
    expect(depConstraintBlocks.length).toBeGreaterThanOrEqual(2);
  });

  it('would flag a tag with no matching sourceTag entry in one block even when another block covers it (positive control against a global-union regression)', () => {
    const offenders = findMissingTagCoverage(
      [
        {
          file: 'libs/example/example/project.json',
          tags: ['scope:does-not-exist'],
        },
      ],
      [
        { label: 'main block', sourceTags: new Set(['scope:shared']) },
        {
          label: 'spec-override block',
          sourceTags: new Set(['scope:shared', 'scope:does-not-exist']),
        },
      ],
    );

    expect(offenders).toEqual([
      expect.stringContaining(
        'libs/example/example/project.json — tag "scope:does-not-exist" has no matching sourceTag entry in the depConstraints block for files [main block]',
      ),
    ]);
  });

  it('every scope:*/type:* tag on every libs/*/*/project.json has a matching sourceTag entry in EVERY depConstraints block in eslint.config.mjs', () => {
    const offenders = findMissingTagCoverage(projects, depConstraintBlocks);

    expect(offenders).toEqual([]);
  });
});
