# Token Reporter

Real-time Claude Code token usage reporter. Automatically starts a local web server that shows per-request token statistics with interactive charts.

## Prerequisites

- Node.js 18+

## Installation

Add to your `~/.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "df-market": {
      "source": {
        "source": "github",
        "repo": "jjj201200/df-market"
      }
    }
  }
}
```

Then install via Claude Code:

```
/plugin install token-reporter@df-market
```

## CLI Commands

After installation, the following commands are available in your PATH:

| Command                          | Description                                       |
| -------------------------------- | ------------------------------------------------- |
| `token-reporter-start`           | Start the server (skip if already running)        |
| `token-reporter-stop`            | Stop the server and clean up the process          |
| `token-reporter-status`          | Show server status, port, session count, and more |
| `token-reporter-auto-launch-on`  | Enable auto-start when Claude Code launches       |
| `token-reporter-auto-launch-off` | Disable auto-start when Claude Code launches      |

## Usage

Once installed, the server starts automatically when Claude Code launches.

Open http://localhost:3737 in your browser to view the report.

## Configuration

Edit `~/.claude/token-reporter/config.json`:

```json
{
  "port": 3737,
  "autoStart": true
}
```

Set `autoStart: false` to disable automatic startup.
