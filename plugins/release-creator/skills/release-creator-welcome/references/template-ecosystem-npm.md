# 生态子模板 · npm

`{{ecosystem}} = npm` 时 skill-creator 拼入本子模板。供 master 模板的 `{{bumpBlock}}` / `{{versionFiles}}` / `{{testCommand}}` 占位符使用。

---

## `{{bumpBlock}}` 内容

```markdown
使用 {{packageManager}} 内置的 version 命令：

```bash
{{packageManager}} version patch   # 1.0.0 → 1.0.1
{{packageManager}} version minor   # 1.0.0 → 1.1.0
{{packageManager}} version major   # 1.0.0 → 2.0.0
```

注意 `{{packageManager}} version` 默认会自动 commit + tag——如果本 skill 其他步骤要手动控制 commit / tag，先用 `--no-git-tag-version`：

```bash
{{packageManager}} version <patch|minor|major> --no-git-tag-version
```

或直接编辑 `package.json` > `version`：

```bash
# 手动 bump（不推荐，但有时需要）
node -e "const p=require('./package.json');p.version='{{newVersion}}';require('fs').writeFileSync('./package.json', JSON.stringify(p,null,2)+'\\n')"
```
```

## `{{versionFiles}}` 内容

```
- package.json > version
- package-lock.json > version（pnpm/yarn 对应 lock 文件会自动更新）
```

scoped / monorepo 补充：

```
- 如果是 monorepo：每个子包的 package.json 各自维护 version
```

## `{{testCommand}}` 内容

```
{{packageManager}} test
```

（无测试脚本 → 留 `TODO: 本项目未配置 test script，请补充或删除本步骤`）

## `{{publishTarget}}` 展开

| 用户选择            | 展开文本                                                         |
| ------------------- | ---------------------------------------------------------------- |
| public npm registry | `npm publish`（scoped 包加 `--access public`）                   |
| private registry    | `npm publish --registry <your-registry-url>`                     |
| GitHub release only | `gh release create <tag> --generate-notes`                       |
| 都要                | 先 `npm publish`，再 `gh release create <tag>`                   |

## 硬性约束补充

- **lock 文件要跟 package.json 一起 commit**（防止 CI 环境装出不同版本）
- **scoped 包首次发布要 `--access public`**，否则 npm 默认 restricted，装不了
- **不要用 `npm publish --force`**——会覆盖已发布版本，npm 生态禁止

## 变量

| 变量                  | 取值示例              |
| --------------------- | --------------------- |
| `{{packageManager}}`  | `npm` / `pnpm` / `yarn` |
| `{{newVersion}}`      | release 时的目标版本   |
