# 生态子模板 · Claude Code plugin

`{{ecosystem}} = claude-plugin` 时 skill-creator 拼入本子模板。Claude plugin 场景的典型特征：**双文件 version 镜像**（plugin.json + marketplace.json）、tag 命名**必须** `<plugin>-v<version>` 避免多插件仓库 tag 冲突。

---

## `{{versionFiles}}` 内容（供 6.5 Q6 默认值 + `bump-catalog` / `check-catalog` 消费）

```
- plugins/<plugin-name>/.claude-plugin/plugin.json > version
- .claude-plugin/marketplace.json > plugins[name=<plugin-name>].version
```

**两个文件必须保持相同版本字符串**，一致性由 6.5 Q4 勾选的「镜像一致性」检查项强制。

## Bump 章节（`{{bumpBlock}}` 来源）

本子模板**不硬编码** bump 命令——实际命令由 6.5 Q2 的选择 + `bump-catalog.md` 查表生成。典型路径：

- 6.5 Q2 = `generate-script` → `bump-catalog.md §3.cjs` 骨架（`claude-plugin` + `cjs` 组合最常见）
- 6.5 Q2 = `manual` → `bump-catalog.md §2`（手动编辑 + grep/diff 验证）

**Claude plugin 多镜像场景默认推荐 `generate-script`**——手动同步双文件易漏，脚本化更安全；若用户坚持 `manual`，派生 SKILL.md 的 `{{bumpBlock}}` 里保留 grep/diff 验证步骤。

## `{{testCommand}}` 内容

根据 `{{projectAnswers}}` 里是否有测试脚本决定：

- 有 → 对应命令（如 `node test/test-hooks.js`）
- 无 → `TODO: 本插件未配置测试命令`

## `{{publishTarget}}` 展开

Claude plugin 没有 registry，发行 = git tag + push（marketplace 里 plugin 条目的 version 被更新后，用户拉新 tag 就能装上新版）。

```
git push origin main
git push origin <plugin-name>-v<version>
```

## `{{tagFormat}}` 强制

Claude plugin 多插件仓库**必须**用 `<plugin-name>-v<version>`，**不要**用 `v<version>`——单个 `vX.Y.Z` 在多插件仓库里不知道指哪个插件。

即使当前是单插件仓库，也**推荐**用 `<plugin-name>-v<version>`，为未来加插件留余地。

## 硬性约束补充

- **plugin.json 和 marketplace.json 镜像的 version 字段必须完全一致**——不一致即版本漂移（由 6.5 `mirror-consistency` 检查强制）
- **tag 格式**：`<plugin-name>-v<version>`（不要用短 `v<version>`）
- **只推本次新 tag**：`git push origin <plugin-name>-v<version>`，不要 `git push --tags`
- **commit scope = plugin name**：`chore(<plugin-name>): bump version to X.Y.Z`
- **不要删除别的插件的历史 tag**——多插件仓库里每个插件自维护版本线

## 变量

| 变量                   | 来源                                                                  |
| ---------------------- | --------------------------------------------------------------------- |
| `{{versionFiles}}`     | 本子模板固定为双文件镜像；可被 6.5 Q6 追加                            |
| `{{bumpCommand}}`      | 6.5 Q2 + `bump-catalog.md` 查表动态生成（命令行文本）                 |
| `{{bumpBlock}}`        | 整个 Bump 章节正文，由 `bump-catalog.md` 对应章节展开而来             |
| `{{scriptsDir}}`       | 环节 7.4（例：`scripts/`），`bumpTrigger = generate-script` 时使用    |
| `{{tagFormat}}`        | `<plugin-name>-v<version>`（由 `template-tag-prefixed.md` 管辖）      |

## 说明：为什么把 bump 细节移出本子模板

旧版本的本子模板硬编码了 `{{bumpScript}} = node plugins/<plugin-name>/scripts/bump-version.cjs`，假设所有 Claude plugin 项目都用 Node.js 手写脚本。新版本把"是否生成脚本 / 用什么语言 / 落在哪里"的决策移到 6.5 统一采集，带来两个好处：

1. 其他语言栈的 Claude plugin 项目（例如用 bash / Python 维护版本）也能走本子模板
2. 脚本文件由 skill-creator 按 `bump-catalog.md` 动态生成，不再依赖项目里预先放好的 bump 脚本
