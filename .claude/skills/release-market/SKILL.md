---
name: release-market
description: "df-market 项目专属的 release 流程。当用户说 release、发布、打 tag、bump version、ship it、df-market release、df-market 发布、release-market、release <plugin>、发布 <plugin>、bump <plugin> 时触发。覆盖 plugins/ 下所有插件的版本 bump、tag 创建、镜像同步与 push 全流程。新增插件时无需修改本 skill。"
---

# df-market Release Skill（打包派）

本 skill 是 **df-market** 项目专属的 release 流程。由 release-creator 派生生成，记录本项目对版本决策 / 打包 / tag / Bump / Check 的明确选择。

## 发行单元拓扑

- 打包粒度：**monorepo 单包 release（一次只发一个插件）**
- tag 格式：**`<plugin-name>-v<version>`**
- 发行单元发现：**运行时动态扫描** `plugins/*/`，以 `.claude-plugin/plugin.json` 存在为准。新增插件后无需修改本 skill。

一次 release 只动一个发行单元，每个单元独立版本号。改动涉及哪个单元就 release 哪个；无跨单元批量时，不要「顺带」bump 无关单元。

### 发现发行单元（每次 release 开头执行）

```bash
ls -d plugins/*/  # 列出所有插件目录
# 逐个确认 .claude-plugin/plugin.json 是否存在
```

或直接读 `.claude-plugin/marketplace.json > plugins[].name` 获取注册表中的插件列表。

---

## 辅助维度速览

| 维度             | 本项目值                                                                 |
| ---------------- | ------------------------------------------------------------------------ |
| 生态             | claude-plugin（Claude Code 插件；无 package registry，发行 = git tag + push） |
| 版本决策哲学     | commit-derived（commit message 推导 + 手动复核）                         |
| 镜像同步文件     | `plugins/<plugin>/.claude-plugin/plugin.json > version` ; `.claude-plugin/marketplace.json > plugins[name=<plugin>].version` |
| bump 命令        | `node scripts/bump-version.cjs <plugin-name> <major\|minor\|patch\|X.Y.Z>` |

---

## 何时触发本 skill

- "release df-market"
- "release `<plugin-name>`"
- "发布 `<plugin-name>` 到 X.Y.Z"
- "bump `<plugin-name>`"
- "打 `<plugin-name>` 的 tag"
- "ship it"

---

## Release 决策（每次 release 开头必答）

在执行任何命令前，先回答这三问：

### 问 1. 本次 release 的发行单元是哪个？

先执行「发现发行单元」（见上方），列出当前 `plugins/*/` 里的所有插件。从中选定本次要 release 的那一个。如果改动横跨多个单元，**拆成多个 release**（每个单元一个 commit + 一个 tag），不要合并。

### 问 2. 目标版本号是？

版本号**完全由 commit message 推导**。本项目遵循 conventional commits：

- `feat:` → minor bump（新增向后兼容的功能）
- `fix:` → patch bump（修复 bug）
- `BREAKING CHANGE:` 或 `type!:` → major bump（破坏性变更）
- `chore:` / `docs:` / `refactor:` / `test:` → 不触发 release

commit message 决定版本号，**不是**人决定。如果你觉得某次变更应该是 major 但 commit 里没 `BREAKING CHANGE:`，**不要手动改版本号**——改 commit message。

### 问 3. 新 tag 名是？

按 `<plugin-name>-v<version>` 格式。例如某个名为 `foo` 的插件 bump 到 `1.2.3`，则 tag 为 `foo-v1.2.3`。

---

## Release 步骤

### 步骤 1. 前置检查

- `git status` clean
- 确认当前分支为 main（或 release 分支）
- 若该插件下有 `test/` 目录，跑测试：
  ```bash
  ls plugins/<plugin-name>/test/ && cd plugins/<plugin-name> && node test/*.js
  ```
- 手动扫一遍 `git log` 自上次 release 以来的 commit message：
  - `feat:` → minor bump
  - `fix:` → patch bump
  - `BREAKING CHANGE:` 或 `type!:` → major bump
  - 只有 `chore:` / `docs:` / `style:` → 不应 release

### 步骤 2. bump 版本号

```bash
node scripts/bump-version.cjs <plugin-name> <major|minor|patch>
```

脚本会自动同步 plugin.json 与 marketplace.json 的镜像字段，并打印新版本号。

### 步骤 3. 单次 commit（代码改动 + 版本 bump 合并）

```bash
git add plugins/<plugin-name>/ .claude-plugin/marketplace.json
git commit -m "chore(<plugin-name>): bump version to X.Y.Z"
```

若改动与 bump 合并（例如修 bug 顺带发版），commit message 形如：

```
fix(<plugin-name>): describe fix

includes version bump to X.Y.Z
```

### 步骤 4. 打 tag

```bash
git tag <plugin-name>-v<version>
```

### 步骤 5. push

```bash
git push origin main
git push origin <plugin-name>-v<version>
```

**严禁 `git push --tags`**——会推送所有本地 WIP tag。

pre-push hook 会在 push 之前自动跑 `scripts/check-version.cjs` 做版本校验；失败则 push 被阻断，按提示修复后重试。

---

## Bump 流程

版本号结构：SemVer（major.minor.patch），正则 `^\d+\.\d+\.\d+$`

### 操作

```bash
node scripts/bump-version.cjs <plugin-name> <major|minor|patch|X.Y.Z>
# 例：
# node scripts/bump-version.cjs token-reporter patch
# node scripts/bump-version.cjs skill-keeper minor
```

脚本会同步更新两个镜像文件：
- `plugins/<plugin-name>/.claude-plugin/plugin.json > version`
- `.claude-plugin/marketplace.json > plugins[name=<plugin-name>].version`

脚本执行成功后，把最终版本号打印到 stdout 供后续步骤引用。

---

## Check 流程

本项目采用 pre-push hook 自动校验版本一致性。脚本位于 `scripts/check-version.cjs`，hook 位于 `.git/hooks/pre-push`（单人仓库路径，无需额外配置；hook 不随 clone 传播，新成员需自行复制或改走 `.githooks/` + `git config core.hooksPath`）。

### 手动跑一遍

```bash
node scripts/check-version.cjs <plugin-name>
```

检查内容：
- `mirror-consistency` —— plugin.json 与 marketplace.json 的 version 字段一致
- `tag-conflict` —— 本次要打的 tag 不存在于本地或远端
- `workdir-clean` —— 版本文件无未 commit 改动
- `bump-in-diff` —— 本次 push 包含对版本文件的修改
- `regex-compliance` —— 版本号符合 SemVer 正则

任何一项失败 → exit 非零 → push 被阻断。

---

## 硬性约束

- **一次 release 一个发行单元**——涉及多个单元 → 拆 release
- **tag 格式严格按 `<plugin-name>-v<version>`**——禁止使用已废弃或非约定格式
- **镜像文件必须同步**——任何一处没跟上即版本漂移
- **不用 `git push --tags`**——会推送所有本地 WIP tag
- **commit scope 必须是单元名**——`chore(<plugin-name>): ...`，不要用仓库名
- **commit message 不添加 `Co-Authored-By:` / `Signed-off-by:` 等 trailer 行**
- **不跳过 hooks**——`--no-verify` / `--no-gpg-sign` 除非明确要求

---

## 检查清单

- [ ] 已识别本次 release 的单元（只有一个）
- [ ] 所有改动仅涉及该单元
- [ ] 版本号已在所有镜像文件同步到相同值
- [ ] commit scope = 单元名
- [ ] tag 格式 = `<plugin-name>-v<version>`
- [ ] 只推本次新 tag

---

## 历史遗留约束

- **禁止使用 `v<version>` 短格式 tag**——2026-04 已做过一次性迁移（40 个 token-reporter 短 tag 改名为 `token-reporter-v<version>`）
- **不打 `marketplace-v*` tag**——marketplace 自版本化已于 2026-04 移除，`.claude-plugin/marketplace.json` 不再有 `metadata.version` 字段
- **推送用 `git push origin <tag-name>` 不用 `git push --tags`**——多插件仓库下会误推 WIP tag

---

## 故障排查

- **tag 已存在** → 检查是否重复 release；必要时 `git tag -d <tag>` 删本地 + `git push origin :<tag>` 删远端
- **push 被 pre-push hook 阻断** → 查 `scripts/check-version.cjs` 的输出，通常是镜像版本不一致或 tag 冲突
- **镜像文件版本不一致** → 运行 `node scripts/bump-version.cjs <plugin> <version>` 会同步所有镜像
