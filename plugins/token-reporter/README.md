# Token Reporter

Real-time Claude Code token usage reporter. Automatically starts a local web server that shows per-request token statistics with interactive charts.

## Prerequisites

- Node.js 18+

## Installation

Add to your `~/.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "token-reporter-market": {
      "source": {
        "source": "github",
        "repo": "jjj201200/token-reporter"
      }
    }
  }
}
```

Then install via Claude Code:

```
/plugin install token-reporter@token-reporter-market
```

## Usage

Once installed, the server starts automatically when Claude Code launches.

Open http://localhost:3737 in your browser to view the report.

Use `/token-report` to manually start the server or check its status.

## Configuration

Edit `~/.claude/token-reporter/config.json`:

```json
{
  "port": 3737,
  "autoStart": true
}
```

Set `autoStart: false` to disable automatic startup.
