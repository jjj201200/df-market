# 主模板 · 哲学派骨架

环节 5 选了「维度 2 · 哲学」的 release skill 使用本主模板。与生态派不同，哲学派把「版本决策逻辑」放在正文最前，发行步骤围绕哲学组织。

---

## 模板正文

```markdown
# {{projectCode}} Release Skill（哲学派）

本 skill 是 **{{projectCode}}** 项目专属的 release 流程。核心决策逻辑：**{{philosophy}}**（由 release-creator 于 {{timestamp}} 派生）。

## 版本决策哲学：{{philosophy}}

{{philosophyBlock}}

## 辅助维度速览

| 维度             | 本项目值                      |
| ---------------- | ----------------------------- |
| 生态             | {{ecosystem}}                 |
| 打包粒度         | {{packaging}}                 |
| tag 格式         | {{tagFormat}}                 |
| 发布目标         | {{publishTarget}}             |

---

## 何时触发本 skill

- "release {{projectCode}}"
- "发布 {{projectCode}}"
- "bump {{projectCode}}"
- "ship it"
- "{{projectCode}} X.Y.Z"

---

## Release 步骤

### 步骤 1. 确定新版本号

这是哲学派的核心——**必须先按哲学推导版本号**，再做其他动作。

{{decisionBlock}}

### 步骤 2. 做前置检查

- `git status` clean
- 跑测试（如有）：{{testCommand}}
- 如果哲学是 `changeset`，核对 `.changeset/` 下所有文件已就位
- 如果哲学是 `commit-derived`，用 {{commitScanTool}} 预览 bump 结果

### 步骤 3. bump 版本号

{{bumpBlock}}

### 步骤 4. 单次 commit

```
git add <specific paths>
git commit -m "chore({{projectCode}}): bump version to X.Y.Z"
```

### 步骤 5. 打 tag

{{tagBlock}}

### 步骤 6. push

- `git push origin main`
- `git push origin <tag-name>`

{{changelogBlock}}

---

## 硬性约束

- **哲学一旦选定，所有 release 必须遵守**——不能某次 release 绕过规则手动 bump（除非重新派生本 skill）
- {{philosophyConstraints}}
- commit message 遵循 conventional commit，禁止 trailer 行
- push 只推本次新 tag

---

## 检查清单

- [ ] 版本号已按 `{{philosophy}}` 推导 / 确认
- [ ] 前置检查通过
- [ ] 版本号同步到所有镜像文件：{{versionFiles}}
- [ ] commit message 符合约定
- [ ] tag 格式符合约定（`{{tagFormat}}`）
- [ ] 只推本次新 tag

{{projectFieldsBlock}}
```

---

## 拼装点

| 占位符                         | 来源                                              |
| ------------------------------ | ------------------------------------------------- |
| `{{philosophy}}`               | 环节 6（dimension-2 第 2 节）                     |
| `{{philosophyBlock}}`          | 对应 `template-philosophy-*.md` 的第一段          |
| `{{decisionBlock}}`            | 对应 `template-philosophy-*.md` 的「版本号决策」段|
| `{{philosophyConstraints}}`    | 对应 `template-philosophy-*.md` 的硬性约束段      |
| `{{commitScanTool}}`           | `conventional-changelog` / `release-please-cli` / `TODO:` |
| `{{bumpBlock}}`                | 对应生态子模板                                    |
| `{{tagBlock}}`                 | 对应 tag 子模板                                   |
| `{{changelogBlock}}`           | 环节 6（CHANGELOG 决策）；无 changelog → 省略     |
| `{{versionFiles}}`             | 生态子模板给出                                    |
| 其他                           | 同 ecosystem 主模板                               |
