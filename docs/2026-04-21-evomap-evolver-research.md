# @evomap/evolver 调研报告

- **调研日期**：2026-04-21
- **调研深度**：轻量（选项 A）
- **对象**：npm 包 `@evomap/evolver` / GitHub `EvoMap/evolver`
- **目的**：理解其设计理念，提炼可被 df-market（尤其 `skill-keeper` / `release-creator` 这类方法论插件）借鉴的点

## 一、它是什么

一句话：**面向 AI agent 的"自我进化引擎"**——扫自己的 runtime 日志、找失败模式、挑一条已验证的"修复基因"、生成一条受协议约束的改进 prompt、把整个循环记成不可变事件落盘。

对外接口几乎全是 CLI / slash command（`/evolve`、`node index.js`），不依赖任何中心化服务（Hub 可选）。

## 二、核心理念（4 条）

### 1. Protocol-Constrained Evolution（协议约束下的演化）

> "Evolution is not optional. Adapt or die."

所有变更必须符合 **GEP 协议**（Genome Evolution Protocol），而不是自由形态的 prompt diff。协议把"改进"这件事抽象成三类资产：

| 资产                | 角色                                   |
| ------------------- | -------------------------------------- |
| **Gene**            | 可复用、带验证命令的最小修复模式       |
| **Capsule**         | 多个 Gene 组合成的复杂演化流程         |
| **EvolutionEvent**  | 每一轮演化的不可变审计记录（进 git）   |

结构化资产替代自由编辑——可审计、可复用、可共享。

### 2. Signal-Driven Selection（信号驱动选择）

不让 LLM 自由发挥，而是：

1. **扫描** `memory/` 下的日志、错误模式
2. **打分**：把信号和已有的 Gene / Capsule 匹配打分
3. **选中** best-matching 模板
4. **去重**：避免对同一个病反复开药

"从模板库里选最合适的一条"胜过"让模型从零写一条"。

### 3. Human-in-the-Loop Safety（人机共守）

- `--review` 标志在落盘前暂停等用户确认
- 验证命令有硬白名单：**只允许 node/npm/npx**
- 禁止反引号、`$(...)`、shell 操作符（`; & | > <`）
- 每条命令 180 秒超时、作用域锁在仓库根

把"AI 自我修改代码"这件危险事包在一层极严的沙箱里。

### 4. Decoupled / Platform-Agnostic（解耦、不绑定平台）

- **离线可用**，Hub 只在需要网络功能（技能商店、工人池、排行榜）时才连
- 通过 hook（Cursor / Claude Code）或 stdout 指令（OpenClaw）接入宿主
- 配置走环境变量
- 零平台锁定

---

## 三、其他值得注意的设计

### Strategy Preset（策略预设）

一个环境变量 `EVOLVE_STRATEGY` 切换整体比例：

| 策略          | innovate | optimize | repair | 场景         |
| ------------- | -------- | -------- | ------ | ------------ |
| `balanced`    | 50%      | 30%      | 20%    | 日常（默认） |
| `innovate`    | 80%      | 15%      | 5%     | 快速出新功能 |
| `harden`      | 20%      | 40%      | 40%    | 大改后稳住   |
| `repair-only` | 0%       | 20%      | 80%    | 紧急救火     |

一个参数调整整个 agent 的"性格"。

### Workflow 六段式

`Scan → Select → Prompt → Validate → Solidify → Report`

每段职责单一，Validate 和 Solidify 之间有明确的安全闸门。

### 反模式（明确写出来）

README 里有一节 "Anti-Examples"，明确列出**不该干什么**：

- 没有信号和约束就重写整个子系统
- 把 GEP 当通用 task runner 用
- 生成变更却不记录 EvolutionEvent

### 视觉规范也协议化

"只允许 🧬 这一个 emoji，其他全禁"——连文案细节都写进协议。

---

## 四、可效仿点（对 df-market 的映射）

> 下面每条的结论都是**可以借鉴**，不是"必须照搬"。

### 1. 把"经验"从 prompt 片段升级成结构化资产 ⭐⭐⭐

**对应**：`skill-keeper` / `release-creator`。

它的 Gene / Capsule / Event 三件套，本质和本仓库已有的 "SKILL.md + references/ + git history" 三件套思路接近。但它**显式区分了"模板（Gene）"和"事件（EvolutionEvent）"**——模板是未来要复用的资产，事件是一次性审计轨迹。

> 可效仿：`skill-recap` 目前只负责"更新 skill + 归类知识"，可以加一个**事件落盘**步骤——每次 recap 的决策（改进了哪个 skill / 归了哪类知识 / 忽略了什么）落成一份不可变 `events/YYYY-MM-DD-*.md`，独立于 skill 正文。审计 / 回溯 / 找"为什么当时这么改"时非常有用。

### 2. Signal-Driven 优先于 Generate-from-Scratch ⭐⭐⭐

**对应**：`skill-coding-review` / 未来的 skill-audit。

它的思路：先扫日志提取信号 → 再从已有模板打分匹配 → 而不是每次让 LLM 从零生成修复。

> 可效仿：`skill-coding-review` 现在派出的 subagent 是"自由审查"。可以给每个维度（reuse / quality / efficiency）建一份**已知问题模式库**（类似 Gene），subagent 先匹配模式库，匹配不上再自由发挥。长期收益：同一个问题不会被反复"发现—争论—归档—再发现"。

### 3. Strategy Preset 作为"一键切性格"的机制 ⭐⭐

**对应**：任何方法论 skill 的"严格度"开关。

`EVOLVE_STRATEGY=harden` 这种一个变量调全部比例的做法非常漂亮。

> 可效仿：`skill-coding-review` 可以加 `REVIEW_STRATEGY`，如 `balanced` / `pre-release-harden`（多派一轮 subagent、零发现才放行）/ `quick-pass`（1 个 agent 过一轮即可）。避免每次用都要在正文里改规则。

### 4. Human-in-the-Loop 的 `--review` 标志 ⭐⭐

**对应**：`skill-recap` / `skill-*-sync-check`。

它把"落盘前暂停"作为一个**独立 flag 而不是独立流程**。

> 观察：本仓库 `sync-check` 族 skill 已经承担了"落盘守门"的职责，思路一致。不同在于：evolver 是**同一条流程的开关**，本仓库是**独立的 skill 调用**。两种都合理；可以评估是否把一部分 sync-check 逻辑内联成 flag，减少链路跳转。

### 5. 反模式章节 ⭐⭐

**对应**：所有 SKILL.md。

它的 README 里明确有 "Anti-Examples / What NOT to Do"。

> 可效仿：本仓库 SKILL.md 通常只写"该做什么"。可以在每份长 skill（尤其 `skill-coding-review` / `skill-recap`）正文里加一节"反模式"，明确写"不要把这个 skill 当 X 用"。从 evolver 的经验看，这比正面指引更能避免误用。

### 6. 安全命令白名单 ⭐

**对应**：任何会让 Claude 跑 shell 的 skill。

它对 Gene 验证命令的硬限制：仅 node/npm/npx、禁止 shell 元字符、180s 超时、仓库根作用域。

> 可效仿：本仓库的 `scripts/bump-version.cjs` / `scripts/check-version.cjs` 已经是 Node 脚本、路径相对项目根，天然贴合。未来如果 skill 要执行更多自动化命令（比如 `release-market` 里的 build 步骤），可以显式写一份白名单，而不是靠 hooks 的 permission prompt 兜底。

### 7. 离线优先 + 网络功能 opt-in ⭐

**对应**：整体架构观。

Hub 可选、所有核心功能离线可用。

> 观察：本仓库的插件已经是这个模型（skill 都是本地 markdown），不用额外学。但这是一个**值得坚持的原则**——未来如果 skill-keeper / release-creator 发展出跨项目的共享机制，记得保持"本地可跑、协作可选"。

---

## 五、不建议照搬的点

- **EvoMap Hub / Worker Pool / Validator Role**：对单仓库、单人/小团队场景过度工程化。本仓库 skill 的复用渠道是 plugin marketplace，不需要额外的 P2P 协作层。
- **Loop 模式（`--loop` daemon）**：本仓库 skill 是**用户交互触发**，不适合做成常驻守护进程。
- **emoji 协议约束（只允许 🧬）**：项目特化决策，借鉴意义不大。

---

## 六、Top 3 行动项（如果要落地）

如果挑 3 件事立刻做，我推荐：

1. **给 `skill-coding-review` 加"问题模式库"**（对应理念 2）——把过去发现过的高频问题沉淀成可复用的 signal pattern，subagent 先匹配再自由发挥。收益：减少重复争论、加快审查速度。
2. **给每份长 skill 加"反模式"章节**（对应理念 5）——低成本、高收益，一句一句补即可。
3. **给 `skill-recap` 加事件落盘**（对应理念 1）——每次 recap 的决策落成 `docs/recap-events/YYYY-MM-DD-*.md`，未来审计时有据可查。

---

## 参考

- GitHub: https://github.com/EvoMap/evolver
- 文档站: https://evomap-evolver.mintlify.app/
- npm: https://www.npmjs.com/package/@evomap/evolver
- 官方主页: https://evomap.ai/
