---
description: release-creator 首次安装引导：渐进式询问，为本项目派生一份专属的 release skill
---

## Your task

Invoke the `release-creator-welcome` skill (from the `release-creator` plugin) and follow its instructions exactly. The skill uses progressive AskUserQuestion to help the user derive a project-specific release skill via `skill-creator`. The derivation flow branches along 4 dimensions (ecosystem / philosophy / packaging-and-tag / exhaustive) and composes a tailored skill from a dynamic template library. The user may abandon at any step.
