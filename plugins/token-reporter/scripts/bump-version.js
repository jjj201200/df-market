#!/usr/bin/env node
/**
 * Version Bump Script for df-market plugins
 * Updates version in plugin.json and marketplace.json
 *
 * Usage:
 *   node scripts/bump-version.js                    # Auto-detect plugin from current directory
 *   node scripts/bump-version.js [major|minor|patch] # Auto-detect with specified bump type
 *   node scripts/bump-version.js <plugin-name>       # Specify plugin name
 *   node scripts/bump-version.js <plugin-name> [major|minor|patch]
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const MARKETPLACE_JSON = path.join(__dirname, '..', '..', '..', '.claude-plugin', 'marketplace.json');

function readJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error(`Error reading ${filePath}: ${e.message}`);
    process.exit(1);
  }
}

function writeJSON(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
  } catch (e) {
    console.error(`Error writing ${filePath}: ${e.message}`);
    process.exit(1);
  }
}

function bumpVersion(version, type) {
  const parts = version.split('.').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    throw new Error(`Invalid version format: ${version}`);
  }

  const [major, minor, patch] = parts;

  switch (type) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    default:
      throw new Error(`Unknown bump type: ${type}`);
  }
}

function askQuestion(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

function getCurrentPluginName() {
  // Try to get plugin name from current directory's plugin.json
  const pluginJsonPath = path.join(__dirname, '..', '.claude-plugin', 'plugin.json');
  try {
    const pluginData = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf8'));
    return pluginData.name;
  } catch {
    return null;
  }
}

function getPluginJsonPath(pluginName) {
  // Find plugin directory by name
  const pluginsDir = path.join(__dirname, '..', '..');
  try {
    const entries = fs.readdirSync(pluginsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const pluginJsonPath = path.join(pluginsDir, entry.name, '.claude-plugin', 'plugin.json');
        try {
          const data = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf8'));
          if (data.name === pluginName) {
            return pluginJsonPath;
          }
        } catch {
          // Continue to next directory
        }
      }
    }
  } catch {
    // Fall through to default
  }
  // Default fallback
  return path.join(pluginsDir, pluginName, '.claude-plugin', 'plugin.json');
}

async function selectPlugin(marketplaceData, rl) {
  const plugins = marketplaceData.plugins || [];

  if (plugins.length === 0) {
    console.error('❌ No plugins found in marketplace.json');
    process.exit(1);
  }

  if (plugins.length === 1) {
    return plugins[0].name;
  }

  console.log('\n📦 Select a plugin to bump version:\n');
  plugins.forEach((plugin, index) => {
    console.log(`  ${index + 1}) ${plugin.name} (v${plugin.version})`);
  });
  console.log(`  ${plugins.length + 1}) Cancel\n`);

  const answer = await askQuestion(rl, 'Enter choice: ');
  const choice = parseInt(answer);

  if (choice >= 1 && choice <= plugins.length) {
    return plugins[choice - 1].name;
  } else if (choice === plugins.length + 1) {
    console.log('\n❌ Cancelled.\n');
    process.exit(0);
  } else {
    console.log('\n❌ Invalid choice.\n');
    process.exit(1);
  }
}

async function bumpPluginVersion(pluginName, bumpTypeArg) {
  const PLUGIN_JSON = getPluginJsonPath(pluginName);

  // Check for uncommitted version changes
  const { execSync } = require('child_process');
  let hasUncommittedChanges = false;
  try {
    execSync('git diff --quiet HEAD -- ' + PLUGIN_JSON + ' ' + MARKETPLACE_JSON, { stdio: 'pipe' });
  } catch {
    hasUncommittedChanges = true;
  }

  if (hasUncommittedChanges) {
    console.log('⚠️  Warning: Version files have uncommitted changes.');
    console.log('   Please commit or stash them first.\n');
  }

  // Read current versions
  const pluginData = readJSON(PLUGIN_JSON);
  const marketplaceData = readJSON(MARKETPLACE_JSON);

  const currentVersion = pluginData.version;
  console.log(`\n📦 Plugin: ${pluginName}`);
  console.log(`   Current version: ${currentVersion}\n`);

  // Calculate next versions
  const nextMajor = bumpVersion(currentVersion, 'major');
  const nextMinor = bumpVersion(currentVersion, 'minor');
  const nextPatch = bumpVersion(currentVersion, 'patch');

  let newVersion;
  let bumpType;

  if (bumpTypeArg) {
    // Use provided bump type
    newVersion = bumpVersion(currentVersion, bumpTypeArg);
    bumpType = bumpTypeArg;
  } else {
    // Interactive selection
    console.log('Select version bump type:');
    console.log(`  1) Major (${currentVersion} → ${nextMajor}) - Breaking changes`);
    console.log(`  2) Minor (${currentVersion} → ${nextMinor}) - New features`);
    console.log(`  3) Patch (${currentVersion} → ${nextPatch}) - Bug fixes`);
    console.log('  4) Cancel\n');

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await askQuestion(rl, 'Enter choice (1-4): ');
    rl.close();

    switch (answer) {
      case '1':
        newVersion = nextMajor;
        bumpType = 'major';
        break;
      case '2':
        newVersion = nextMinor;
        bumpType = 'minor';
        break;
      case '3':
        newVersion = nextPatch;
        bumpType = 'patch';
        break;
      case '4':
      case '':
        console.log('\n❌ Cancelled. No changes made.\n');
        process.exit(0);
      default:
        console.log('\n❌ Invalid choice. No changes made.\n');
        process.exit(1);
    }
  }

  console.log(`\n📝 Bumping ${bumpType} version: ${currentVersion} → ${newVersion}\n`);

  // Update plugin.json
  pluginData.version = newVersion;
  writeJSON(PLUGIN_JSON, pluginData);
  console.log(`✅ Updated ${path.relative(process.cwd(), PLUGIN_JSON)}`);

  // Update marketplace.json
  const pluginEntry = marketplaceData.plugins.find(p => p.name === pluginName);
  if (pluginEntry) {
    pluginEntry.version = newVersion;
    writeJSON(MARKETPLACE_JSON, marketplaceData);
    console.log(`✅ Updated ${path.relative(process.cwd(), MARKETPLACE_JSON)}`);
  } else {
    console.log(`⚠️  Warning: Could not find ${pluginName} in marketplace.json`);
  }

  console.log(`\n🎉 Version bumped to ${newVersion}!`);
  console.log('\nNext steps:');
  console.log(`  1. Review the changes: git diff`);
  console.log(`  2. Commit with message: git commit -am "chore(${pluginName}): bump version to ${newVersion}"`);
  console.log(`  3. Push to remote: git push\n`);
}

async function main() {
  const args = process.argv.slice(2);
  const marketplaceData = readJSON(MARKETPLACE_JSON);

  let pluginName = null;
  let bumpTypeArg = null;

  // Parse arguments
  for (const arg of args) {
    if (['major', 'minor', 'patch'].includes(arg)) {
      bumpTypeArg = arg;
    } else {
      pluginName = arg;
    }
  }

  // If no plugin name provided, try to auto-detect or prompt
  if (!pluginName) {
    pluginName = getCurrentPluginName();

    if (!pluginName) {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      pluginName = await selectPlugin(marketplaceData, rl);
      rl.close();
    }
  }

  // Validate plugin exists
  const pluginEntry = marketplaceData.plugins.find(p => p.name === pluginName);
  if (!pluginEntry) {
    console.error(`❌ Plugin "${pluginName}" not found in marketplace.json`);
    console.log('\nAvailable plugins:');
    for (const p of marketplaceData.plugins || []) {
      console.log(`  - ${p.name}`);
    }
    console.log('');
    process.exit(1);
  }

  await bumpPluginVersion(pluginName, bumpTypeArg);
}

main().catch(e => {
  console.error(`Error: ${e.message}`);
  process.exit(1);
});
