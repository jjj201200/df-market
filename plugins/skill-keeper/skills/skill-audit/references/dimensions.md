# skill-audit 核查维度手册（7 维度）

本 reference 详述 `skill-audit` 的 7 个核查维度。主流程执行阶段 Read 本文件，按每个维度的"检查内容 / 方法 / 典型漂移"逐项做。

---

## 1. 触发词覆盖度

**检查**：description 承诺的触发词是否能匹配用户在本项目中真实发生过的意图说法

**方法**：
- Read 该 skill description
- 抽样近期用户对话（从 git log / 会话记录搜主题关键词），识别该领域的真实说法
- 对照 description，若有说法无法命中任何触发词 → 漂移

**典型漂移**：代码库新增功能"批注导出"，但 skill description 只提"批注"——"导出"场景不会触发

---

## 2. description ↔ 正文一致性

**检查**：description 承诺的范围是否与正文章节一一对齐

**方法**：
- Read SKILL.md 全文，列出 description 中的承诺项（"覆盖 A、B、C"）
- 对照正文章节，A/B/C 是否都有对应内容
- 反向：正文是否有重要章节未在 description 体现（会导致该场景检索不到本 skill）

**典型漂移**：description 还写着旧功能，正文已删；或正文加了新章节但 description 没同步

---

## 3. 职责边界

**检查**：任意两个 skill 的 description 是否高度重叠

**方法**：
- 列出所有 SKILL.md 的 frontmatter description
- 成对比较触发词集合的交集
- 交集 ≥ 50% 的 skill 对 → 标为"边界模糊"，建议合并或重划
- 特殊情况：通用版 + 定制版是合法的"覆盖同一领域"，不算重叠

---

## 4. 前置 skill 声明

**检查**：定制版 skill 必须在正文前置声明引用通用版方法论；被引用的 skill 必须存在

**方法**：
- 定制版 SKILL.md 正文搜"前置：先阅读"或类似表述
- 被引用的 skill name 必须能在 `~/.claude/skills/` 或项目 `.claude/skills/` 找到对应 SKILL.md

---

## 5. 交叉引用有效性

**检查**：skill 正文中对其他 skill 的引用必须可达

**方法**：
- Grep SKILL.md 中的 `skill-xxx` 形式引用
- 验证被引用 name 存在于可发现的 skill 清单

**搬家最常漂移**：A skill 被从个人层搬到项目层（或反之），其他 skill 的引用未同步更新

---

## 6. frontmatter 合规

**检查**：
- `name` 与目录名严格一致
- `description` 含明确触发词（中文项目应有中文触发词）
- YAML 有效、无解析错误（无多行非转义字符串等陷阱）

**机械校验工具**：本 skill 同级提供 `scripts/validate-frontmatter.sh`，对目标 SKILL.md 做 YAML lint + name↔目录名一致性检查。用法见该脚本头部注释。

---

## 7. 正文引用的工具/路径有效性

**检查**：skill 正文提到的 CLI、MCP 工具、文件路径、函数名抽样验证

**方法**：
- Glob 验证路径
- LSP workspaceSymbol 验证函数/类名（若有）
- Grep 字面验证命令/配置项
- skill 自带的 `references/*.md`（SKILL.md 同级 `references/` 子目录）必须 Glob 全量枚举，与正文中形如 `references/xxx.md` 的引用逐一对账：
  - 正文引用但 references/ 中不存在 → 上报失效
  - references/ 存在但正文未引用 → 上报孤儿文件

---

## 工具纪律

- 只读：禁止 Write/Edit
- 选对工具：
  - 按 skill 名找 SKILL.md → Glob
  - 找触发词/引用 → Grep
  - 验证代码符号 → LSP
- 反模式：`bash grep/rg/find/cat/head/tail`
