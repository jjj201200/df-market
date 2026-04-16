# 哲学子模板 · commit 推导派（semantic-release 哲学）

`{{philosophy}} = commit-derived` 时 skill-creator 拼入本子模板。供 master 模板的 `{{philosophyBlock}}` / `{{decisionBlock}}` / `{{philosophyConstraints}}` 占位符使用。

---

## `{{philosophyBlock}}` 内容

```markdown
版本号**完全由 commit message 推导**。本项目遵循 conventional commits：

- `feat:` → minor bump（新增向后兼容的功能）
- `fix:` → patch bump（修复 bug）
- `BREAKING CHANGE:` 或 `type!:` → major bump（破坏性变更）
- `chore:` / `docs:` / `refactor:` / `test:` → 按 {{bumpRules}} 决定是否 bump

> commit message 决定版本号，**不是**人决定。如果你觉得某次变更应该是 major 但 commit 里没 `BREAKING CHANGE:`，**不要手动改版本号**——改 commit message（或追加空 commit）。
```

## `{{decisionBlock}}` 内容（master-philosophy 模板用）

```markdown
### 推导新版本号

预览本次 release 会跳到哪个版本：

```bash
{{commitScanPreview}}
```

如果输出的版本号符合预期，记下它作为 `X.Y.Z`。

如果输出为空（没有触发 bump 的 commit）——**本次不应 release**：只有 `chore:` / `docs:` / `style:` 的变更不足以构成 release。要么追加一个 `feat:` / `fix:`，要么放弃本次 release。

如果输出与预期不符——**修正 commit message**，不要手动指定版本号。
```

## `{{philosophyConstraints}}` 内容

```
- commit message 必须遵循 conventional commits 格式，PR merge 前人工复核
- 不允许手动指定版本号绕过 commit 推导——破例即破坏哲学
- 每次 release 前运行 `{{commitScanPreview}}` 预览，严禁「先改版本号再写 commit」
- CI 如果是全自动 release，不应提供「手动 trigger」入口
```

## `{{bumpRules}}` 展开

根据 `{{projectAnswers}}` 里的第一问（bump 规则）：

| 用户选择                    | 展开                                                   |
| --------------------------- | ------------------------------------------------------ |
| 标准 conventional           | `feat=minor / fix=patch / BREAKING=major，其他不 bump` |
| 严格（所有 chore 不 bump）  | `只有 feat / fix / BREAKING 触发 release`              |
| 自定义                      | `TODO: 请补充本项目的 bump 规则`                       |

## `{{commitScanPreview}}` 展开

根据 `{{projectAnswers}}` 里采集的工具：

| 工具              | 命令                                                                    |
| ----------------- | ----------------------------------------------------------------------- |
| semantic-release  | `npx semantic-release --dry-run`                                        |
| release-please    | `npx release-please release-pr --dry-run --token=$GITHUB_TOKEN ...`     |
| conventional-changelog | `npx conventional-recommended-bump -p angular`                     |
| 无工具            | `TODO: 请手工核对 git log 并推导版本号`                                 |

## `{{changelogBlock}}` 内容（可选，作为 master-philosophy 的补充段）

```markdown
## CHANGELOG

本项目的 CHANGELOG **从 commit 自动生成**。每次 release 按 {{changelogTool}} 的配置产出；不要手动编辑已发布版本的 CHANGELOG 条目。

生成命令：

```bash
{{changelogTool}}
```
```

## 硬性约束补充

- **禁止「先决定版本号再写 commit」**——这样写出的 commit 会跟版本号对不上号
- **每个 PR 至少一个 semantic commit**——PR 中途补 commit 要慎重：不小心提个 `fix:` 可能引发意料之外的 patch
- **合并 PR 用 squash**（或其他能保留最上层 semantic commit 的策略）——merge commit 会把分支所有 commit 塞进去，破坏语义
