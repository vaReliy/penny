#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

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

  // Split header: find Task column
  const headerCells = headerRow
    .split('|')
    .map((c) => c.trim())
    .filter((c) => c);
  const taskColIndex = headerCells.findIndex((c) => c.toLowerCase() === 'task');
  if (taskColIndex === -1) return false;

  // Find which cell in the data row contains charIndex
  const currentRow = lines[lineNum - 1];
  let cellIndex = 0;
  let cellStart = 0;
  for (const cell of currentRow.split('|')) {
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

  lines.forEach((line, lineIdx) => {
    const lineNum = lineIdx + 1;

    // Check each pattern
    for (const [patternKey, patternInfo] of Object.entries(PATTERNS)) {
      let match;
      const regex = new RegExp(patternInfo.regex, 'g');

      // eslint-disable-next-line no-cond-assign
      while ((match = regex.exec(line)) !== null) {
        const charIndex = match.index;

        // Skip METRICS.md Task column
        if (
          filePath === 'docs/METRICS.md' &&
          isInMetricsTaskColumn(content, lineNum, charIndex)
        ) {
          continue;
        }

        // Skip false positives in code files (not comments/strings)
        if (!filePath.endsWith('.md')) {
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

          // Check if in comment or string
          if (!isInCodeOrString(line, charIndex, filePath)) {
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
          (f.match(/^(apps|libs|tools|docs|rules\/local)\//) ||
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
            (f.match(/^(apps|libs|tools|docs|rules\/local)\//) ||
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
  for (const allowedPattern of Object.keys(ALLOWLIST)) {
    if (allowedPattern === filePath) {
      return true;
    }
    // Simple glob support for patterns like tasks/**
    if (allowedPattern.includes('**')) {
      const prefix = allowedPattern.replace('/**', '');
      if (filePath.startsWith(prefix + '/')) {
        return true;
      }
    }
  }
  return false;
}

// Self-test mode
function runSelfTest() {
  const testCases = [
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
  ];

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    const violations = checkFile(testCase.file || 'test.ts', testCase.content);
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
let explicitFiles = [];

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

  if (!existsSync(filePath) && !revRef) {
    continue;
  }

  let content;
  try {
    if (revRef) {
      content = execSync(`git show ${revRef}:${filePath}`, {
        encoding: 'utf8',
      });
    } else {
      content = readFileSync(filePath, 'utf8');
    }
  } catch {
    continue;
  }

  const violations = checkFile(filePath, content, !!revRef);

  if (violations.length === 0) continue;

  hasViolations = true;
  for (const violation of violations) {
    console.error(
      `${filePath}:${violation.lineNum}: ${violation.pattern}: ${violation.match}`,
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
