import fs from 'fs';
import path from 'path';
import os from 'os';

const CLAUDE_DIR = path.join(os.homedir(), '.claude');
const SETTINGS_PATH = path.join(CLAUDE_DIR, 'settings.json');
const STATUSLINE_SCRIPT = path.join(CLAUDE_DIR, 'statusline-command.sh');
const ORIGINAL_SCRIPT = path.join(CLAUDE_DIR, 'statusline-command.sh.original');

interface StatusLineSettings {
  statusLine?: { command?: string };
  _tokenReporterStatusLineIntegrated?: boolean;
  [key: string]: unknown;
}

export interface IntegrationStatus {
  integrated: boolean;
  currentCommand: string;
  originalScript: boolean;
  hasStatusLine: boolean;
}

export interface IntegrationResult {
  success: boolean;
  message: string;
  status?: IntegrationStatus;
  originalPath?: string;
  error?: unknown;
}

function readJSON<T>(filePath: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

export function getStatus(): IntegrationStatus {
  const settings = readJSON<StatusLineSettings>(SETTINGS_PATH, {});
  const currentCommand = settings.statusLine?.command || '';
  const isIntegrated = settings._tokenReporterStatusLineIntegrated === true;

  return {
    integrated: isIntegrated,
    currentCommand,
    originalScript: fs.existsSync(ORIGINAL_SCRIPT),
    hasStatusLine: fs.existsSync(STATUSLINE_SCRIPT),
  };
}

export function enableIntegration(options: { force?: boolean } = {}): IntegrationResult {
  const status = getStatus();

  if (status.integrated && !options.force) {
    return {
      success: false,
      message: 'Already integrated. Use --force to re-integrate.',
      status,
    };
  }

  if (!status.currentCommand && !fs.existsSync(STATUSLINE_SCRIPT)) {
    return {
      success: false,
      message: 'No status line configuration found. Please configure a status line in Claude Code settings first.',
      status,
    };
  }

  try {
    backupOriginalScript();
    createWrapperScript();
    updateSettingsJson();

    return {
      success: true,
      message: 'Status line integrated successfully',
      originalPath: ORIGINAL_SCRIPT,
    };
  } catch (error: unknown) {
    return {
      success: false,
      message: `Integration failed: ${error instanceof Error ? error.message : String(error)}`,
      error,
    };
  }
}

export function disableIntegration(): IntegrationResult {
  const status = getStatus();

  if (!status.integrated) {
    return {
      success: false,
      message: 'No integration found. Nothing to restore.',
      status,
    };
  }

  try {
    if (!fs.existsSync(ORIGINAL_SCRIPT)) {
      return {
        success: false,
        message: 'Original script not found. Cannot restore.',
        status,
      };
    }

    restoreSettings();

    return {
      success: true,
      message: 'Status line restored',
    };
  } catch (error: unknown) {
    return {
      success: false,
      message: `Restore failed: ${error instanceof Error ? error.message : String(error)}`,
      error,
    };
  }
}

function backupOriginalScript(): string {
  if (fs.existsSync(STATUSLINE_SCRIPT)) {
    fs.copyFileSync(STATUSLINE_SCRIPT, ORIGINAL_SCRIPT);
  }
  return ORIGINAL_SCRIPT;
}

export function hasOriginalScript(): boolean {
  return fs.existsSync(ORIGINAL_SCRIPT);
}

function createWrapperScript(): string {
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
echo "$INPUT" | sh "$HOME/.claude/statusline-command.sh.original"
`;

  fs.writeFileSync(STATUSLINE_SCRIPT, wrapperContent, { mode: 0o755 });
  return STATUSLINE_SCRIPT;
}

function updateSettingsJson(): void {
  const settings = readJSON<StatusLineSettings>(SETTINGS_PATH, {});
  settings._tokenReporterStatusLineIntegrated = true;
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
}

function restoreSettings(): void {
  if (fs.existsSync(ORIGINAL_SCRIPT)) {
    fs.copyFileSync(ORIGINAL_SCRIPT, STATUSLINE_SCRIPT);
  }

  const settings = readJSON<StatusLineSettings>(SETTINGS_PATH, {});
  delete settings._tokenReporterStatusLineIntegrated;
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
}
