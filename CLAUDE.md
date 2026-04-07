# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repo Is

**df-market** is a Claude Code plugin marketplace hosted on GitHub (`jjj201200/df-market`). It contains:
- `.claude-plugin/marketplace.json` — the registry of available plugins
- `plugins/` — the actual plugin source code (currently: `token-reporter`)

Users register this marketplace in their Claude Code settings and install plugins via `/plugin install <name>@df-market`.

## Running Tests

Tests use Node's built-in `assert` module — no test framework to install.

```bash
# Run all tests for token-reporter
cd plugins/token-reporter
node test/test-hooks.js
node test/test-migration.js
node test/test-single-instance.js
```

Tests use the `TOKEN_REPORTER_DATA_DIR` env var to redirect data to a temp directory, avoiding interference with a live install.

## Plugin Architecture (token-reporter)

The plugin follows the Claude Code plugin lifecycle model:

### Hooks (`hooks/`)
Three lifecycle scripts registered in `hooks/hooks.json`:
- **`session-start.js`** — ensures data dirs exist, loads config, runs migrations, acquires a file lock, spawns the HTTP server as a detached process
- **`post-tool-use.js`** — POSTs a notification to the server after every tool call, triggering SSE broadcasts to web clients
- **`session-end.js`** — cleans up on exit

### Server (`src/server.js`)
Lightweight HTTP server (default port 3737) with:
- `GET /` → serves `src/report.html` (the web dashboard)
- `GET /events` → SSE stream for real-time dashboard updates
- `POST /notify` → receives tool-use notifications from the hook
- `GET /api/sessions` → lists all Claude Code session files
- `GET /api/sessions/:id` → returns parsed session data

### Parser (`src/parser.js`)
Reads JSONL session files from `~/.claude/projects/*/` (including subagents). Extracts turn-by-turn token usage (input, output, cache_read, cache_creation) and tool call details. Tools are classified into categories: bash, read, edit, write, grep, glob, web, agent, other.

### CLI Commands (`bin/`)
Executable scripts in `bin/` are added to PATH when the plugin is enabled. Available commands:
- `token-reporter-start` — start the server
- `token-reporter-stop` — stop the server
- `token-reporter-status` — show server status
- `token-reporter-auto-launch-on` — enable auto-start
- `token-reporter-auto-launch-off` — disable auto-start

### Persistence
All runtime data lives in `~/.claude/token-reporter/`:
- `config.json` — port and `autoStart` flag
- `server.pid` — PID of the running server process
- `server.lock` — file lock to prevent duplicate instances

### Version Migrations (`src/migrate.js`)
A migration framework that runs on session start. When adding breaking config changes, add a migration entry here.

## Adding a New Plugin

1. Create `plugins/<name>/` with the plugin source
2. Add a `.claude-plugin/plugin.json` inside it with metadata
3. Register it in `.claude-plugin/marketplace.json` at the repo root

## Version Management

### Before Every Push

**Always check if version needs to be bumped before pushing.** Run:

```bash
node plugins/token-reporter/scripts/check-version.js
```

This will prompt you to bump the version if it hasn't been updated.

### Version Bump Script

Interactive version bumping (recommended):

```bash
node plugins/token-reporter/scripts/bump-version.js
```

Or specify the bump type directly:

```bash
node plugins/token-reporter/scripts/bump-version.js patch   # 1.0.0 → 1.0.1
node plugins/token-reporter/scripts/bump-version.js minor   # 1.0.0 → 1.1.0
node plugins/token-reporter/scripts/bump-version.js major   # 1.0.0 → 2.0.0
```

The script updates both files automatically:
- `plugins/token-reporter/.claude-plugin/plugin.json`
- `.claude-plugin/marketplace.json`

### Version Locations

Version appears in these places for `token-reporter`:
- `plugins/token-reporter/.claude-plugin/plugin.json` — plugin manifest
- `.claude-plugin/marketplace.json` — marketplace registry
- Git commit message (convention: `chore: bump version to X.Y.Z`)

### Commit Guidelines

**Do NOT add `Co-Authored-By:` or any attribution lines to commits.** Keep commit messages clean and simple without any trailer lines.

### Git Hook (Optional)

To automatically check version before every push, add to `.git/hooks/pre-push`:

```bash
#!/bin/bash
node plugins/token-reporter/scripts/check-version.js || exit 1
```

Then make it executable:

```bash
chmod +x .git/hooks/pre-push
```
