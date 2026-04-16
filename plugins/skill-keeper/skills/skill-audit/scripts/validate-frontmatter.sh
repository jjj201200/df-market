#!/usr/bin/env bash
# validate-frontmatter.sh — SKILL.md frontmatter 机械校验
#
# 用途：对一份或多份 SKILL.md 做最基础的"一眼可判"合规检查，把 Claude 从
# 逐份 Read 核对 frontmatter 的事务中解放出来。仅做机械检查，不做语义判断——
# 语义层（触发词覆盖度、description↔正文一致性）仍由 skill-audit 主流程人工执行。
#
# 检查项：
#   1. frontmatter 存在性：文件头部是否有 --- ... --- YAML 块
#   2. frontmatter YAML 基本合法性：非空、无裸制表符、key: value 格式
#   3. name 字段存在且非空
#   4. name 字段与父目录名严格一致
#   5. description 字段存在且非空
#
# 用法：
#   validate-frontmatter.sh <SKILL.md 路径> [<路径>...]
#   validate-frontmatter.sh --dir <skills 根目录>     # 扫描该目录下所有 SKILL.md
#
# 退出码：
#   0 — 全部通过
#   1 — 发现至少一处不合规
#   2 — 参数错误 / 文件不存在
#
# 输出：一行一条，格式 `[OK|FAIL] <path> <message>`；FAIL 行以非零码退出

set -u

usage() {
  cat >&2 <<'EOF'
Usage:
  validate-frontmatter.sh <SKILL.md> [<SKILL.md>...]
  validate-frontmatter.sh --dir <skills-root>

Exit: 0 all ok, 1 violations found, 2 arg error.
EOF
  exit 2
}

[[ $# -lt 1 ]] && usage

declare -a FILES=()

if [[ "$1" == "--dir" ]]; then
  [[ $# -lt 2 ]] && usage
  root="$2"
  [[ -d "$root" ]] || { echo "directory not found: $root" >&2; exit 2; }
  while IFS= read -r -d '' f; do
    FILES+=("$f")
  done < <(find "$root" -type f -name SKILL.md -print0)
else
  for f in "$@"; do
    [[ -f "$f" ]] || { echo "file not found: $f" >&2; exit 2; }
    FILES+=("$f")
  done
fi

violations=0

check_one() {
  local path="$1"
  local dir_name
  dir_name=$(basename "$(dirname "$path")")

  # 1. frontmatter 存在性：首行必须是 ---
  local first_line
  first_line=$(head -n 1 "$path")
  if [[ "$first_line" != "---" ]]; then
    echo "[FAIL] $path frontmatter missing: first line is not '---'"
    return 1
  fi

  # 提取 frontmatter（首个 --- 后到下一个 --- 之间）
  local fm
  fm=$(awk 'NR==1 && /^---$/ {flag=1; next} flag && /^---$/ {exit} flag {print}' "$path")
  if [[ -z "$fm" ]]; then
    echo "[FAIL] $path frontmatter empty or unterminated"
    return 1
  fi

  # 2. 检查裸制表符（YAML 不允许缩进用 tab）
  if printf '%s' "$fm" | grep -q $'\t'; then
    echo "[FAIL] $path frontmatter contains raw tab characters (use spaces)"
    return 1
  fi

  # 3/4. name 字段
  local name
  name=$(printf '%s\n' "$fm" | grep -E '^name:[[:space:]]*' | head -n 1 | sed -E 's/^name:[[:space:]]*//; s/^"(.*)"$/\1/; s/^'\''(.*)'\''$/\1/')
  if [[ -z "$name" ]]; then
    echo "[FAIL] $path frontmatter missing or empty 'name' field"
    return 1
  fi
  if [[ "$name" != "$dir_name" ]]; then
    echo "[FAIL] $path name='$name' does not match directory name='$dir_name'"
    return 1
  fi

  # 5. description 字段
  local desc
  desc=$(printf '%s\n' "$fm" | grep -E '^description:[[:space:]]*' | head -n 1 | sed -E 's/^description:[[:space:]]*//')
  if [[ -z "$desc" || "$desc" == '""' || "$desc" == "''" ]]; then
    echo "[FAIL] $path frontmatter missing or empty 'description' field"
    return 1
  fi

  echo "[OK] $path name=$name"
  return 0
}

for f in "${FILES[@]}"; do
  check_one "$f" || violations=$((violations + 1))
done

if [[ $violations -gt 0 ]]; then
  echo ""
  echo "Total violations: $violations" >&2
  exit 1
fi

exit 0
