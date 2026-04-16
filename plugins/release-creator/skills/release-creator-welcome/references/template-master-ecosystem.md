# 主模板 · 生态派骨架

环节 5 选了「维度 1 · 生态」的 release skill 使用本主模板。skill-creator 在落盘时按本模板正文 + 对应生态子模板 + `{{projectFieldsBlock}}` 拼装。

**占位符**（`{{…}}`）是 skill-creator 拼装时要替换的变量；派生出的 SKILL.md 里不应再残留 `{{…}}`。

---

## 模板正文（skill-creator 原样落入 SKILL.md 正文）

```markdown
# {{projectCode}} Release Skill（生态派）

本 skill 是 **{{projectCode}}** 项目专属的 release 流程。由 release-creator 派生生成，记录本项目在 {{timestamp}} 时刻的 release 约定。执行 release 时直接按本文步骤操作。

## 发行载体速览

| 维度             | 本项目值                      |
| ---------------- | ----------------------------- |
| 生态             | {{ecosystem}}                 |
| 版本决策哲学     | {{philosophy}}                |
| 打包粒度         | {{packaging}}                 |
| tag 格式         | {{tagFormat}}                 |
| 版本号来源       | {{versionSource}}             |
| 发布目标         | {{publishTarget}}             |

> 以上任一字段与实际情况不符 → 直接编辑本文件更新；或重跑 `/release-creator-welcome` 重新派生。

---

## 何时触发本 skill

用户说下列任一句子时触发：

- "release {{projectCode}}"
- "发布 {{projectCode}}"
- "bump {{projectCode}} 版本"
- "打 {{projectCode}} 的 tag"
- "ship it"
- "{{projectCode}} X.Y.Z"

---

## Release 步骤（按顺序执行）

### 步骤 1. 确认可发布状态

- `git status` 应 clean（或仅包含本次 release 要一起提交的改动）
- `git log` 看是否有尚未合入的改动
- 跑测试（如有）：{{testCommand}}

### 步骤 2. 决定新版本号

{{philosophyBlock}}

### 步骤 3. bump 版本号

{{bumpBlock}}

### 步骤 4. 单次 commit（代码改动 + 版本 bump 合并）

```
git add <specific paths>
git commit -m "chore({{projectCode}}): bump version to X.Y.Z"
```

或混合 commit：

```
git commit -m "feat({{projectCode}}): <description>

includes version bump to X.Y.Z"
```

### 步骤 5. 打 tag

{{tagBlock}}

### 步骤 6. push

- `git push origin main`
- `git push origin <tag-name>`（**不要用 `git push --tags`**，会推送所有本地 WIP tag）

---

## 硬性约束

- **一个 commit = 代码改动 + 版本 bump**（不分两个 commit）
- **tag 格式固定**：{{tagFormat}}，其他格式的 tag 不要新建
- **不跳过 hooks**（`--no-verify` / `--no-gpg-sign` 除非明确要求）
- **commit message 用 conventional commit 格式**，禁止 `Co-Authored-By:` / `Signed-off-by:` 等 trailer
- **push 只推本次新 tag**，不要 `--tags`

---

## 完整检查清单

- [ ] 目标发行单元已识别（本项目：{{packaging}}）
- [ ] 所有改动已 commit 或准备合入本次 release commit
- [ ] 测试通过（如有）
- [ ] 版本号已 bump 到 {{versionFiles}}（**全部文件版本一致**）
- [ ] commit message 符合约定
- [ ] tag 格式符合约定
- [ ] 只推了本次新 tag（无 `--tags`）

---

## 故障排查

- **tag 已存在** → 检查是否重复 release；必要时 `git tag -d <tag>` 删本地 + `git push origin :<tag>` 删远端
- **push 被 pre-push hook 阻断** → 查 `.git/hooks/pre-push`，通常是版本检查未通过
- **镜像文件版本不一致** → 运行 {{bumpCommand}} 会同步所有镜像

{{projectFieldsBlock}}
```

---

## 拼装点

skill-creator 按 `{{projectAnswers}}` 替换占位符，**不需要保留原始的 `{{…}}` 语法**——派生出的 SKILL.md 里应当全是实值（或 `TODO:` 占位）。

具体替换：

| 占位符                     | 来源                                                  |
| -------------------------- | ----------------------------------------------------- |
| `{{projectCode}}`          | 环节 7.1                                              |
| `{{timestamp}}`            | welcome 派生时的 ISO 日期                             |
| `{{ecosystem}}`            | 环节 6（dimension-1 第 2 节）                         |
| `{{philosophy}}`           | 推导默认 / override                                    |
| `{{packaging}}`            | 推导默认 / override                                    |
| `{{tagFormat}}`            | 推导默认 / override                                    |
| `{{versionSource}}`        | 环节 6（生态子问：版本号位置）                        |
| `{{publishTarget}}`        | 环节 6（生态子问：发布目标）                          |
| `{{testCommand}}`          | 环节 6 或 `TODO:` 占位                                |
| `{{philosophyBlock}}`      | 对应 `template-philosophy-*.md` 子模板                |
| `{{bumpBlock}}`            | 对应 `template-ecosystem-*.md` 的 bump 段             |
| `{{bumpCommand}}`          | 上一项中的命令                                        |
| `{{tagBlock}}`             | 对应 `template-tag-*.md` 子模板                       |
| `{{versionFiles}}`         | 需要同步 version 的文件列表（来自 ecosystem 子模板）  |
| `{{projectFieldsBlock}}`   | 环节 6 + 环节 8 的所有字段汇总（用 `- 字段：值` 格式）|
