const yaml = require('js-yaml');
const fs = require('fs');

try {
  const doc = yaml.load(fs.readFileSync('.github/workflows/pr-management.yml', 'utf8'));
  console.log('✅ Workflow YAML is valid');
  console.log('Workflow name:', doc.name);
  console.log('Triggers:', Object.keys(doc.on));
  console.log('Jobs:', Object.keys(doc.jobs));
} catch (e) {
  console.error('❌ Workflow YAML is invalid:', e.message);
  process.exit(1);
}
