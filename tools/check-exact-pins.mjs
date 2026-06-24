#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import path from 'node:path';

const DEP_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
];
const RANGE_PREFIX = /^[\^~]/;

function findPackageJsonFiles() {
  const patterns = [
    'package.json',
    'apps/*/package.json',
    'libs/*/package.json',
  ];
  const files = new Set();
  for (const pattern of patterns) {
    for (const file of globSync(pattern, {
      exclude: (name) => name === 'node_modules',
    })) {
      files.add(file);
    }
  }
  return [...files].sort();
}

function findRangedSpecifiers(pkgPath) {
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  const violations = [];
  for (const field of DEP_FIELDS) {
    const block = pkg[field];
    if (!block) continue;
    for (const [name, specifier] of Object.entries(block)) {
      if (typeof specifier === 'string' && RANGE_PREFIX.test(specifier)) {
        violations.push({ field, name, specifier });
      }
    }
  }
  return violations;
}

const files = findPackageJsonFiles();
let hasViolations = false;

for (const file of files) {
  const violations = findRangedSpecifiers(file);
  if (violations.length === 0) continue;
  hasViolations = true;
  console.error(`${path.relative(process.cwd(), file)}:`);
  for (const { field, name, specifier } of violations) {
    console.error(
      `  ${field}.${name}: "${specifier}" — must be an exact version, no ^ or ~`,
    );
  }
}

if (hasViolations) {
  console.error(
    '\ncheck-exact-pins: found non-exact version ranges (see above).',
  );
  process.exit(1);
}

console.log(
  `check-exact-pins: ${files.length} package.json file(s) OK, all exact.`,
);
