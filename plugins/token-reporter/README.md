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

## Commands

| Command                           | Description                      |
| --------------------------------- | -------------------------------- |
| `/token-reporter:start`           | 启动服务器（如已运行则跳过）     |
| `/token-reporter:stop`            | 停止服务器并清理进程             |
| `/token-reporter:status`          | 查看服务状态、端口、会话数等信息 |
| `/token-reporter:auto-launch-on`  | 开启 Claude Code 启动时自动运行  |
| `/token-reporter:auto-launch-off` | 关闭 Claude Code 启动时自动运行  |

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
