#!/usr/bin/env node
/**
 * Pre-push version check script
 * Checks if version has been bumped since last tag or commit
 * Usage: node scripts/check-version.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const PLUGIN_JSON = path.join(__dirname, '..', '.claude-plugin', 'plugin.json');

function readJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error(`Error reading ${filePath}: ${e.message}`);
    process.exit(1);
  }
}

function askQuestion(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim().toLowerCase());
    });
  });
}

async function main() {
  const pluginData = readJSON(PLUGIN_JSON);
  const currentVersion = pluginData.version;

  // Check if version file has uncommitted changes (staged or unstaged)
  let versionHasUncommittedChanges = false;
  try {
    execSync('git diff --cached --quiet -- ' + PLUGIN_JSON, { stdio: 'pipe' });
    execSync('git diff --quiet -- ' + PLUGIN_JSON, { stdio: 'pipe' });
  } catch {
    versionHasUncommittedChanges = true;
  }

  // If version has uncommitted changes, it means we're about to commit the version bump
  if (versionHasUncommittedChanges) {
    console.log(`\n✅ Version check passed (v${currentVersion} - will be committed)\n`);
    process.exit(0);
  }

  // Check if there's a tag matching current version
  let hasTag = false;
  try {
    const tags = execSync('git tag -l "v' + currentVersion + '"', { encoding: 'utf8', stdio: 'pipe' });
    hasTag = tags.trim() === 'v' + currentVersion;
  } catch {
    // No tags or git error
  }

  // Check if version was changed in commits being pushed (since origin/main)
  let versionInPendingCommits = false;
  try {
    const base = execSync('git merge-base origin/main HEAD', { encoding: 'utf8', stdio: 'pipe' }).trim();
    const pendingChanges = execSync(`git diff --name-only ${base}..HEAD`, { encoding: 'utf8', stdio: 'pipe' });
    versionInPendingCommits = pendingChanges.includes('.claude-plugin/plugin.json');
  } catch {
    // Fallback: check only HEAD commit
    try {
      const headChanges = execSync('git diff-tree --no-commit-id --name-only -r HEAD', { encoding: 'utf8', stdio: 'pipe' });
      versionInPendingCommits = headChanges.includes('.claude-plugin/plugin.json');
    } catch {}
  }

  // If version is in current commit and has a tag, we're good
  if (versionInPendingCommits && hasTag) {
    console.log(`\n✅ Version check passed (v${currentVersion})\n`);
    process.exit(0);
  }

  // Otherwise, show warning
  console.log('\n⚠️  Version Check Warning\n');
  console.log(`Current version: ${currentVersion}`);

  if (!versionInPendingCommits) {
    console.log('\n❌ Version file has not been modified. Please bump the version.');
  }

  if (versionInPendingCommits && !hasTag) {
    console.log('\n⚠️  No git tag found for version v' + currentVersion);
    console.log('   Consider creating a tag: git tag v' + currentVersion);
  }

  console.log('\nOptions:');
  console.log('  1) Run version bump script now');
  console.log('  2) Continue without bumping (not recommended)');
  console.log('  3) Cancel push\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const answer = await askQuestion(rl, 'Enter choice (1-3): ');
  rl.close();

  switch (answer) {
    case '1':
      console.log('\n🚀 Running version bump script...\n');
      const { spawn } = require('child_process');
      const bumpScript = spawn('node', [path.join(__dirname, 'bump-version.js')], {
        stdio: 'inherit'
      });
      bumpScript.on('close', (code) => {
        process.exit(code);
      });
      return;

    case '2':
      console.log('\n⚠️  Continuing without version bump...\n');
      process.exit(0);

    case '3':
    default:
      console.log('\n❌ Push cancelled. Run the version bump script manually:\n');
      console.log('  node plugins/token-reporter/scripts/bump-version.js\n');
      process.exit(1);
  }
}

main().catch(e => {
  console.error(`Error: ${e.message}`);
  process.exit(1);
});
