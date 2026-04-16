# 主模板 · 打包派骨架

环节 5 选了「维度 3 · 打包 + tag」的 release skill 使用本主模板。打包派把「识别目标发行单元 + 决定 tag」放在正文最前，适合多包 monorepo。

---

## 模板正文

```markdown
# {{projectCode}} Release Skill（打包派）

本 skill 是 **{{projectCode}}** 项目专属的 release 流程。核心决策逻辑：**{{packaging}}** + **{{tagFormat}}** tag 格式（由 release-creator 于 {{timestamp}} 派生）。

## 发行单元拓扑

- 打包粒度：**{{packaging}}**
- tag 格式：**{{tagFormat}}**
- 发行单元清单：{{unitList}}

> 多包 monorepo：一次 release 动一个或一批发行单元，每个单元独立版本号。改动涉及哪个单元就 release 哪个；无跨单元批量时，不要「顺带」bump 无关单元。

---

## 辅助维度速览

| 维度             | 本项目值                      |
| ---------------- | ----------------------------- |
| 生态             | {{ecosystem}}                 |
| 版本决策哲学     | {{philosophy}}                |
| 镜像同步文件     | {{mirrorFiles}}               |
| bump 命令        | {{bumpCommand}}               |

---

## 何时触发本 skill

- "release {{projectCode}}"
- "release <unit-name>"
- "发布 <unit-name> 到 X.Y.Z"
- "bump <unit-name>"
- "打 <unit-name> 的 tag"

---

## Release 决策（每次 release 开头必答）

在执行任何命令前，先回答这三问：

### 问 1. 本次 release 的**发行单元**是哪个？

对照「发行单元拓扑」章节的清单。如果改动横跨多个单元，**拆成多个 release**（每个单元一个 commit + 一个 tag），不要合并。

### 问 2. 目标版本号是？

{{philosophyBlock}}

### 问 3. 新 tag 名是？

按 `{{tagFormat}}` 格式：**{{tagExample}}**

---

## Release 步骤

### 步骤 1. 前置检查

- `git status` clean
- 跑测试（如有）：{{testCommand}}
- 确认没有其他单元的改动混入本次 release 的 staged 文件

### 步骤 2. bump 版本号

{{bumpBlock}}

**必须同步所有镜像文件**：
{{mirrorFilesBlock}}

### 步骤 3. 单次 commit

```
git add <仅本单元相关路径>
git commit -m "chore(<unit-name>): bump version to X.Y.Z"
```

### 步骤 4. 打 tag

{{tagBlock}}

### 步骤 5. push

- `git push origin main`
- `git push origin <tag-name>`（**不要 `git push --tags`**）

---

## 硬性约束

- **一次 release 一个发行单元**——涉及多个单元 → 拆 release
- **tag 格式严格按 `{{tagFormat}}`**——禁止使用已废弃或非约定格式
- **镜像文件必须同步**：{{mirrorFiles}}，任何一处没跟上即版本漂移
- **不用 `git push --tags`**——会推送所有本地 WIP tag
- **commit scope 必须是单元名**——`chore(<unit-name>): ...`，不要用仓库名

---

## 检查清单

- [ ] 已识别本次 release 的单元（只有一个）
- [ ] 所有改动仅涉及该单元
- [ ] 版本号已在所有镜像文件同步到相同值
- [ ] commit scope = 单元名
- [ ] tag 格式 = `{{tagFormat}}`
- [ ] 只推本次新 tag

---

## 历史遗留约束

{{historicalConstraints}}

{{projectFieldsBlock}}
```

---

## 拼装点

| 占位符                         | 来源                                                  |
| ------------------------------ | ----------------------------------------------------- |
| `{{packaging}}`                | 环节 6（dimension-3 第 2 节）                         |
| `{{tagFormat}}`                | 环节 6（dimension-3 第 3 节）                         |
| `{{unitList}}`                 | 预扫出的 `plugins/*/` / `packages/*/` 清单，或 `TODO:`|
| `{{tagExample}}`               | 用 tagFormat + 一个假设版本号做示例，如 `token-reporter-v2.9.9` |
| `{{mirrorFiles}}`              | 环节 6（dimension-3 第 4 节：镜像文件清单）           |
| `{{mirrorFilesBlock}}`         | `mirrorFiles` 展开为逐项 checklist                    |
| `{{bumpCommand}}`              | 环节 6（dimension-3 第 4 节第三问）                   |
| `{{historicalConstraints}}`    | 环节 6 / 环节 8 采集的历史遗留注意事项，无则省略      |
| 其他                           | 同 ecosystem 主模板                                   |
