#!/usr/bin/env node

/**
 * PR Management Agent
 * 
 * This script reviews open Pull Requests from automation agents (like Dependabot)
 * and determines if they have been rendered obsolete by recent major merges
 * (e.g., framework upgrades).
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuration
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = process.env.GITHUB_REPOSITORY?.split('/')[0] || 'vaReliy';
const REPO_NAME = process.env.GITHUB_REPOSITORY?.split('/')[1] || 'penny';
const BOT_AUTHORS = ['dependabot[bot]', 'github-actions[bot]', 'app/dependabot', 'app/github-actions'];

// Helper function to make GitHub API requests
function githubRequest(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: path,
      method: method,
      headers: {
        'User-Agent': 'PR-Management-Agent',
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `token ${GITHUB_TOKEN}`
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            resolve(body);
          }
        } else {
          reject(new Error(`GitHub API error: ${res.statusCode} ${body}`));
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// Parse package.json to get current versions
function getCurrentPackageVersions() {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  return {
    dependencies: packageJson.dependencies || {},
    devDependencies: packageJson.devDependencies || {}
  };
}

// Parse version strings for comparison
function parseVersion(version) {
  // Remove ^ ~ >= etc prefixes
  const cleanVersion = version.replace(/^[\^~>=<]+/, '');
  const parts = cleanVersion.split('.').map(Number);
  return {
    major: parts[0] || 0,
    minor: parts[1] || 0,
    patch: parts[2] || 0,
    original: version
  };
}

// Compare two versions (returns -1 if v1 < v2, 0 if equal, 1 if v1 > v2)
function compareVersions(v1, v2) {
  const ver1 = parseVersion(v1);
  const ver2 = parseVersion(v2);
  
  if (ver1.major !== ver2.major) return ver1.major - ver2.major;
  if (ver1.minor !== ver2.minor) return ver1.minor - ver2.minor;
  return ver1.patch - ver2.patch;
}

// Get PR files to analyze package.json changes
async function getPRFiles(prNumber) {
  const files = await githubRequest(`/repos/${REPO_OWNER}/${REPO_NAME}/pulls/${prNumber}/files`);
  return files;
}

// Extract package versions from PR patch
function extractPackageVersionsFromPatch(patch) {
  const versions = {};
  const lines = patch.split('\n');
  
  for (const line of lines) {
    // Look for lines that add package versions (starting with +)
    if (line.startsWith('+') && !line.startsWith('+++')) {
      const match = line.match(/["'](@?[\w\-/@]+)["']:\s*["']([\^~>=<]*[\d.]+)["']/);
      if (match) {
        const [, packageName, version] = match;
        versions[packageName] = version;
      }
    }
  }
  
  return versions;
}

// Analyze if PR is obsolete
async function analyzePR(pr) {
  console.log(`\nAnalyzing PR #${pr.number}: ${pr.title}`);
  console.log(`Author: ${pr.user.login}`);
  console.log(`Created: ${pr.created_at}`);
  
  // Check if PR is from a bot
  if (!BOT_AUTHORS.includes(pr.user.login)) {
    console.log('⏭️  Skipping: Not from a bot account');
    return { obsolete: false, reason: 'Not from bot' };
  }
  
  // Get PR files
  const files = await getPRFiles(pr.number);
  const packageJsonFile = files.find(f => f.filename === 'package.json');
  
  if (!packageJsonFile || !packageJsonFile.patch) {
    console.log('⏭️  Skipping: No package.json changes');
    return { obsolete: false, reason: 'No package.json changes' };
  }
  
  // Extract versions from PR
  const prVersions = extractPackageVersionsFromPatch(packageJsonFile.patch);
  console.log('PR proposes versions:', prVersions);
  
  // Get current versions
  const currentVersions = getCurrentPackageVersions();
  const allCurrentVersions = { ...currentVersions.dependencies, ...currentVersions.devDependencies };
  
  // Compare versions
  const obsoletePackages = [];
  const validPackages = [];
  
  for (const [packageName, prVersion] of Object.entries(prVersions)) {
    const currentVersion = allCurrentVersions[packageName];
    
    if (!currentVersion) {
      console.log(`  ℹ️  ${packageName}: Not in current package.json (may have been removed)`);
      obsoletePackages.push({ packageName, prVersion, currentVersion: 'removed', reason: 'Package removed' });
      continue;
    }
    
    const comparison = compareVersions(prVersion, currentVersion);
    
    if (comparison < 0) {
      console.log(`  ❌ ${packageName}: PR version ${prVersion} < current ${currentVersion}`);
      obsoletePackages.push({ packageName, prVersion, currentVersion, reason: 'Lower version' });
    } else if (comparison === 0) {
      console.log(`  ℹ️  ${packageName}: PR version ${prVersion} = current ${currentVersion}`);
      // Note: Equal versions are considered obsolete as the base branch already has this version
      obsoletePackages.push({ packageName, prVersion, currentVersion, reason: 'Same version' });
    } else {
      console.log(`  ✅ ${packageName}: PR version ${prVersion} > current ${currentVersion}`);
      validPackages.push({ packageName, prVersion, currentVersion });
    }
  }
  
  // Determine if PR is obsolete
  const isObsolete = obsoletePackages.length > 0 && validPackages.length === 0;
  
  return {
    obsolete: isObsolete,
    obsoletePackages,
    validPackages,
    prVersions,
    reason: isObsolete ? 'All packages obsolete or equal' : 'Has valid upgrades'
  };
}

// Post comment on PR
async function commentOnPR(prNumber, body) {
  console.log(`Posting comment on PR #${prNumber}`);
  await githubRequest(
    `/repos/${REPO_OWNER}/${REPO_NAME}/issues/${prNumber}/comments`,
    'POST',
    { body }
  );
}

// Close PR
async function closePR(prNumber) {
  console.log(`Closing PR #${prNumber}`);
  await githubRequest(
    `/repos/${REPO_OWNER}/${REPO_NAME}/pulls/${prNumber}`,
    'PATCH',
    { state: 'closed' }
  );
}

// Find the recent major upgrade PR
async function findRecentUpgradePR() {
  // Get recent merged PRs
  const closedPRs = await githubRequest(`/repos/${REPO_OWNER}/${REPO_NAME}/pulls?state=closed&per_page=50`);
  
  // Look for Angular upgrade PR
  const upgradePR = closedPRs.find(pr => 
    pr.merged_at && 
    pr.title.toLowerCase().includes('angular') && 
    pr.title.toLowerCase().includes('upgrade')
  );
  
  return upgradePR;
}

// Generate comment message for obsolete PR
function generateObsoleteComment(pr, analysis, upgradePR) {
  let comment = '🤖 **PR Management Agent - Automated Review**\n\n';
  comment += `Closing this PR as it has been superseded by recent dependency updates.\n\n`;
  
  if (upgradePR) {
    comment += `The recent merge of [#${upgradePR.number} - ${upgradePR.title}](${upgradePR.html_url}) `;
    comment += `has already updated these dependencies to newer versions.\n\n`;
  }
  
  comment += '### Version Comparison\n\n';
  comment += '| Package | PR Version | Current Version | Status |\n';
  comment += '|---------|------------|-----------------|--------|\n';
  
  for (const pkg of analysis.obsoletePackages) {
    const status = pkg.reason === 'Lower version' ? '⬇️ Older' : 
                   pkg.reason === 'Same version' ? '➡️ Same' : 
                   '🗑️ Removed';
    comment += `| ${pkg.packageName} | ${pkg.prVersion} | ${pkg.currentVersion} | ${status} |\n`;
  }
  
  comment += '\n---\n';
  comment += '*This PR was automatically reviewed and closed by the PR Management Agent.*\n';
  comment += '*The current versions in the base branch are now at or beyond what this PR proposed.*';
  
  return comment;
}

// Main execution
async function main() {
  // Validate GITHUB_TOKEN
  if (!GITHUB_TOKEN) {
    console.error('❌ Error: GITHUB_TOKEN environment variable is not set');
    console.error('Please set GITHUB_TOKEN with a valid GitHub Personal Access Token');
    process.exit(1);
  }
  
  console.log('🤖 PR Management Agent Starting...');
  console.log(`Repository: ${REPO_OWNER}/${REPO_NAME}`);
  
  // Get all open PRs
  const openPRs = await githubRequest(`/repos/${REPO_OWNER}/${REPO_NAME}/pulls?state=open&per_page=100`);
  console.log(`\nFound ${openPRs.length} open PRs`);
  
  // Find recent upgrade PR for reference
  const upgradePR = await findRecentUpgradePR();
  if (upgradePR) {
    console.log(`\nFound recent upgrade: PR #${upgradePR.number} - ${upgradePR.title}`);
    console.log(`Merged at: ${upgradePR.merged_at}`);
  }
  
  // Analyze each PR
  const obsoletePRs = [];
  
  for (const pr of openPRs) {
    try {
      const analysis = await analyzePR(pr);
      
      if (analysis.obsolete) {
        console.log(`\n❌ PR #${pr.number} is OBSOLETE`);
        obsoletePRs.push({ pr, analysis });
      } else {
        console.log(`\n✅ PR #${pr.number} is still valid or skipped`);
      }
    } catch (error) {
      console.error(`Error analyzing PR #${pr.number}:`, error.message);
    }
  }
  
  console.log(`\n\n📊 Summary:`);
  console.log(`Total open PRs: ${openPRs.length}`);
  console.log(`Obsolete PRs found: ${obsoletePRs.length}`);
  
  // Process obsolete PRs
  if (obsoletePRs.length > 0) {
    console.log('\n🔧 Processing obsolete PRs...\n');
    
    for (const { pr, analysis } of obsoletePRs) {
      try {
        const comment = generateObsoleteComment(pr, analysis, upgradePR);
        await commentOnPR(pr.number, comment);
        await closePR(pr.number);
        console.log(`✅ Successfully processed PR #${pr.number}`);
      } catch (error) {
        console.error(`❌ Error processing PR #${pr.number}:`, error.message);
        if (error.message.includes('GitHub API error')) {
          console.error('   Full error details:', error.message);
        }
      }
    }
  }
  
  console.log('\n✨ PR Management Agent Completed');
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { analyzePR, compareVersions, parseVersion };
