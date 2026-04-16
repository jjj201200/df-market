# tag 子模板 · simple（`v<version>`）

`{{tagFormat}} = v<version>` 时 skill-creator 拼入本子模板。

---

## `{{tagBlock}}` 内容

```markdown
创建 tag：

```bash
git tag v<version>
# 示例：git tag v1.2.3
```

push tag（**只推本次新 tag**，不要 `--tags`）：

```bash
git push origin v<version>
```
```

## 何时适合 simple 格式

- 仓库 = 单个发行单元（一个 npm 包 / 一个应用 / 一个插件）
- 历史上从未有过多包场景，未来短期内也不会加
- 生态约定即 `v<version>`（git 社区默认、npm `npm version` 默认、GitHub Releases 默认）

## 何时**不**适合

- 多插件 / 多包 monorepo → 改用 `prefixed` 或 `scoped`
- 想支持 `@scope/pkg@1.0.0` 的 npm scoped 包 → 改用 `scoped`

## 硬性约束补充

- **不要混用**：一旦项目用了 `v<version>`，所有 release 都用这个格式；切换到其他格式要做一次性迁移（把历史 tag 批量改名）
- **tag 不可变**：一旦 push，不要重新打同名 tag 指向不同 commit

## tag 示例

```
v1.0.0
v1.1.0
v2.0.0-rc.1
v2026.04.17  ← calver
```
