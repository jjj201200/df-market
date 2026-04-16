# tag 子模板 · prefixed（`<name>-v<version>`）

`{{tagFormat}} = <name>-v<version>` 时 skill-creator 拼入本子模板。多包 monorepo / 多插件仓库推荐此格式。

---

## `{{tagBlock}}` 内容

```markdown
创建 tag（**必须**带 name 前缀）：

```bash
git tag <name>-v<version>
# 示例（df-market）：
# git tag token-reporter-v2.9.9
# git tag skill-keeper-v0.1.2
```

push tag：

```bash
git push origin <name>-v<version>
```

**严禁使用 `git push --tags`**——多包仓库下会把其他包的 WIP tag 一起推上去。
```

## 何时适合 prefixed 格式

- 多插件 / 多包 monorepo（df-market 即典型）
- 每个子包独立版本线演进
- 想在 GitHub Releases 页面按「插件 / 包」过滤 release

## 硬性约束补充

- **name 前缀必须 = 该发行单元的 name**（plugin.json > name，或 package.json > name 去 scope）
- **禁止使用短 `v<version>`**——`vX.Y.Z` 单个 tag 在多包仓库里不知道指哪个包
- **历史迁移**：如果项目从 `v<version>` 迁移到 `<name>-v<version>`，应当做一次性批量改名（本仓库 2026-04 做过 token-reporter 的 40 个 tag 迁移）
- **tag 不可变**：push 后不要重新打同名

## tag 示例

```
token-reporter-v2.9.9
skill-keeper-v0.1.2
release-creator-v0.1.0
core-v1.2.3
cli-v0.5.0
```

## 与 commit scope 的对应

commit message 的 scope 应当与 tag 前缀一致：

```
chore(token-reporter): bump version to 2.9.9
chore(skill-keeper): bump version to 0.1.2
```

这样 `git log --grep` 和 `git tag --list '<name>-*'` 能对上号。
