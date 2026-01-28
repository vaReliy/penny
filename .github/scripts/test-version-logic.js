#!/usr/bin/env node

/**
 * Test script for PR Management Agent
 * Tests version comparison logic without making API calls
 */

const { parseVersion, compareVersions } = require('./manage-prs.js');

console.log('Testing version parsing and comparison...\n');

// Test cases
const tests = [
  { v1: '^21.0.1', v2: '^21.1.1', expected: -1, description: '21.0.1 < 21.1.1' },
  { v1: '^21.1.1', v2: '^21.0.1', expected: 1, description: '21.1.1 > 21.0.1' },
  { v1: '^21.1.1', v2: '^21.1.1', expected: 0, description: '21.1.1 = 21.1.1' },
  { v1: '^16.2.2', v2: '^21.1.1', expected: -1, description: '16.2.2 < 21.1.1' },
  { v1: '~5.2.3', v2: '^5.2.3', expected: 0, description: 'Same version with different prefixes' },
  { v1: '^19.0.1', v2: '^20.0.0', expected: -1, description: '19.0.1 < 20.0.0' },
];

let passed = 0;
let failed = 0;

for (const test of tests) {
  const result = compareVersions(test.v1, test.v2);
  const resultStr = result < 0 ? '<' : result > 0 ? '>' : '=';
  const expectedStr = test.expected < 0 ? '<' : test.expected > 0 ? '>' : '=';
  const status = (Math.sign(result) === Math.sign(test.expected)) ? '✅ PASS' : '❌ FAIL';
  
  console.log(`${status}: ${test.description}`);
  console.log(`  ${test.v1} ${resultStr} ${test.v2} (expected: ${expectedStr})`);
  
  if (Math.sign(result) === Math.sign(test.expected)) {
    passed++;
  } else {
    failed++;
  }
}

console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}
