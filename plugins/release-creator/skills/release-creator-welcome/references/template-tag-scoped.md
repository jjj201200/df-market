# tag 子模板 · scoped（`@scope/pkg@<version>`）

`{{tagFormat}} = @scope/pkg@<version>` 时 skill-creator 拼入本子模板。npm scoped monorepo（Changesets / Lerna / Nx 典型）使用此格式。

---

## `{{tagBlock}}` 内容

```markdown
创建 tag（保留 `@scope/` 前缀与 `@version` 分隔符）：

```bash
git tag @scope/pkg@<version>
# 示例：
# git tag @acme/core@1.2.3
# git tag @acme/cli@0.5.0
```

**tag 名里包含 `@` 和 `/`，在 shell 里传递时注意引号**：

```bash
# zsh / bash 里 @ 和 / 通常安全，但稳妥起见加引号：
git tag "@acme/core@1.2.3"
git push origin "@acme/core@1.2.3"
```

**严禁 `git push --tags`**——多包仓库禁忌。
```

## 何时适合 scoped 格式

- npm scoped monorepo（@scope/*）
- 用 Changesets / Lerna / Nx 管理发行
- 希望 tag 名与 npm registry 上的发布记录（`@acme/core@1.2.3`）一一对应

## 硬性约束补充

- **tag 名结构**：`@<scope>/<pkg>@<version>`，三段缺一不可
- **tag 内含 `@` 和 `/`**：部分 CI 或 webhook 的 URL 编码可能出问题——出问题时 URL-encode（`%40` / `%2F`）
- **Changesets 自动打 tag 时就是这个格式**——不需要手动打，但要检查 `changeset publish` 输出的 tag 名
- **与 GitHub Releases 页面**：UI 对 `@scope/pkg@1.2.3` 能正常显示，但搜索 `v1.2.3` 过滤不到

## tag 示例

```
@acme/core@1.2.3
@acme/cli@0.5.0
@acme/utils@2.0.0-rc.1
```

## 与 Changesets 的关系

Changesets `publish` 命令会**自动打 tag**，格式就是 scoped。如果用 Changesets，本 skill 的 tag 步骤通常不需要手动执行——`changeset publish` 会做完：

```bash
pnpm changeset publish
# 这一步会：
# 1. 按各包 package.json 的 version 发布到 npm
# 2. 自动打 tag（格式：@scope/pkg@<version>）
# 3. 可选推送 tag（通过 changeset config）
```

本 skill 里要检查的是：**push 命令是否覆盖所有新 tag**，否则 npm 发布了但 GitHub 上没 tag 会造成不一致。

```bash
# Changesets 默认只创建本地 tag，需要手动 push：
git push --follow-tags origin main
# 或逐条 push：
git push origin "@acme/core@1.2.3"
git push origin "@acme/cli@0.5.0"
```

## 与 commit 的对应

commit message 的 scope：

```
chore(core): bump to 1.2.3
chore(cli): bump to 0.5.0
```

（Changesets 的 PR 合并 commit 通常是 `chore: version packages`——聚合，scope 空。）
