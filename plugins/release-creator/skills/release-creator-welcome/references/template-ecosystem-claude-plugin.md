# 生态子模板 · Claude Code plugin

`{{ecosystem}} = claude-plugin` 时 skill-creator 拼入本子模板。Claude plugin 场景的典型特征：**双文件 version 镜像**（plugin.json + marketplace.json）、tag 命名**必须** `<plugin>-v<version>` 避免多插件仓库 tag 冲突。

---

## `{{bumpBlock}}` 内容

```markdown
两个文件必须保持相同版本字符串：

1. `plugins/<plugin-name>/.claude-plugin/plugin.json > version`
2. `.claude-plugin/marketplace.json > plugins[].version`（对应 entry）

优先用 bump 脚本（如果有）：

```bash
{{bumpScript}}
# 或指定 bump 类型
{{bumpScript}} patch
{{bumpScript}} minor
{{bumpScript}} major
```

没有 bump 脚本时：手动编辑两个 JSON 文件，改动后执行 diff 验证两值一致：

```bash
grep -n '"version"' plugins/<plugin-name>/.claude-plugin/plugin.json
grep -n '"version"' .claude-plugin/marketplace.json
```
```

## `{{versionFiles}}` 内容

```
- plugins/<plugin-name>/.claude-plugin/plugin.json > version
- .claude-plugin/marketplace.json > plugins[].version（对应 entry）
```

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

- **plugin.json 和 marketplace.json 镜像的 version 字段必须完全一致**——不一致即版本漂移
- **tag 格式**：`<plugin-name>-v<version>`（不要用短 `v<version>`）
- **只推本次新 tag**：`git push origin <plugin-name>-v<version>`，不要 `git push --tags`
- **commit scope = plugin name**：`chore(<plugin-name>): bump version to X.Y.Z`
- **不要删除别的插件的历史 tag**——多插件仓库里每个插件自维护版本线

## 变量

| 变量             | 取值示例                                                  |
| ---------------- | --------------------------------------------------------- |
| `{{bumpScript}}` | `node plugins/<plugin-name>/scripts/bump-version.cjs` 或 `TODO:` |
