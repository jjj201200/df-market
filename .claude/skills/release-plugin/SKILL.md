---
name: release-plugin
description: |
  Automates the complete release workflow for df-market. Covers both plugin releases and marketplace self releases.

  Use this skill when the user says things like:
  - "release the plugin"
  - "publish the changes"
  - "bump version and push"
  - "create a new release"
  - "tag and push"
  - "deploy the plugin"
  - "ship it"
  - "finalize the release"
  - "bump the marketplace"
  - "release the marketplace"

  The skill decides — based on what changed — whether this is a plugin release, a marketplace release, or both, and applies the correct version/tag scheme.
---

# Release Skill（df-market plugins + marketplace）

Automates the full release workflow for both plugins under `plugins/*/` and the marketplace container (`.claude-plugin/marketplace.json`).

## Release Targets

The df-market repo has two kinds of release-able artifacts:

| Target | Version source of truth | Tag format | Who it affects |
|---|---|---|---|
| **Plugin** | `plugins/<name>/.claude-plugin/plugin.json` **AND** the plugin's entry inside `.claude-plugin/marketplace.json` (must match) | `<plugin-name>-v<version>` | Users who installed that plugin |
| **Marketplace self** | `.claude-plugin/marketplace.json` → `metadata.version` | `marketplace-v<version>` | Anyone consuming the marketplace (plugin listing clients) |

**Never use the short `v<version>` tag format.** It was deprecated in April 2026 when all historical `token-reporter` tags were migrated to `token-reporter-v*`. A single `vX.Y.Z` is ambiguous in a multi-plugin repo.

## Decision: Plugin Release, Marketplace Release, or Both?

Before running any commands, classify the change:

| Change | Plugin release? | Marketplace self release? |
|---|---|---|
| Plugin bug fix / feature / refactor | **Yes** (bump that plugin) | **No** |
| Plugin docs / description edits (user-facing) | **Yes** (patch bump) | **No** |
| Added a new plugin entry to `marketplace.json` | Yes (the new plugin starts at 0.1.0 and gets tagged) | **Yes** (marketplace gets a **minor** bump — new plugin = new structural item) |
| Removed a plugin entry from `marketplace.json` | — (the plugin being removed doesn't get a tag) | **Yes** (marketplace gets a **major** bump — breaking for consumers pinned to that plugin) |
| Changed marketplace root fields (`name` / `owner` / `metadata.description`) | **No** | **Yes** (**minor** bump) |
| Changed marketplace schema / JSON structure | **No** | **Yes** (**major** bump) |
| Fixed a typo in marketplace root `metadata.description` | **No** | **Yes** (**patch** bump) |
| Pure plugin version bump inside marketplace.json (cascade from plugin release) | Yes | **No** — that's just mirroring the plugin's own version |

**If both a plugin release and marketplace release apply to the same changeset**, do them as **two commits + two tags** in sequence: plugin first, then marketplace. Do NOT collapse them into one commit — the audit trail matters.

## Plugin Release Workflow

1. Identify the plugin name (matches `name` in `plugins/<name>/.claude-plugin/plugin.json`)
2. Check `git status` — ensure all plugin changes are already committed, or plan to include them in this release commit
3. **Bump version** — update version in BOTH:
   - `plugins/<name>/.claude-plugin/plugin.json`
   - The matching plugin entry inside `.claude-plugin/marketplace.json`

   Two files must hold identical version strings. Prefer the plugin's bump-version script when available:

   ```bash
   # Interactive
   node plugins/<name>/scripts/bump-version.cjs

   # Or with a specific bump type
   node plugins/<name>/scripts/bump-version.cjs patch
   node plugins/<name>/scripts/bump-version.cjs minor
   node plugins/<name>/scripts/bump-version.cjs major
   ```

   If the plugin has no bump-version script (e.g. new plugins), edit both JSON files by hand and verify they match.

4. **Single commit** — all changes + version bump together:

   ```bash
   git add <specific paths>
   git commit -m "chore(<plugin-name>): bump version to X.Y.Z"
   # or for a mixed commit
   git commit -m "feat(<plugin-name>): <description>

   includes version bump to X.Y.Z"
   ```

5. **Tag** — `<plugin-name>-v<version>`:

   ```bash
   git tag <plugin-name>-v<version>
   ```

6. **Push** — commit, then the specific new tag:

   ```bash
   git push origin main
   git push origin <plugin-name>-v<version>
   ```

## Marketplace Self Release Workflow

When `.claude-plugin/marketplace.json`'s own metadata or plugin list changes **structurally** (see decision table), bump the marketplace's own version.

1. Check `git status`
2. Edit `.claude-plugin/marketplace.json` → `metadata.version` → apply semver:
   - **patch**: marketplace-level typo / description fix
   - **minor**: added plugin entry, or changed marketplace root fields (`name` / `owner`)
   - **major**: removed plugin entry, or changed the JSON schema / field structure
3. Commit — with scope `marketplace`:

   ```bash
   git add .claude-plugin/marketplace.json <other marketplace-level paths>
   git commit -m "chore(marketplace): bump version to X.Y.Z

   <one-line reason: added skill-keeper plugin / removed foo / reworked schema / ...>"
   ```

4. Tag — `marketplace-v<version>`:

   ```bash
   git tag marketplace-v<version>
   ```

5. Push:

   ```bash
   git push origin main
   git push origin marketplace-v<version>
   ```

## IMPORTANT: Version Bump Timing

**Always bump version BEFORE creating the final commit.** One commit = code changes + version bump together.

**WRONG**: Commit code changes → Bump version → Commit version bump (two commits)
**CORRECT**: Code changes + Version bump → Single commit → Tag → Push

## IMPORTANT: Don't Use `git push --tags`

**Do not run `git push --tags`.** That pushes every local tag, including unrelated work-in-progress ones. Always push the specific new tag you just created with `git push origin <tag-name>`.

## IMPORTANT: Clean Commit Messages

- Concise, descriptive, conventional commit format: `type(scope): description`
- `scope` is the plugin name for plugin releases, or the literal `marketplace` for marketplace releases
- **Do not** add trailer lines like `Co-Authored-By:`, `Signed-off-by:`, attribution, authorship, or co-author mentions

## Full Release Checklist

Before pushing, verify:

- [ ] The correct target was identified (plugin? marketplace? both?)
- [ ] All changes are committed or staged for the release commit
- [ ] Tests pass (if applicable)
- [ ] Version is bumped correctly:
  - Plugin release → both `plugins/<name>/.claude-plugin/plugin.json` AND the matching entry in `marketplace.json` updated to the same version
  - Marketplace self release → `.claude-plugin/marketplace.json` → `metadata.version` bumped per semver table above
- [ ] Commit message follows convention:
  - Plugin: `chore(<plugin-name>): bump version to X.Y.Z`
  - Marketplace: `chore(marketplace): bump version to X.Y.Z`
- [ ] Tag format is correct:
  - Plugin: `<plugin-name>-vX.Y.Z`
  - Marketplace: `marketplace-vX.Y.Z`
  - **NOT** the deprecated short `vX.Y.Z`
- [ ] Only the specific new tag(s) pushed — no `--tags`
- [ ] If both plugin + marketplace changed, two separate commits + two separate tags were created

## Historical Note

All `v<version>` tags created before April 2026 belonged to `token-reporter` and were migrated to `token-reporter-v<version>` in a one-time cleanup. No new tags should ever use the short `v<version>` form regardless of target.
