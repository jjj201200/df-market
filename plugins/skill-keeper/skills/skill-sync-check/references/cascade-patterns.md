# skill-sync-check 级联检查清单

对 `skill-sync-check` 收到的每份待变更 SKILL.md，按其变更类型执行下表对应的级联检查。多种变更叠加时依次执行、任一发现不一致即阻断。

---

## 1. 改 description

- 触发词是否仍能覆盖正文承诺的所有场景
- 若删除了某触发词，该词对应的正文章节是否应同步删除
- 新增触发词是否与已有 skill 产生职责重叠

---

## 2. 改正文

- 新增章节 → description 是否需补关键词
- 删除章节 → description 承诺的对应项是否需同步删
- 重写章节 → description 中的"覆盖 XX"陈述是否仍成立

---

## 3. 改 name（重命名）

- 扫描**所有其他 SKILL.md** 是否引用了旧 name
- 引用未同步更新 → 阻断
- 目录名必须同步改为新 name

---

## 4. 删除 skill

- 扫描**所有其他 SKILL.md** 是否仍在引用被删 skill
- 任何残留引用 → 阻断

---

## 5. 搬家（个人 ↔ 项目）

- 同重命名检查（路径变了，可能触发其他 skill 的引用失效）
- 若搬到项目层 → 检查是否应改为定制版（即声明"前置：通用版"）

---

## 6. 新增 skill

- description 是否与已有 skill 高度重叠（职责边界）
- 若作为定制版 → 是否声明了"前置：先阅读 <通用版>"
- frontmatter 合规性（name 与目录一致、触发词明确、YAML 有效）
- 交叉引用有效性

---

## 工具选择

- skill 存在性 → Glob `**/SKILL.md` 对比 name
- 其他 skill 引用旧 name → Grep 字面
- frontmatter YAML 有效性 → Read 后人工核对
- 正文引用的代码符号 → LSP workspaceSymbol，失败再 Grep

**反模式**：`bash grep/rg/find`——用 Grep 工具。

---

## 阻断与输出

**默认阻断**。skill 失效是隐性的（"该触发时不触发"），一旦落盘影响深远且难以发现，必须守门严格。

输出格式（由 SKILL.md 正文规定，不在本 reference 重复）。
