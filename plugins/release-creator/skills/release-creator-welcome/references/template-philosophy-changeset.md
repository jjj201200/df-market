# 哲学子模板 · changeset 派（Changesets 哲学）

`{{philosophy}} = changeset` 时 skill-creator 拼入本子模板。

---

## `{{philosophyBlock}}` 内容

```markdown
版本号由**手写的变更清单**决定。每个 PR 必须附一份 changeset 文件（声明本 PR 动了哪些包 + 每个包该怎么 bump）。release 时工具汇总所有未发布的 changeset，合并为一次 version bump。

PR 合并 ≠ release。release 是一个独立动作：从 `main` 跑 `changeset version` 生成版本号 + CHANGELOG + commit，再跑 `changeset publish` 发布。
```

## `{{decisionBlock}}` 内容

```markdown
### 推导新版本号

运行：

```bash
{{changesetVersionCmd}}
```

此命令会：

1. 读取 `.changeset/` 下所有未发布的 changeset
2. 聚合出每个包的新版本号
3. 更新所有 `package.json` 的 version 字段
4. 更新每个包的 CHANGELOG.md
5. 删除已消费的 changeset 文件

**检查 diff**：确认版本号 bump 符合预期，CHANGELOG 内容准确。如有问题，手动编辑或回退。
```

## `{{philosophyConstraints}}` 内容

```
- 所有 PR 必须附 changeset 文件（CI 强制 / 警告：取决于环节 6 的选择）
- 不要直接编辑 package.json 的 version 字段——让 changesets 工具做
- changeset 文件在消费后被删除，这是正常行为
- 每次 release 先 `changeset status` 看预期，再 `changeset version` 执行
```

## `{{changesetVersionCmd}}` 展开

| 工具                 | 命令                              |
| -------------------- | --------------------------------- |
| @changesets/cli      | `pnpm changeset version`（或 npm / yarn） |
| 自制 markdown 清单   | `TODO: 请补充自制 changeset 消费命令`    |

## `{{changelogBlock}}` 内容

```markdown
## CHANGELOG

CHANGELOG 由 `changeset version` 自动维护。每次 release 追加一段到每个受影响包的 `CHANGELOG.md`。

**不要手动编辑 CHANGELOG**——下次 `changeset version` 可能会覆盖你的改动。要补说明 → 在下一次 PR 的 changeset 文件里写。
```

## 监工步骤（master 模板步骤 2 前置）

```markdown
### 步骤 0. 检查未消费的 changeset

```bash
{{changesetStatusCmd}}
```

本命令会打印所有 pending changeset 及其聚合后的版本 bump 预览。**如果本命令显示 `No changesets present`**——本次不应 release。
```

## `{{changesetStatusCmd}}` 展开

- @changesets/cli → `pnpm changeset status`
- 其他 → `TODO:`

## 硬性约束补充

- **一次 release 消费所有未发布的 changeset**——不能选择性 release 部分（如果想分批 release，那就对应写多份 changeset 且分多次 `changeset version`）
- **PR 的 changeset 文件命名随意**，工具自动识别
- **monorepo 场景**：changeset 文件声明「哪些包该 bump」——一个 changeset 可以影响多个包
