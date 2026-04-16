# 哲学子模板 · manual 派（人工指定）

`{{philosophy}} = manual` 时 skill-creator 拼入本子模板。manual 是最简单也最脆弱的哲学——完全依赖维护者的 release 纪律。

---

## `{{philosophyBlock}}` 内容

```markdown
版本号**由维护者直接指定**。每次 release 前人工决定新版本号（semver / calver / serial），commit message 和 PR 流程不绑定版本决策。

本项目规则：**{{versionRules}}**

依赖维护者经验和纪律——没有工具兜底。为了补偿这一点，本 skill 的「检查清单」会刻意更长。
```

## `{{decisionBlock}}` 内容

```markdown
### 指定新版本号

查看当前版本：

```bash
{{currentVersionCmd}}
```

查看自上次 release 以来的 commit：

```bash
git log {{lastTag}}..HEAD --oneline
```

按 **{{versionRules}}** 规则指定新版本号。记下它作为 `X.Y.Z`。

**决策 rubric**（仅供参考，最终由维护者判断）：

- 有不兼容 API 改动 → major
- 有向后兼容的新功能 → minor
- 只有 bug 修复 → patch
- 只有文档 / 内部重构 → patch 或不 release

> 本 rubric 是 semver 的朴素版；如果本项目用 calver / serial / 其他规则，替换为对应语义。
```

## `{{philosophyConstraints}}` 内容

```
- 版本号由维护者最终拍板，但 release 前必须做「{{checklist}}」
- 版本号一旦决定且 push，不可回退——要撤销只能发新版本
- 跨维护者 release 前需通知同步，避免版本号冲突
- 长时间没 release（>3 月）的项目在下次 release 前应走一遍完整 checklist
```

## `{{versionRules}}` 展开

根据 `{{projectAnswers}}` 里第一问：

| 用户选择     | 展开                                     |
| ------------ | ---------------------------------------- |
| semver       | `semantic versioning（MAJOR.MINOR.PATCH）` |
| calver       | `calendar versioning（YYYY.MM.DD 或 YY.MM）` |
| serial       | `serial（v1, v2, v3 单调递增）`            |
| 其他         | `TODO: 请补充本项目的版本规则`             |

## `{{currentVersionCmd}}` 展开

根据 `{{ecosystem}}`：

| 生态            | 命令                                              |
| --------------- | ------------------------------------------------- |
| npm             | `node -p 'require(\"./package.json\").version'`    |
| Python          | `python -c 'import tomllib; print(tomllib.load(open(\"pyproject.toml\",\"rb\"))[\"project\"][\"version\"])'` 或 `grep version pyproject.toml` |
| Claude plugin   | `node -p 'require(\"./plugins/<name>/.claude-plugin/plugin.json\").version'` |
| docs            | `git describe --tags --abbrev=0`                   |

## `{{lastTag}}` 展开

- 动态：`$(git describe --tags --abbrev=0)`
- 或者让派生出的 skill 里留占位，每次 release 替换

## `{{checklist}}` 展开（合并到检查清单）

```
- [ ] 已对照变更决定 bump 类型（major / minor / patch）
- [ ] 新版本号写入所有镜像文件
- [ ] CHANGELOG 手动追加本版本说明
- [ ] PR 已合并或改动已 commit
- [ ] commit message 符合 conventional commits 约定
- [ ] tag 格式正确
- [ ] 只推本次新 tag
```

## 硬性约束补充

- **manual 哲学最大的风险是漏更新镜像文件**——每次 release 必须手动 diff 所有 version 字段
- **不要批量 release 多个包**——单次只 release 一个，降低版本号选错的风险
- **维护者更替要更新 CLAUDE.md 或 README 的 release 部分**——manual 流程完全依赖口传心授
