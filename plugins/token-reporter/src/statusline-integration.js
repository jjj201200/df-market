"use strict";
/**
 * Status Line Integration Module
 * Handles integration with Claude Code's status line to capture real-time token limits
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

const CLAUDE_DIR = path.join(os.homedir(), ".claude");
const SETTINGS_PATH = path.join(CLAUDE_DIR, "settings.json");
const STATUSLINE_SCRIPT = path.join(CLAUDE_DIR, "statusline-command.sh");
const ORIGINAL_SCRIPT = path.join(CLAUDE_DIR, "statusline-command.sh.original");

/**
 * Get current integration status
 * @returns {Object} Status information
 */
function getStatus() {
  const settings = readJSON(SETTINGS_PATH, {});
  const currentCommand = settings.statusLine?.command || "";

  // Check if we're integrated (flag in settings or .original exists)
  const isIntegrated = settings._tokenReporterStatusLineIntegrated === true;

  return {
    integrated: isIntegrated,
    currentCommand,
    originalScript: fs.existsSync(ORIGINAL_SCRIPT),
    hasStatusLine: fs.existsSync(STATUSLINE_SCRIPT),
  };
}

/**
 * Enable status line integration
 * @param {Object} options
 * @param {boolean} options.force - Force re-integration even if already integrated
 * @returns {Object} Result with success flag and message
 */
function enableIntegration(options = {}) {
  const status = getStatus();

  if (status.integrated && !options.force) {
    return {
      success: false,
      message: "Already integrated. Use --force to re-integrate.",
      status,
    };
  }

  // Check if user has a status line configured
  if (!status.currentCommand && !fs.existsSync(STATUSLINE_SCRIPT)) {
    return {
      success: false,
      message: "No status line configuration found. Please configure a status line in Claude Code settings first.",
      status,
    };
  }

  try {
    // 1. Backup original script to .original
    backupOriginalScript();

    // 2. Create wrapper script (replaces original)
    createWrapperScript();

    // 3. Update settings.json to point to wrapper (same path)
    updateSettingsJson();

    return {
      success: true,
      message: "Status line integrated successfully",
      originalPath: ORIGINAL_SCRIPT,
    };
  } catch (error) {
    return {
      success: false,
      message: `Integration failed: ${error.message}`,
      error,
    };
  }
}

/**
 * Disable status line integration and restore original
 * @returns {Object} Result with success flag and message
 */
function disableIntegration() {
  const status = getStatus();

  if (!status.integrated) {
    return {
      success: false,
      message: "No integration found. Nothing to restore.",
      status,
    };
  }

  try {
    if (!fs.existsSync(ORIGINAL_SCRIPT)) {
      return {
        success: false,
        message: "Original script not found. Cannot restore.",
        status,
      };
    }

    // Restore original settings
    restoreSettings();

    return {
      success: true,
      message: "Status line restored",
    };
  } catch (error) {
    return {
      success: false,
      message: `Restore failed: ${error.message}`,
      error,
    };
  }
}

/**
 * Backup the original status line script to .original
 * @returns {string} Path to original script
 */
function backupOriginalScript() {
  if (fs.existsSync(STATUSLINE_SCRIPT)) {
    fs.copyFileSync(STATUSLINE_SCRIPT, ORIGINAL_SCRIPT);
  }
  return ORIGINAL_SCRIPT;
}

/**
 * Check if original script exists
 * @returns {boolean}
 */
function hasOriginalScript() {
  return fs.existsSync(ORIGINAL_SCRIPT);
}

/**
 * Create the wrapper script that forwards data to token-reporter
 * @returns {string} Path to wrapper script
 */
function createWrapperScript() {
  const wrapperContent = `#!/bin/sh
# Token Reporter Status Line Wrapper
# Generated automatically - Do not edit manually

# Read input from Claude Code
INPUT=$(cat)

# Forward token limits data to token-reporter server (async, silent)
(
  echo "$INPUT" | jq -n --argjson input "$INPUT" '{
    timestamp: now,
    session_id: $input.session_id,
    context_window: $input.context_window,
    rate_limits: $input.rate_limits,
    model: $input.model,
    cost: $input.cost
  }' 2>/dev/null | curl -s -X POST \
    http://localhost:3737/api/limits \
    -H "Content-Type: application/json" \
    -d @- \
    --connect-timeout 1 \
    --max-time 2 \
    2>/dev/null >/dev/null
) &

# Call original script with the input
echo "$INPUT" | sh "${HOME}/.claude/statusline-command.sh.original"
`;

  fs.writeFileSync(STATUSLINE_SCRIPT, wrapperContent, { mode: 0o755 });
  return STATUSLINE_SCRIPT;
}

/**
 * Update settings.json (wrapper uses same path as original)
 */
function updateSettingsJson() {
  const settings = readJSON(SETTINGS_PATH, {});

  // Store flag that we're integrated (path stays the same)
  settings._tokenReporterStatusLineIntegrated = true;

  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
}

/**
 * Restore original script
 */
function restoreSettings() {
  // Restore original script from .original
  if (fs.existsSync(ORIGINAL_SCRIPT)) {
    fs.copyFileSync(ORIGINAL_SCRIPT, STATUSLINE_SCRIPT);
  }

  const settings = readJSON(SETTINGS_PATH, {});
  delete settings._tokenReporterStatusLineIntegrated;
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
}

/**
 * Read JSON file with fallback
 */
function readJSON(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

module.exports = {
  getStatus,
  enableIntegration,
  disableIntegration,
};
