#!/usr/bin/env bash
# Build token-reporter frontend and commit dist/ if it changed.
# Invoked by .githooks/pre-push when pushing a branch (not tag-only pushes).
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
FRONTEND_DIR="$REPO_ROOT/plugins/token-reporter/frontend"
DIST_DIR="$REPO_ROOT/plugins/token-reporter/dist"

[ -f "$FRONTEND_DIR/package.json" ] || exit 0

echo "🔨 Building token-reporter frontend..."

if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
  echo "📦 Installing frontend dependencies..."
  (cd "$FRONTEND_DIR" && npm ci --silent) || {
    echo "❌ Frontend dependency install failed. Push aborted."
    exit 1
  }
fi

(cd "$FRONTEND_DIR" && npm run build) || {
  echo "❌ Frontend build failed. Push aborted."
  exit 1
}

if [ -n "$(git status --porcelain "$DIST_DIR")" ]; then
  git add "$DIST_DIR"
  git commit -m "chore: rebuild token-reporter frontend dist" --no-verify
  echo "📦 Frontend dist/ updated and committed."
fi
