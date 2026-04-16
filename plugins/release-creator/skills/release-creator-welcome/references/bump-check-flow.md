# 环节 6.5 · Bump + Check 子环节 flow

环节 6 分维度追问跑完后、环节 7 通用参数之前，**所有维度**都必须走一遍本 flow。穷举派（dimension-4）把本 flow 的 6 道题作为其第四轮前半强制展示；其他维度走去重规则跳过继承字段。

本 flow 的输出合入 `{{projectAnswers}}`：

- `versionStructure` / `versionRegex`（Q1）
- `bumpTrigger`（Q2） / `bumpScope`（Q3，仅 monorepo）
- `checkScope[]`（Q4 多选） / `checkTiming`（Q5） / `extraMirrorFiles[]`（Q6）

---

## 1. 去重快速通道（进入前检查）

根据已有 `{{projectAnswers}}` 判断跳过哪些题：

| 题  | 跳过条件                                                | 继承值                    |
| --- | ------------------------------------------------------- | ------------------------- |
| Q1  | `philosophy.versionRule` 已设                           | 继承到 `versionStructure` |
| Q2  | `philosophy = ci-auto`                                  | 设 `bumpTrigger = ci-derived` |
| Q3  | `packaging != monorepo`                                 | 整题跳过                  |
| Q4·`tests-pass` | 生态维度 `testCommand` 已设               | 预选该项                  |
| Q5  | `philosophy = commit-derived` 且 `bumpTrigger = ci-derived` | 默认 `ci`             |
| Q6  | 非 claude-plugin 且 `versionFiles.length == 1`          | 整题跳过                  |

穷举派（dimension-4）即使命中跳过条件也**强制展示**，继承值作为 option 第一位。

---

## 2. 预扫补充

进入 6.5 前做一次轻量补扫（若前序维度已做则复用）：

- Read `<repo>/package.json` → 若缺 `version` 字段 → Q1 展示警告
- Glob `<repo>/scripts/bump*` / `<repo>/scripts/check*` → 若命中 → Q2 默认选「`ecosystem-cli`」时在描述里加一行「检测到你有现成 bump 脚本，但本 flow 建议由 skill-creator 重新生成标准化版本——旧脚本可保留备用」
- Bash `git tag --list | head -5` → 若 tag 格式像 `YYYY.MM.DD` → Q1 默认选 `calver-ymd`

---

## 3. 轮 A 问题（单选 × 3）

一次 AUQ 调用发起三问：

```json
{
  "questions": [
    {
      "question": "版本号结构？",
      "header": "Version",
      "multiSelect": false,
      "options": [
        {
          "label": "SemVer (major.minor.patch)",
          "description": "最常见。正则 ^\\d+\\.\\d+\\.\\d+$。哲学=commit-derived 默认选此"
        },
        {
          "label": "CalVer (YYYY.MM.DD)",
          "description": "按日期。正则 ^\\d{4}\\.\\d{2}\\.\\d{2}$"
        },
        {
          "label": "CalVer (YY.MM.X)",
          "description": "年月 + 月内序号。正则 ^\\d{2}\\.\\d{2}\\.\\d+$"
        },
        {
          "label": "单调递增 (serial)",
          "description": "纯数字。正则 ^\\d+$"
        }
      ]
    },
    {
      "question": "Bump 触发方式？",
      "header": "Bump",
      "multiSelect": false,
      "options": [
        {
          "label": "生态原生 CLI",
          "description": "npm version / poetry version / hatch version。派生 SKILL.md 直接写命令，不生成专用脚本"
        },
        {
          "label": "手动编辑 + grep/diff 验证",
          "description": "派生 SKILL.md 写步骤，不生成脚本"
        },
        {
          "label": "生成专用 bump 脚本",
          "description": "由 skill-creator 按 bump-catalog 骨架动态生成脚本本体落盘（claude-plugin 多镜像默认选此）"
        },
        {
          "label": "CI 自动（semantic-release / release-please）",
          "description": "版本由 CI 推导。skill-creator 不落本地 bump 脚本，但会落 CI yaml"
        }
      ]
    },
    {
      "question": "Bump 范围（仅 monorepo 场景）？",
      "header": "Scope",
      "multiSelect": false,
      "options": [
        { "label": "单包独立", "description": "一次只 bump 一个包（df-market / 多插件仓库典型）" },
        { "label": "批量同步", "description": "所有包版本号永远一致" },
        { "label": "按 changeset 选中项", "description": "Changesets / nx release 的默认模式" }
      ]
    }
  ]
}
```

第四个 option「不 bump，每次临时指定」作为 Q2 的 Other 展开（用户选 Other 后 free-text 确认）。

Q3 若命中去重跳过条件，本次 AUQ 只发 Q1 + Q2 两问。

---

## 4. 轮 B 问题（多选 × 1 + 单选 × 2）

```json
{
  "questions": [
    {
      "question": "Check 范围（多选，建议至少勾 2 项）？",
      "header": "Check",
      "multiSelect": true,
      "options": [
        {
          "label": "多文件版本镜像一致性",
          "description": "claude-plugin / versionFiles>=2 默认必选"
        },
        {
          "label": "目标 tag 是否已存在",
          "description": "避免重复打 tag"
        },
        {
          "label": "工作区版本文件无未 commit 改动",
          "description": "bump 后 commit 前跑会失败——注意顺序"
        },
        {
          "label": "本次变更包含版本修改",
          "description": "philosophy=commit-derived 默认必选"
        }
      ]
    },
    {
      "question": "Check 时机？",
      "header": "Timing",
      "multiSelect": false,
      "options": [
        {
          "label": "仅内嵌 release skill checklist",
          "description": "release 时 skill 引导手动跑。最轻，不落额外文件（推荐默认）"
        },
        {
          "label": "生成 pre-push hook",
          "description": "skill-creator 落 <hookLocation>/pre-push + scripts/check-version.*；随后会追问 hook 落盘位置"
        },
        {
          "label": "生成 pre-commit hook",
          "description": "同上，但 bump-in-diff 会被过滤（不适合 pre-commit）"
        },
        {
          "label": "生成 CI workflow",
          "description": "落 .github/workflows/release-check.yml"
        }
      ]
    },
    {
      "question": "镜像字段是否复用生态维度登记？",
      "header": "Mirror",
      "multiSelect": false,
      "options": [
        {
          "label": "复用",
          "description": "沿用生态维度 {{versionFiles}}"
        },
        {
          "label": "补充额外镜像",
          "description": "走 free-text 追加文件路径 + JSON/TOML/字段路径"
        }
      ]
    }
  ]
}
```

Q4 中的「版本正则合规」和「测试/lint 通过」作为默认预选项不出现在显式选项里，由 skill-creator 在组装时自动追加：

- `regex-compliance` → 始终追加（因为 Q1 必给出 regex）
- `tests-pass` → 当 `testCommand != TODO:` 时追加

Q6 若命中去重跳过条件，本次 AUQ 只发 Q4 + Q5 两问。

---

## 4.1 Q5 子问：hook 落盘位置（仅当 Q5 ∈ {pre-push-hook, pre-commit-hook} 时发起）

用户 Q5 选了 hook 类时，追加一次单独 AUQ 采集 `{{hookLocation}}`：

```json
{
  "question": "Hook 文件落盘到哪里？",
  "header": "Hook path",
  "multiSelect": false,
  "options": [
    {
      "label": ".git/hooks/",
      "description": "git 原生路径。无需额外配置，但 hook 不会随 clone 传播（单人仓库 / 不想让协作者自动受 hook 约束时推荐）"
    },
    {
      "label": ".githooks/",
      "description": "版本化 hook（会 commit 到仓库）。需要每位 clone 者各自执行 git config core.hooksPath .githooks 启用"
    },
    {
      "label": ".husky/",
      "description": "已使用 Husky 框架的 npm 项目。npm install 后自动 setup，无需 git config"
    }
  ]
}
```

### 默认值推导

welcome 在发起本问之前按下表预高亮默认选项：

| 仓库现状预扫                                        | 默认 `{{hookLocation}}` |
| --------------------------------------------------- | ----------------------- |
| `{{ecosystem}} ∈ {npm, pnpm, yarn}` 且存在 `.husky/` | `.husky/`               |
| 仓库已存在 `.githooks/` 目录                        | `.githooks/`            |
| 其他（无现成 hook 目录）                            | `.git/hooks/`           |

### 与既有 hook 的冲突提示

若默认位置已存在同名 hook 文件（常见于 `.git/hooks/pre-push`），AUQ 的选项 description 里追加一行提示：「⚠️ `.git/hooks/pre-push` 已存在，落盘时会触发冲突 AUQ（覆盖 / 跳过 / 改名）」。

Q5 选 `inline` / `ci` / `none` → 本子问整段跳过，`{{hookLocation}}` 不设值。

---

## 5. 默认值推导表

skill-creator 在组装阶段按下表填充默认/继承值：

| `{{projectAnswers}}` 字段 | 默认值来源                                           |
| ------------------------- | ---------------------------------------------------- |
| `versionStructure`        | Q1 选项 label；若继承 `philosophy.versionRule` 则继承 |
| `versionRegex`            | Q1 选项描述内的正则；Other 走 free-text              |
| `bumpTrigger`             | Q2 选项 label（`ecosystem-cli` / `manual` / `generate-script` / `ci-derived` / `manual-prompt`）|
| `bumpScope`               | Q3 label；非 monorepo 时为 `single`                  |
| `checkScope[]`            | Q4 多选 + `regex-compliance` 自动追加 + 条件追加 `tests-pass`|
| `checkTiming`             | Q5 label                                             |
| `hookLocation`            | Q5 子问（仅 hook 时机）；按预扫默认；`inline`/`ci`/`none` 时为空 |
| `extraMirrorFiles[]`      | Q6 走 free-text 追加；复用则为空                     |

---

## 6. 异常处理

- 用户在本 flow 中途选「放弃」→ 已采集字段以 TODO: 保留，仍推进到环节 7（不中止整个派生流程）
- Q4 一项都没勾 + 未追加 → AUQ 重发一次，提示「至少选 1 项或选『不自动检查（Other）』」
- Q2 选「生成专用 bump 脚本」但 `versionFiles` 为空 → 阻断追问，要求补 `versionFiles` 再往下走
- Q5 选「生成 CI workflow」但仓库非 GitHub → 见 `hook-templates.md` 第 4 节处理

---

## 7. 输出

6.5 结束时，`{{projectAnswers}}` 追加下述字段：

```
versionStructure: semver | calver-ymd | calver-ym-serial | serial | <custom>
versionRegex: <regex string>
bumpTrigger: ecosystem-cli | manual | generate-script | manual-prompt | ci-derived
hookLocation: .git/hooks/ | .githooks/ | .husky/ | <empty when timing=inline/ci/none>
bumpScope: single | monorepo-isolated | monorepo-sync | monorepo-changeset
checkScope: [mirror-consistency, tag-conflict, workdir-clean, bump-in-diff, regex-compliance, tests-pass]
checkTiming: inline | pre-push-hook | pre-commit-hook | ci | none
extraMirrorFiles: []
```

这些字段由环节 9 的 skill-creator 按 `bump-catalog.md` / `check-catalog.md` / `hook-templates.md` 查表组装落盘。
