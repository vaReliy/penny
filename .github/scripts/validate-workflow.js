#!/usr/bin/env node

/**
 * Workflow YAML Validation Script
 * 
 * Validates the syntax and structure of the PR Management workflow.
 * 
 * Requirements: npm install js-yaml (dev dependency, not in package.json)
 * Usage: node .github/scripts/validate-workflow.js
 */

const yaml = require('js-yaml');
const fs = require('fs');

const workflowPath = '.github/workflows/pr-management.yml';

try {
  if (!fs.existsSync(workflowPath)) {
    console.error(`❌ Workflow file not found: ${workflowPath}`);
    process.exit(1);
  }
  
  const doc = yaml.load(fs.readFileSync(workflowPath, 'utf8'));
  console.log('✅ Workflow YAML is valid');
  console.log('Workflow name:', doc.name);
  console.log('Triggers:', Object.keys(doc.on));
  console.log('Jobs:', Object.keys(doc.jobs));
} catch (e) {
  console.error('❌ Workflow YAML is invalid:', e.message);
  process.exit(1);
}
