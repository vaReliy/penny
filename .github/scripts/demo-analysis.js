#!/usr/bin/env node

/**
 * Demo script to show how the PR Management Agent would analyze PR #70
 * This simulates the analysis without making actual API calls
 */

const fs = require('fs');
const path = require('path');

console.log('🤖 PR Management Agent - DEMO MODE\n');
console.log('='.repeat(60));
console.log('This demo shows how the agent would analyze PR #70\n');

// Load current package.json
const currentPackageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));

console.log('📦 Current package.json versions (base branch):');
console.log('---');
const angularPackages = [
  '@angular/animations',
  '@angular/cdk',
  '@angular/common',
  '@angular/forms',
  '@angular/platform-browser',
  '@angular/platform-browser-dynamic',
  '@angular/router',
  '@ng-bootstrap/ng-bootstrap'
];

for (const pkg of angularPackages) {
  const currentVersion = currentPackageJson.dependencies[pkg] || currentPackageJson.devDependencies[pkg];
  console.log(`  ${pkg}: ${currentVersion}`);
}

console.log('\n📝 PR #70 proposes (from Dependabot):');
console.log('---');
// These are the versions from PR #70 (from the patch we extracted earlier)
const pr70Versions = {
  '@angular/cdk': '^21.0.1',
  '@angular/common': '^21.0.1',
  '@angular/forms': '^21.0.1',
  '@angular/platform-browser': '^21.0.1',
  '@angular/platform-browser-dynamic': '^21.0.1',
  '@angular/router': '^21.0.1',
  '@ng-bootstrap/ng-bootstrap': '^19.0.1'
};

for (const [pkg, version] of Object.entries(pr70Versions)) {
  console.log(`  ${pkg}: ${version}`);
}

console.log('\n🔍 Version Comparison Analysis:');
console.log('---');

function parseVersion(version) {
  const cleanVersion = version.replace(/^[\^~>=<]+/, '');
  const parts = cleanVersion.split('.').map(Number);
  return {
    major: parts[0] || 0,
    minor: parts[1] || 0,
    patch: parts[2] || 0
  };
}

function compareVersions(v1, v2) {
  const ver1 = parseVersion(v1);
  const ver2 = parseVersion(v2);
  
  if (ver1.major !== ver2.major) return ver1.major - ver2.major;
  if (ver1.minor !== ver2.minor) return ver1.minor - ver2.minor;
  return ver1.patch - ver2.patch;
}

let obsoleteCount = 0;
let validCount = 0;

for (const [pkg, prVersion] of Object.entries(pr70Versions)) {
  const currentVersion = currentPackageJson.dependencies[pkg] || currentPackageJson.devDependencies[pkg];
  const comparison = compareVersions(prVersion, currentVersion);
  
  let status, symbol;
  if (comparison < 0) {
    status = 'OBSOLETE (PR < Current)';
    symbol = '❌';
    obsoleteCount++;
  } else if (comparison === 0) {
    status = 'EQUAL (PR = Current)';
    symbol = '⚠️';
    obsoleteCount++;
  } else {
    status = 'VALID (PR > Current)';
    symbol = '✅';
    validCount++;
  }
  
  console.log(`  ${symbol} ${pkg}`);
  console.log(`     PR: ${prVersion} vs Current: ${currentVersion}`);
  console.log(`     ${status}\n`);
}

console.log('='.repeat(60));
console.log('📊 ANALYSIS RESULT:');
console.log('---');
console.log(`  Total packages in PR: ${Object.keys(pr70Versions).length}`);
console.log(`  Obsolete/Equal packages: ${obsoleteCount}`);
console.log(`  Valid upgrades: ${validCount}`);
console.log();

if (obsoleteCount > 0 && validCount === 0) {
  console.log('🔴 DECISION: PR #70 should be CLOSED as OBSOLETE');
  console.log();
  console.log('Reason: All proposed versions are lower than or equal to current versions.');
  console.log('This happened because PR #81 (Angular 21.1.1 upgrade) was merged,');
  console.log('which includes newer versions than what PR #70 proposes (21.0.1).');
  console.log();
  console.log('The agent would:');
  console.log('  1. Post a detailed comment explaining the obsolescence');
  console.log('  2. Reference PR #81 as the superseding change');
  console.log('  3. Close PR #70 automatically');
} else {
  console.log('🟢 DECISION: PR #70 is still VALID and should remain open');
  console.log();
  console.log('Reason: The PR contains at least one package upgrade that is');
  console.log('still needed (proposed version > current version).');
}

console.log();
console.log('='.repeat(60));
console.log();
console.log('💡 This is a demonstration. To run the actual agent with API access:');
console.log('   export GITHUB_TOKEN="your_token"');
console.log('   node .github/scripts/manage-prs.js');
console.log();
