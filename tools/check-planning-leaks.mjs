#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

// Get repo root for path normalization
let REPO_ROOT = null;
function getRepoRoot() {
  if (!REPO_ROOT) {
    REPO_ROOT = execSync('git rev-parse --show-toplevel', {
      encoding: 'utf8',
    }).trim();
  }
  return REPO_ROOT;
}

// Normalize path to repo-relative POSIX form (handles both absolute and relative paths)
function normalizePath(filePath) {
  const resolved = path.resolve(process.cwd(), filePath);
  const repoRoot = getRepoRoot();
  return path.relative(repoRoot, resolved).split(path.sep).join('/');
}

// Pattern classes — tuned for precision
const PATTERNS = {
  task_slug: {
    regex: /\d{4}-\d{2}-\d{2}-\d{2}(-\d{2})?-[a-z]/,
    desc: 'task slug',
  },
  tasks_path: {
    // Only match task-file paths that contain a task slug
    regex: /tasks\/[^\s]*\d{4}-\d{2}-\d{2}-\d{2}(?:-\d{2})?-[a-z][^\s)]*\.md/,
    desc: 'task-file path',
  },
  grill_ref: {
    // Match: grill-notes, or "grill"/"grill-me" with nearby date/decision in same line
    regex:
      /grill-notes|grill(?:\s*[-:([\s]?\s*(?:\d{4}-\d{2}|notes|session|decision|[SGBR]\d))/i,
    desc: 'grill session reference',
  },
  ac_number: {
    regex: /\bAC-\d+\b/,
    desc: 'AC number',
  },
  slice_id: {
    // W[1-9] only (exclude W0, W3C, etc)
    regex: /\bW[1-9]\d?[a-z]?\b/,
    desc: 'slice ID',
  },
  decision_id: {
    regex: /\b[BSGR]\d\b|\bD-[A-Z]\b|\bD\d+\b/,
    desc: 'decision ID',
  },
  per_the_task: {
    regex: /per the task/i,
    desc: '"per the task" phrase',
  },
  task_citation: {
    regex:
      /\btask-\d+(?:\s+(?:spec|schema|DTO|model|interface|type|contract))?\b/,
    desc: 'task-NN citation',
  },
};

// Allowlist: files/sections exempt from checking
// Rule-definition files quote the patterns as examples because they DEFINE the rule,
// or document process/incident tracking that necessarily cites task files:
// - AGENTS.md, AGENTS.local.md: define planning ID rule
// - rules/cts/**: CTS-managed, fixed upstream — all rules teach or document with examples/citations
// - rules/local/task-authoring.md, rules/local/workflow.md: the two rule-definition files
//   that teach the AC/slice/task-ID format itself (naming examples, templates) — other
//   rules/local/*.md files are project-specific conventions, not rule-format teaching, and
//   are NOT exempt
//
// Implementation: tools/check-planning-leaks.mjs: contains test cases and pattern examples
const ALLOWLIST = {
  // System and rule-definition files that quote patterns or cite tasks in examples
  'AGENTS.md': true,
  'AGENTS.local.md': true,
  'rules/cts/**': true,
  'rules/local/task-authoring.md': true,
  'rules/local/workflow.md': true,

  // The leak-check tool itself (contains test cases and pattern examples)
  'tools/check-planning-leaks.mjs': true,

  // Gitignored task directory (not in git tree anyway)
  'tasks/**': true,

  // Lock file contains decision/AC references in vendor comments
  'pnpm-lock.yaml': true,
};

// Binary/non-text files to skip
const BINARY_EXTENSIONS =
  /\.(png|ico|svg|woff|woff2|ttf|eot|jpg|jpeg|gif|webp|pdf|zip|tar|gz|bin|exe|dll|so)$/i;
function isBinaryOrNonText(filePath, content) {
  if (BINARY_EXTENSIONS.test(filePath)) return true;
  // Check for NUL byte in first 8 KB
  const sample = content.slice(0, 8192);
  return sample.includes('\x00');
}

// Split markdown table row by | while respecting backticks
function splitTableCells(row) {
  const cells = [];
  let currentCell = '';
  let inBacktick = false;

  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    if (char === '`') {
      inBacktick = !inBacktick;
      currentCell += char;
    } else if (char === '|' && !inBacktick) {
      cells.push(currentCell);
      currentCell = '';
    } else {
      currentCell += char;
    }
  }
  cells.push(currentCell);
  return cells;
}

// For METRICS.md, exempt only the Task column (AC-5)
function isInMetricsTaskColumn(content, lineNum, charIndex) {
  const lines = content.split('\n');
  if (!lines[lineNum - 1]) return false;

  // Find separator row (GFM table: | ---------- | etc) strictly before current line
  const separatorRegex = /^\s*\|(\s*:?-+:?\s*\|)+\s*$/;
  let separatorLine = -1;
  for (let i = lineNum - 2; i >= 0; i--) {
    if (separatorRegex.test(lines[i])) {
      separatorLine = i;
      break;
    }
  }

  if (separatorLine < 1) return false; // Need header above separator

  // Header is immediately before separator
  const headerRow = lines[separatorLine - 1];
  if (!headerRow.includes('|')) return false;

  // Split header using backtick-aware splitter: find Task column
  const headerCells = splitTableCells(headerRow)
    .map((c) => c.trim())
    .filter((c) => c);
  const taskColIndex = headerCells.findIndex((c) => c.toLowerCase() === 'task');
  if (taskColIndex === -1) return false;

  // Find which cell in the data row contains charIndex
  const currentRow = lines[lineNum - 1];
  const dataCells = splitTableCells(currentRow);
  let cellIndex = 0;
  let cellStart = 0;

  for (const cell of dataCells) {
    const cellEnd = cellStart + cell.length;
    if (charIndex >= cellStart && charIndex < cellEnd) {
      // Adjust for filtered cells (empties removed from leading/trailing pipes)
      const trimmedCell = cell.trim();
      if (trimmedCell) {
        // This cell counts (not an empty from leading/trailing pipes)
        return cellIndex === taskColIndex;
      }
      return false; // Char in a leading/trailing pipe — no exemption
    }
    if (cell.trim()) cellIndex++; // Only count non-empty cells
    cellStart = cellEnd + 1; // +1 for the '|'
  }

  return false;
}

function isInCodeOrString(line, charIndex, filename) {
  // For .md files, apply patterns to prose (not just comments)
  if (filename.endsWith('.md')) {
    return true; // Always check prose in markdown
  }

  // For .html files, treat as prose/comments (no code strings)
  if (filename.endsWith('.html')) {
    return true;
  }

  // For .yml/.yaml files, treat as prose (no code strings)
  if (filename.endsWith('.yml') || filename.endsWith('.yaml')) {
    return true;
  }

  // For code files, check if charIndex is in a comment or string
  // Simple heuristic: look backwards for //, /*, ', ", `
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inBacktick = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < charIndex; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (inLineComment) continue;
    if (inBlockComment) {
      if (char === '*' && nextChar === '/') {
        inBlockComment = false;
      }
      continue;
    }

    if (char === '"' && (i === 0 || line[i - 1] !== '\\')) {
      inDoubleQuote = !inDoubleQuote;
    } else if (char === "'" && (i === 0 || line[i - 1] !== '\\')) {
      inSingleQuote = !inSingleQuote;
    } else if (char === '`' && (i === 0 || line[i - 1] !== '\\')) {
      inBacktick = !inBacktick;
    } else if (!inSingleQuote && !inDoubleQuote && !inBacktick) {
      if (char === '/' && nextChar === '/') {
        inLineComment = true;
      } else if (char === '/' && nextChar === '*') {
        inBlockComment = true;
      }
    }
  }

  return (
    inLineComment ||
    inBlockComment ||
    inSingleQuote ||
    inDoubleQuote ||
    inBacktick
  );
}

function checkFile(filePath, content, revMode = false) {
  const violations = [];

  // Skip binary/non-text files
  if (isBinaryOrNonText(filePath, content)) {
    return violations;
  }

  const lines = content.split('\n');
  let inBlockComment = false; // Track multi-line JS/TS /* */ across all lines
  let inHtmlComment = false; // Track multi-line HTML <!-- --> across all lines
  let lineWasInBlockComment = false; // Flag if current line started in a block comment
  let lineWasInHtmlComment = false; // Flag if current line started in an HTML comment

  lines.forEach((line, lineIdx) => {
    const lineNum = lineIdx + 1;
    let processedLine = line;
    lineWasInBlockComment = false;
    lineWasInHtmlComment = false;

    // Track multi-line JS/TS block comments (but still scan content within them)
    if (
      filePath.endsWith('.ts') ||
      filePath.endsWith('.js') ||
      filePath.endsWith('.mts') ||
      filePath.endsWith('.mjs')
    ) {
      if (inBlockComment) {
        lineWasInBlockComment = true;
      }
      // Process all comment markers on this line
      let idx = 0;
      while (idx < line.length) {
        if (inBlockComment) {
          // Look for closing */
          const endIdx = line.indexOf('*/', idx);
          if (endIdx !== -1) {
            inBlockComment = false;
            idx = endIdx + 2; // Continue searching after the */
          } else {
            break; // No more */ on this line
          }
        } else {
          // Look for opening /*
          const startIdx = line.indexOf('/*', idx);
          if (startIdx !== -1) {
            inBlockComment = true;
            lineWasInBlockComment = true;
            idx = startIdx + 2; // Continue searching after the /*
          } else {
            break; // No more /* on this line
          }
        }
      }
    }

    // Track multi-line HTML comments (but still scan content within them)
    if (filePath.endsWith('.html')) {
      if (inHtmlComment) {
        lineWasInHtmlComment = true;
      }
      // Process all comment markers on this line
      let idx = 0;
      while (idx < line.length) {
        if (inHtmlComment) {
          // Look for closing -->
          const endIdx = line.indexOf('-->', idx);
          if (endIdx !== -1) {
            inHtmlComment = false;
            idx = endIdx + 3; // Continue searching after the -->
          } else {
            break; // No more --> on this line
          }
        } else {
          // Look for opening <!--
          const startIdx = line.indexOf('<!--', idx);
          if (startIdx !== -1) {
            inHtmlComment = true;
            lineWasInHtmlComment = true;
            idx = startIdx + 4; // Continue searching after the <!--
          } else {
            break; // No more <!-- on this line
          }
        }
      }
    }

    // For YAML, only check comments (lines where # appears at start or after whitespace)
    if (filePath.endsWith('.yml') || filePath.endsWith('.yaml')) {
      const trimmed = line.trimStart();
      const commentIdx = line.indexOf('#');
      if (commentIdx !== -1) {
        const beforeHash = line.substring(0, commentIdx);
        // Only treat as comment if # is at start or after whitespace
        if (beforeHash === '' || /^\s+$/.test(beforeHash)) {
          // This is a comment line, only check the part after #
          processedLine = line.substring(commentIdx);
        } else {
          // # is in a value, skip this line
          processedLine = '';
        }
      } else {
        // No comment marker, skip this line (it's a value line)
        processedLine = '';
      }
    }

    // Check each pattern on the processed line
    for (const [patternKey, patternInfo] of Object.entries(PATTERNS)) {
      let match;
      const regex = new RegExp(patternInfo.regex, 'g');

      while ((match = regex.exec(processedLine)) !== null) {
        // Adjust match index back to original line if we modified processedLine
        let charIndex = match.index;
        if (processedLine !== line) {
          // Recalculate character index in the original line
          charIndex = line.indexOf(match[0], charIndex);
          if (charIndex === -1) continue; // Couldn't find it in original
        }

        // Skip METRICS.md Task column
        if (
          filePath === 'docs/METRICS.md' &&
          isInMetricsTaskColumn(content, lineNum, charIndex)
        ) {
          continue;
        }

        // Skip false positives in code files (not comments/strings)
        if (
          !filePath.endsWith('.md') &&
          !filePath.endsWith('.html') &&
          !filePath.endsWith('.yml') &&
          !filePath.endsWith('.yaml')
        ) {
          // For code files, allow certain patterns
          // grill-me and grill-with-docs are skill names, not references
          if (
            patternKey === 'grill_ref' &&
            (line.includes('grill-me') || line.includes('grill-with-docs'))
          ) {
            continue;
          }

          // W3C, hex strings, integrity attributes should not match
          if (
            patternKey === 'slice_id' &&
            (line.includes('W3C') ||
              line.includes('0x') ||
              line.includes('sha-'))
          ) {
            continue;
          }

          // ADR headings in docs (allowed); only flag in code/comments
          if (
            patternKey === 'decision_id' &&
            line.trim().startsWith('##') &&
            filePath.endsWith('.md')
          ) {
            continue;
          }

          // Check if in comment or string (skip this check if we're in a tracked multi-line comment)
          if (
            !lineWasInBlockComment &&
            !lineWasInHtmlComment &&
            !isInCodeOrString(line, charIndex, filePath)
          ) {
            continue;
          }
        }

        violations.push({
          lineNum,
          pattern: patternInfo.desc,
          match: match[0],
          line: line.trim(),
        });
      }
    }
  });

  return violations;
}

function getFilesToCheck(revRef = null) {
  let files = [];

  if (revRef) {
    // Scan git show <ref>:<path> for all tracked files
    try {
      const gitFiles = execSync(`git ls-tree -r --name-only ${revRef}`, {
        encoding: 'utf8',
      }).split('\n');
      files = gitFiles.filter(
        (f) =>
          f &&
          (f.match(/^(apps|libs|tools|docs|rules\/local|\.github)\//) ||
            /^[^/]+\.md$/.test(f)) &&
          !f.includes('node_modules'),
      );
    } catch {
      console.error(`Error reading git ref ${revRef}`);
      process.exit(1);
    }
  } else {
    // Tracked + untracked (not gitignored) files
    try {
      files = execSync('git ls-files -co --exclude-standard', {
        encoding: 'utf8',
      })
        .split('\n')
        .filter(
          (f) =>
            f &&
            (f.match(/^(apps|libs|tools|docs|rules\/local|\.github)\//) ||
              /^[^/]+\.md$/.test(f)) &&
            !f.includes('node_modules'),
        );
    } catch {
      console.error('Error reading git files');
      process.exit(1);
    }
  }

  return files;
}

function isAllowlisted(filePath) {
  // Normalize to repo-relative path for allowlist matching
  const normalizedPath = normalizePath(filePath);

  for (const allowedPattern of Object.keys(ALLOWLIST)) {
    if (allowedPattern === normalizedPath) {
      return true;
    }
    // Simple glob support for patterns like tasks/**
    if (allowedPattern.includes('**')) {
      const prefix = allowedPattern.replace('/**', '');
      if (normalizedPath.startsWith(prefix + '/')) {
        return true;
      }
    }
  }
  return false;
}

// Self-test mode
function runSelfTest() {
  const testCases = [
    // Finding 1: relative path normalization (new test)
    {
      name: 'Finding 1: relative path ./AGENTS.local.md should not error',
      content: "console.log('test')",
      shouldMatch: false,
      file: './AGENTS.local.md',
      isAbsolutePath: true,
    },
    // Finding 1: absolute path allowlist (new test)
    {
      name: 'Finding 1: absolute path to allowlisted file should not error',
      content: "console.log('test')",
      shouldMatch: false,
      file: '/home/vh/Projects/vg/penny/AGENTS.local.md',
      isAbsolutePath: true,
    },
    // Finding 2: multi-line JSDoc with AC number (new test)
    {
      name: 'Finding 2: AC number in 3-line JSDoc block',
      content: '/**\n * Handle AC-3 case\n */',
      shouldMatch: true,
      file: 'src/index.ts',
    },
    // Finding 3: HTML template text with slice ID (new test)
    {
      name: 'Finding 3: slice ID in HTML text node',
      content: '<p>Component for W2a implementation</p>',
      shouldMatch: true,
      file: 'apps/web/src/app.component.html',
    },
    // Finding 3: HTML comment with decision ID (new test)
    {
      name: 'Finding 3: decision ID in HTML comment',
      content: '<!-- TODO: see S6 for details -->',
      shouldMatch: true,
      file: 'apps/web/src/app.component.html',
    },
    // Finding 4: YAML comment with decision ID (new test)
    {
      name: 'Finding 4: decision ID in YAML comment',
      content: '# TODO: see S6 in issue',
      shouldMatch: true,
      file: '.github/workflows/ci.yml',
    },
    // Finding 4: YAML value should not match (new test)
    {
      name: 'Finding 4: YAML run-on value should not match',
      content: 'runs-on: ubuntu-24.04',
      shouldMatch: false,
      file: '.github/workflows/ci.yml',
    },
    // Finding 6: backticked pipe in markdown table (new test)
    {
      name: 'Finding 6: backticked pipe in markdown table cell',
      content: '| Command | Notes |\n| ---- | ----- |\n| `a|b` | works |',
      shouldMatch: false,
      file: 'docs/METRICS.md',
    },
    // Finding 6 repro: backtick-pipe in Repo cell shifts Task column index
    {
      name: 'Finding 6 repro: backticked pipe shifts column index',
      content:
        '| Repo | Task | Notes |\n| ---- | ---- | ----- |\n| `a|b` | 2026-09-26-01-plan | ok |',
      shouldMatch: false,
      file: 'docs/METRICS.md',
    },
    // Finding 2 repro: consecutive comment open/close on same line
    {
      name: 'Finding 2 repro: consecutive block comments on same line',
      content:
        '/** doc */ code here /* unterminated new block\n AC-3 leaked here\n*/',
      shouldMatch: true,
      file: 'src/index.ts',
    },

    // Positive cases (should match)
    {
      name: 'AC spec title',
      content: "it('AC-3 selecting …')",
      shouldMatch: true,
    },
    {
      name: 'Slice ID W2a',
      content: '// Empty shell until W2a/W2b',
      shouldMatch: true,
    },
    {
      name: 'Slice ID W6b',
      content: 'const shell = true; // until W6b',
      shouldMatch: true,
    },
    {
      name: 'Decision ID S6',
      content: '// Implementation per S6 spec',
      shouldMatch: true,
    },
    {
      name: 'Decision ID D-A',
      content: '// See D-A for details',
      shouldMatch: true,
    },
    {
      name: 'Grill-notes reference',
      content: '// See grill-notes for history',
      shouldMatch: true,
    },
    {
      name: 'Grill with date',
      content: '// grill (2026-09-26)',
      shouldMatch: true,
    },
    {
      name: 'Grill-me with decision',
      content: '// grill-me (S6 context)',
      shouldMatch: true,
    },
    {
      name: 'Task slug',
      content: '// Blocked on 2026-09-26-01-planning-leak-guard',
      shouldMatch: true,
    },
    {
      name: 'Task-file path',
      content: '// See tasks/todo/2026-09-26-01-planning-leak-guard.md',
      shouldMatch: true,
    },
    {
      name: 'Per the task',
      content: '// per the task description',
      shouldMatch: true,
    },
    {
      name: 'Task citation with suffix word',
      content: '// See task-12 spec for the shape',
      shouldMatch: true,
    },
    {
      name: 'Task citation bare (no suffix word)',
      content: '// Implements task-06',
      shouldMatch: true,
    },

    // Negative cases (should NOT match)
    {
      name: 'Bare grill workflow mention',
      content: 'The grill workflow is described in docs/USAGE.md',
      shouldMatch: false,
    },
    {
      name: 'Tasks directory mention',
      content: 'Task files live in tasks/ (gitignored)',
      shouldMatch: false,
    },
    {
      name: 'W0 (not slice)',
      content: 'favicon shows W0 in binary',
      shouldMatch: false,
    },
    {
      name: 'W3C standard',
      content: '// See W3C spec for details',
      shouldMatch: false,
    },
    {
      name: 'SessionGuard class',
      content: 'export class SessionGuard {}',
      shouldMatch: false,
    },
    {
      name: 'Subtask identifier should not false-positive as task citation',
      content: '// See subtask-12 for the child unit',
      shouldMatch: false,
    },
    {
      name: 'Word glued to digits should not false-positive as task citation',
      content: '// Reference to task-12abc in generated fixture',
      shouldMatch: false,
    },
    {
      name: 'ADR heading',
      content: '## ADR-010: Architecture Decision',
      shouldMatch: false,
      file: 'docs/DECISIONS.md',
    },
    {
      name: 'METRICS Task column skip, real separator',
      content:
        '| Date | Task | Notes |\n| ---------- | ---- | ------- |\n| 2026-09-26 | 2026-09-26-01-plan | OK |',
      shouldMatch: false,
      file: 'docs/METRICS.md',
    },
    {
      name: 'METRICS Notes column flag S6',
      content:
        '| Date | Task | Notes |\n| ---------- | ---- | ------- |\n| 2026-09-26 | 2026-09-26-01-plan | S6 here |',
      shouldMatch: true,
      file: 'docs/METRICS.md',
    },
    {
      name: 'METRICS verbatim excerpt (Task skip)',
      content:
        '| Date       | Repo  | Task                                                         |\n| ---------- | ----- | ------------------------------------------------------------ |\n| 2026-09-26 | penny | 2026-09-26-01-planning-leak-guard                           |',
      shouldMatch: false,
      file: 'docs/METRICS.md',
    },
    {
      name: 'METRICS verbatim with S6 in later col',
      content:
        '| Date       | Repo  | Task                                                         | Notes |\n| ---------- | ----- | ------------------------------------------------------------ | ------ |\n| 2026-09-26 | penny | 2026-09-26-01-planning-leak-guard                           | S6 ref |',
      shouldMatch: true,
      file: 'docs/METRICS.md',
    },
    {
      name: 'Binary PNG',
      content: '\x89PNG\r\n\x1a\n',
      shouldMatch: false,
      file: 'icon.png',
    },
    {
      name: 'Hex/integrity string',
      content: 'integrity="sha384-0xDEADBEEF"',
      shouldMatch: false,
    },
    {
      name: 'Inbox date header',
      content: '## 2026-09-26 — planning-leak guard shipped',
      shouldMatch: false,
      file: 'docs/KNOWLEDGE_INBOX.md',
    },
    {
      name: 'METRICS Task column skip, real separator format (space-padded `| --- |`)',
      content:
        '| Task | Notes |\n| ---- | ----- |\n| 2026-09-26-01-task-S6-slug | ok |',
      shouldMatch: false,
      file: 'docs/METRICS.md',
    },
    {
      name: 'METRICS Task column skip, task citation pattern',
      content:
        '| Date | Task | Notes |\n| ---------- | ---- | ------- |\n| 2026-09-26 | task-06 schema | OK |',
      shouldMatch: false,
      file: 'docs/METRICS.md',
    },
    {
      name: 'METRICS Notes column flags task citation pattern',
      content:
        '| Date | Task | Notes |\n| ---------- | ---- | ------- |\n| 2026-09-26 | 2026-09-26-01-plan | see task-06 schema |',
      shouldMatch: true,
      file: 'docs/METRICS.md',
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    const fileName = testCase.file || 'test.ts';

    // For absolute path tests, verify allowlist works with absolute paths
    if (testCase.isAbsolutePath) {
      const isAllowed = isAllowlisted(fileName);
      if (testCase.shouldMatch === !isAllowed) {
        // For absolute path test, shouldMatch means it SHOULD be flagged (should NOT be allowlisted)
        // isAllowlisted returning true means it's allowed (no violation)
        passed++;
        console.log(`✓ ${testCase.name}`);
      } else {
        failed++;
        console.error(
          `✗ ${testCase.name}: expected ${testCase.shouldMatch ? 'to be flagged' : 'to be allowlisted'}, but isAllowlisted=${isAllowed}`,
        );
      }
      continue;
    }

    const violations = checkFile(fileName, testCase.content);
    const hasViolations = violations.length > 0;

    if (testCase.shouldMatch === hasViolations) {
      passed++;
      console.log(`✓ ${testCase.name}`);
    } else {
      failed++;
      console.error(
        `✗ ${testCase.name}: expected ${testCase.shouldMatch ? 'match' : 'no match'}, got ${hasViolations ? 'match' : 'no match'}`,
      );
      if (violations.length > 0) {
        console.error(
          `  Violations: ${violations.map((v) => v.match).join(', ')}`,
        );
      }
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

// Main execution
const args = process.argv.slice(2);
let revRef = null;
let selfTest = false;
const explicitFiles = [];

// Parse arguments
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--rev') {
    revRef = args[i + 1];
    i++;
  } else if (args[i] === '--self-test') {
    selfTest = true;
  } else if (!args[i].startsWith('-')) {
    explicitFiles.push(args[i]);
  }
}

if (selfTest) {
  runSelfTest();
}

const filesToCheck =
  explicitFiles.length > 0 ? explicitFiles : getFilesToCheck(revRef);
let hasViolations = false;

for (const filePath of filesToCheck) {
  if (isAllowlisted(filePath)) {
    continue;
  }

  // Normalize path for file system operations (but keep original for reporting)
  const normalizedPath = normalizePath(filePath);
  const fileSystemPath = revRef ? normalizedPath : filePath;

  if (!existsSync(fileSystemPath) && !revRef) {
    continue;
  }

  let content;
  try {
    if (revRef) {
      content = execSync(`git show ${revRef}:${normalizedPath}`, {
        encoding: 'utf8',
      });
    } else {
      content = readFileSync(fileSystemPath, 'utf8');
    }
  } catch {
    continue;
  }

  const violations = checkFile(normalizedPath, content, !!revRef);

  if (violations.length === 0) continue;

  hasViolations = true;
  for (const violation of violations) {
    console.error(
      `${normalizedPath}:${violation.lineNum}: ${violation.pattern}: ${violation.match}`,
    );
  }
}

if (hasViolations) {
  console.error(
    '\ncheck-planning-leaks: found planning references in committed files.',
  );
  process.exit(1);
}

console.log(
  `check-planning-leaks: ${filesToCheck.length} file(s) OK, no planning references found.`,
);
