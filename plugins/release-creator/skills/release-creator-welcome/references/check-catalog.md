# Check 检查项片段库（环节 6.5 Q4 使用）

每个检查项提供三种宿主展开：

- **bash** —— 直接嵌入 check 脚本
- **hook** —— 作为 pre-push / pre-commit hook 的一步
- **ci** —— GitHub Actions yaml step

skill-creator 按用户在 Q4 的多选 + Q5 的宿主选择，挑出对应展开写入派生资产。

---

## 变量说明

| 变量                 | 来源                  |
| -------------------- | --------------------- |
| `{{versionFiles}}`   | 生态 / 6.5 Q6         |
| `{{versionRegex}}`   | 6.5 Q1                |
| `{{tagFormat}}`      | tag 子模板            |
| `{{packageName}}`    | 生态维度              |
| `{{testCommand}}`    | 生态维度              |

---

## 1. `mirror-consistency`（多文件版本镜像一致性）

**默认必选**当 `{{versionFiles}}.length >= 2`（典型：claude-plugin）。

### bash

```bash
check_mirror() {
  local vals=()
  {{#each versionFiles}}
  vals+=("$(node -e "const d=require('./{{this.path}}'); const p='{{this.jsonPath}}'; /* resolveJsonPath 内联 */ console.log(d.version || p.split('.').reduce((a,s)=>a[s],d))")")
  {{/each}}
  local first="${vals[0]}"
  for v in "${vals[@]}"; do
    [ "$v" = "$first" ] || { echo "❌ 版本镜像漂移: ${vals[*]}" >&2; return 1; }
  done
  echo "✅ mirror OK ($first)"
}
check_mirror || exit 1
```

### hook

同 bash，作为 hook 的一个调用段。

### ci

```yaml
- name: Check version mirror consistency
  run: |
    node -e "
      const files = {{versionFilesJSON}};
      const vals = files.map(f => {/* 读文件 + resolveJsonPath */});
      if (new Set(vals).size !== 1) { console.error('mirror drift:', vals); process.exit(1); }
    "
```

**Exit code**: 1 = 漂移，0 = 一致。

---

## 2. `tag-conflict`（目标 tag 是否已存在）

### bash

```bash
check_tag_conflict() {
  local tag="{{tagFormat}}"  # skill-creator 展开为具体格式，如 '{{packageName}}-v${VER}'
  if git rev-parse "$tag" >/dev/null 2>&1; then
    echo "❌ tag $tag 已存在" >&2
    return 1
  fi
  echo "✅ tag $tag 可用"
}
check_tag_conflict || exit 1
```

### hook

相同。

### ci

```yaml
- name: Check tag conflict
  run: |
    TAG="{{tagFormat-expanded}}"
    git fetch --tags
    if git rev-parse "$TAG" >/dev/null 2>&1; then
      echo "::error::Tag $TAG already exists"; exit 1
    fi
```

**Exit code**: 1 = 冲突。

---

## 3. `workdir-clean`（工作区版本文件是否干净）

### bash

```bash
check_workdir() {
  local dirty
  dirty=$(git status --porcelain -- {{versionFiles.paths.join(' ')}})
  if [ -n "$dirty" ]; then
    echo "❌ 版本文件有未 commit 变动:" >&2
    echo "$dirty" >&2
    return 1
  fi
  echo "✅ workdir clean"
}
check_workdir || exit 1
```

**注意**：bump 流程**之后** + commit **之前**跑这个 check 会必然失败——这是故意的：确保 bump 的改动被正确 commit 了。若用户希望在 bump 后 check 前自动 commit，应在 release skill 里显式安排顺序。

### ci

```yaml
- name: Check workdir clean for version files
  run: |
    DIRTY=$(git status --porcelain -- {{versionFiles.paths-space-separated}})
    [ -z "$DIRTY" ] || { echo "::error::$DIRTY"; exit 1; }
```

---

## 4. `bump-in-diff`（本次变更是否包含版本修改）

**默认必选**当 `philosophy = commit-derived`。

### bash

```bash
check_bump_in_diff() {
  local base="${BASE_REF:-origin/main}"
  local changed
  changed=$(git diff --name-only "$base"..HEAD)
  for f in {{versionFiles.paths.space-separated}}; do
    echo "$changed" | grep -qF "$f" && { echo "✅ 版本文件已改"; return 0; }
  done
  echo "❌ 本次变更未修改版本文件" >&2
  return 1
}
check_bump_in_diff || exit 1
```

### hook（pre-push 场景）

```bash
# pre-push 接收 stdin: <local ref> <local sha> <remote ref> <remote sha>
while read -r lref lsha rref rsha; do
  BASE_REF="$rsha"
  check_bump_in_diff || exit 1
done
```

### ci

```yaml
- name: Check version bump in PR
  if: github.event_name == 'pull_request'
  run: |
    git fetch origin ${{ github.base_ref }}
    CHANGED=$(git diff --name-only origin/${{ github.base_ref }}..HEAD)
    for f in {{versionFiles.paths-space-separated}}; do
      echo "$CHANGED" | grep -qF "$f" && exit 0
    done
    echo "::error::No version bump found"; exit 1
```

---

## 5. `regex-compliance`（版本号符合结构正则）

### bash

```bash
check_regex() {
  local v="$1"
  [[ "$v" =~ {{versionRegex}} ]] || { echo "❌ 版本号 $v 不符合正则 {{versionRegex}}" >&2; return 1; }
  echo "✅ regex OK ($v)"
}
check_regex "$NEW_VERSION" || exit 1
```

### ci

```yaml
- name: Check version regex
  run: |
    V=$(node -p "require('./{{versionFiles[0].path}}').version")
    [[ "$V" =~ {{versionRegex}} ]] || { echo "::error::$V bad regex"; exit 1; }
```

---

## 6. `tests-pass`（测试/lint 通过）

复用生态维度登记的 `{{testCommand}}`。

### bash / hook / ci

```bash
{{testCommand}} || exit 1
```

```yaml
- name: Run tests
  run: {{testCommand}}
```

若 `{{testCommand}}` 为空或 `TODO:` → 本检查项不应被选中；若被选中却无命令，skill-creator 在生成时替换为：

```bash
echo "TODO: 请在本脚本中填入测试命令" >&2; exit 1
```

---

## 组装规则（skill-creator 调用）

1. 读 `{{projectAnswers}}.checkScope`（Q4 多选结果）和 `.checkTiming`（Q5 单选）
2. 按 `checkTiming` 选宿主：
   - `inline` → 把所选项的 **bash** 展开直接嵌入派生 SKILL.md 的 `{{checkBlock}}` markdown 代码块
   - `pre-push-hook` / `pre-commit-hook` → 生成 `{{scriptsDir}}/check-version.<ext>` 脚本，再落一份 `.githooks/<timing>` 调用该脚本（hook 骨架见 `hook-templates.md`）
   - `ci` → 把所选项的 **ci** 展开填入 `.github/workflows/release-check.yml`（骨架见 `hook-templates.md`）
3. 每个检查项失败 exit 非零；skill-creator 在组装时保持各步骤串行 `|| exit 1`，**不要并行**
4. 若 `{{testCommand}}` 为 TODO 且 `tests-pass` 被选，提示用户补命令；不要悄悄跳过
