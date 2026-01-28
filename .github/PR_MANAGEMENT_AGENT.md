# PR Management Agent

## Overview

The PR Management Agent is an automated system that reviews open Pull Requests from automation tools (like Dependabot and GitHub Actions) and determines if they have been rendered obsolete by recent major merges, such as framework upgrades.

## Purpose

After a major upgrade (e.g., Angular version bump from v16 to v21), individual dependency PRs often become redundant or incompatible. This agent automatically:

1. **Scans** all open PRs from bot accounts (`dependabot[bot]`, `github-actions[bot]`)
2. **Compares** package versions in the PR against the current `package.json` in the base branch
3. **Identifies** obsolete PRs where the proposed version is lower than or equal to the current version
4. **Comments** on obsolete PRs with a detailed explanation
5. **Closes** obsolete PRs automatically

## Components

### 1. GitHub Actions Workflow (`.github/workflows/pr-management.yml`)

The workflow runs:
- **Daily** at 00:00 UTC (scheduled via cron)
- **On-demand** via manual workflow dispatch
- **On PR events** (opened, reopened, synchronize) for bot-authored PRs

### 2. Management Script (`.github/scripts/manage-prs.js`)

A Node.js script that implements the core logic:

- **Version Parsing**: Extracts and normalizes semantic versions from package.json
- **Version Comparison**: Compares versions to determine if upgrades are needed
- **PR Analysis**: Examines PR diffs to extract proposed package versions
- **GitHub API Integration**: Fetches PRs, posts comments, and closes obsolete PRs
- **Smart Detection**: Identifies packages that have been upgraded or removed

### 3. Test Suite (`.github/scripts/test-version-logic.js`)

Unit tests for version comparison logic to ensure accuracy.

## How It Works

### Step-by-Step Process

1. **Fetch Open PRs**: Retrieves all open pull requests from the repository
2. **Filter Bot PRs**: Only processes PRs from known automation accounts
3. **Analyze package.json Changes**: Examines the diff to extract proposed versions
4. **Compare Versions**: Compares each proposed version against current package.json
5. **Determine Obsolescence**: 
   - PR is obsolete if ALL proposed versions are ≤ current versions
   - PR is valid if ANY proposed version is > current version
6. **Take Action**:
   - **Obsolete PRs**: Post detailed comment and close
   - **Valid PRs**: Leave open (may trigger rebase if conflicts exist)

### Version Comparison Logic

The script handles various version formats:
- `^21.0.1` (caret notation)
- `~5.2.3` (tilde notation)
- `>=1.0.0` (range notation)
- `1.2.3` (exact version)

Comparison is done semantically: `major.minor.patch`

### Comment Format

When closing an obsolete PR, the agent posts a structured comment:

```markdown
🤖 **PR Management Agent - Automated Review**

Closing this PR as it has been superseded by recent dependency updates.

The recent merge of [#81 - Upgrade Angular from v16.2.2 to v21.1.1](link) 
has already updated these dependencies to newer versions.

### Version Comparison

| Package | PR Version | Current Version | Status |
|---------|------------|-----------------|--------|
| @angular/common | ^21.0.1 | ^21.1.1 | ⬇️ Older |
| @angular/cdk | ^21.0.1 | ^21.1.1 | ⬇️ Older |

---
*This PR was automatically reviewed and closed by the PR Management Agent.*
*The current versions in the base branch are now at or beyond what this PR proposed.*
```

## Safety Features

1. **Human PR Protection**: Never closes PRs from human contributors
2. **Conservative Logic**: Only closes when ALL packages are obsolete or equal
3. **Detailed Logging**: Comprehensive console output for debugging
4. **Error Handling**: Graceful failure handling with error messages
5. **Manual Override**: Workflow can be triggered manually via GitHub UI

## Configuration

### Environment Variables

- `GITHUB_TOKEN`: Automatically provided by GitHub Actions (required)
- `GITHUB_REPOSITORY`: Automatically set by GitHub Actions

### Bot Accounts

The agent monitors these accounts:
- `dependabot[bot]`
- `github-actions[bot]`
- `app/dependabot`
- `app/github-actions`

To add more bot accounts, edit the `BOT_AUTHORS` array in `manage-prs.js`.

## Usage

### Automatic Operation

The workflow runs automatically on schedule and PR events. No manual intervention is needed.

### Manual Trigger

To run the agent manually:

1. Go to the **Actions** tab in GitHub
2. Select **PR Management Agent** workflow
3. Click **Run workflow**
4. Select the branch (usually `master`)
5. Click **Run workflow** button

### Local Testing

To test the version comparison logic locally:

```bash
cd .github/scripts
node test-version-logic.js
```

To test the full script (requires GITHUB_TOKEN):

```bash
export GITHUB_TOKEN="your_token_here"
node manage-prs.js
```

## Example Scenario

### Scenario: Angular Upgrade

1. **Initial State**: Repository has Angular 16.2.2
2. **Dependabot PR #70**: Proposes upgrading to Angular 21.0.1
3. **Major Upgrade PR #81**: Merges Angular 21.1.1 upgrade
4. **Agent Runs**: 
   - Detects PR #70 proposes 21.0.1
   - Current version is 21.1.1
   - Determines PR #70 is obsolete (21.0.1 < 21.1.1)
   - Posts comment explaining obsolescence
   - Closes PR #70

## Monitoring

### Check Workflow Runs

View workflow execution history:
1. Go to **Actions** tab
2. Select **PR Management Agent**
3. View recent runs and their logs

### Logs

The script provides detailed console output:
- PR analysis results
- Version comparisons
- Actions taken
- Error messages

## Maintenance

### Updating Bot Account List

Edit `.github/scripts/manage-prs.js`:

```javascript
const BOT_AUTHORS = [
  'dependabot[bot]',
  'github-actions[bot]',
  'app/dependabot',
  'app/github-actions',
  'your-new-bot[bot]'  // Add new bot here
];
```

### Adjusting Schedule

Edit `.github/workflows/pr-management.yml`:

```yaml
schedule:
  - cron: '0 0 * * *'  # Change to your preferred schedule
```

## Permissions Required

The workflow requires these permissions:
- `contents: read` - To read repository files
- `pull-requests: write` - To comment on and close PRs
- `issues: write` - To comment on PRs (PRs are issues in GitHub API)

## Limitations

1. **Package.json Only**: Only analyzes changes to `package.json` (not other dependency files)
2. **Semantic Versioning**: Assumes packages follow semantic versioning
3. **Bot Detection**: Only processes PRs from configured bot accounts
4. **No Rebase**: Does not automatically rebase PRs with merge conflicts
5. **Manual Review**: Complex upgrades may still require human review

## Future Enhancements

Potential improvements:
- Support for other dependency files (Gemfile, requirements.txt, etc.)
- Automatic rebase for valid PRs with conflicts
- Integration with npm audit for security checks
- Slack/email notifications
- Custom rules per package
- Support for monorepos with multiple package.json files

## Troubleshooting

### Script Fails with "GitHub API error"

**Issue**: GITHUB_TOKEN is missing or invalid

**Solution**: Ensure the workflow has proper permissions in repository settings

### PRs Not Being Closed

**Issue**: Version comparison logic may not match expectations

**Solution**: 
1. Check workflow logs for detailed analysis
2. Run test script locally: `node test-version-logic.js`
3. Verify package.json has the expected versions

### Workflow Not Triggering

**Issue**: Workflow conditions not met

**Solution**: 
1. Check if PR is from a bot account
2. Verify workflow file is in `.github/workflows/`
3. Ensure workflow is enabled in repository settings

## Contributing

To contribute improvements:

1. Update the logic in `.github/scripts/manage-prs.js`
2. Add tests to `.github/scripts/test-version-logic.js`
3. Test locally before deploying
4. Update this README with any changes

## License

This solution is part of the Penny project and follows the same license.
