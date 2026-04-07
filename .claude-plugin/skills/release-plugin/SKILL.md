---
name: release-plugin
description: |
  Automates the complete release workflow for df-market plugins.
  
  Use this skill when the user says things like:
  - "release the plugin"
  - "publish the changes"
  - "bump version and push"
  - "create a new release"
  - "tag and push"
  - "deploy the plugin"
  - "ship it"
  - "finalize the release"
  
  This skill handles: version bumping, git commit, git tag creation, and git push.
  It ensures the version is updated in both plugin.json and marketplace.json before releasing.
---

# Release Plugin Skill

Automates the complete release workflow for df-market plugins.

## Workflow

1. **Check for uncommitted changes** - Ensure all changes are committed before release
2. **Bump version** - Update version in plugin.json and marketplace.json
3. **Create commit** - Commit version changes with conventional commit message
4. **Create git tag** - Tag the release with version number
5. **Push to remote** - Push both commits and tags

## Usage

When user wants to release:

1. Check git status to see current state
2. If there are uncommitted changes, commit them first with appropriate message
3. Run version bump script interactively or with specified bump type
4. Create commit for version bump
5. Create git tag (v{version})
6. Push commits and tags to remote

## Commands

```bash
# Check git status
git status

# Commit any pending changes
git add -A
git commit -m "fix: description of changes"

# Bump version (interactive)
node plugins/<name>/scripts/bump-version.js

# Or bump with specific type
node plugins/<name>/scripts/bump-version.js patch
node plugins/<name>/scripts/bump-version.js minor
node plugins/<name>/scripts/bump-version.js major

# Create tag
git tag v<version>

# Push everything
git push
git push --tags
```

## Release Checklist

Before releasing, verify:
- [ ] All changes are committed
- [ ] Tests pass (if applicable)
- [ ] Version is bumped correctly
- [ ] Commit message follows convention: `chore(<plugin>): bump version to X.Y.Z`
- [ ] Tag is created with format `vX.Y.Z`
- [ ] Both commits and tags are pushed

## Notes

- The bump-version script updates both plugin.json and marketplace.json
- Always use conventional commit format for version bumps
- Tags should follow semantic versioning format: v1.0.0, v1.2.3, etc.
- Push commits first, then tags
