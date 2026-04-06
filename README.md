# df-market — Claude Code Plugin Marketplace

df's personal Claude Code plugins marketplace.

## Installation

Add to your `~/.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "df-market": {
      "source": {
        "source": "github",
        "repo": "jjj201200/token-reporter"
      }
    }
  }
}
```

Then install plugins via Claude Code:

```
/plugin install token-reporter@df-market
```

## Prerequisites

- Node.js 18+

## Usage

Once installed, the server starts automatically when Claude Code launches.

Open http://localhost:3737 in your browser to view the report.

Use `/token-report` to manually start the server or check its status.
