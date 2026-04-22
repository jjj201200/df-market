# #3 Skill 自我迭代审计 — 设计文档

**日期**: 2026-04-19
**范围**: token-reporter 新增 Skills 面板，基于 OTel 数据评测每份 skill 的真实使用效果与交叉维度分析
**关联**:
- [2026-04-19-claude-code-new-features-research.md](./2026-04-19-claude-code-new-features-research.md)（候选清单）
- [2026-04-19-context-auditing-dashboard-design-v2.md](./2026-04-19-context-auditing-dashboard-design-v2.md)（硬依赖：F 路径 fetch hook 提供完整 API request body 作为数据源）
**状态**: 设计待用户复核 → 通过后进入 writing-plans

---

## 一、目标与非目标

### 目标
- 回答「我写的 skill 真的被加载了吗？被 Claude 用了吗？有效果吗？」
- 识别**描述过宽导致误加载**的 skill、**强相关可合并**的 skill 对、**加载了但无改善**的无效 skill
- 提供一个**可扩展的维度交叉分析引擎**，而不是穷举预制面板

### 非目标
- 不自动改 SKILL.md（只产出建议，写回是未来工作）
- 不做深度语义理解（"Claude 是否按 skill 指引做了" → 归 #12 attribution-reporter）
- 不做跨 session 聚合（→ #4）
- 不重新发明 skill 合规检查（skill-keeper 的 `skill-audit` 已覆盖"写得对不对"，本项是"用得好不好"）

---

## 二、关键前置结论

1. **硬依赖 #1**：需要 OTel request body 原文（`system` 字段 + `messages`）才能识别"某份 skill 真实出现在这轮 context 中"。不启用 audit 时本面板显示空态引导，不提供弱降级估算。
2. **skill 标识方式**：以 `~/.claude/skills/<name>/SKILL.md` 的 frontmatter `name` 字段作为唯一 ID。插件版 skill（`~/.claude/plugins/.../skills/...`）按同样规则扫描。
3. **skill 目录可动态发现**：Claude Code 会把已安装的 skill frontmatter 列入 system prompt；我们解析 system block 即可反推"这轮加载了哪些 skill"。
4. **复用 #1 的 OTel jsonl**：`~/.claude/token-reporter/otel/<sessionId>.jsonl` 已包含每轮完整 request body，本设计只读不写。

### 待落地前验证的假设

| ID | 假设 | 验证方式 | 失败的退路 |
|----|------|----------|-----------|
| S1 | 加载的 skill frontmatter 在 OTel request body 的 system block 里以可识别格式出现（如 `<skill name="...">` 或 name+description 连写） | 抓 3 个真实 session 的 system block 看格式 | 若无结构化标记，只能 grep skill name 字符串，误判率上升，需加 confidence 字段 |
| S2 | Claude 调用 skill 后，assistant turn 里是否有稳定标记（如 Skill tool 的 `tool_use` block with `name="Skill"` + input.skill=...） | grep assistant blocks | 若无标记，`使用证据`弱化为"assistant 文本提到 skill 名"的 heuristic |
| S3 | 无 skill 加载的 control session 足够多，可做 AB 对比 | 扫本地历史 session，统计样本量 | 样本不足时效果分显示 n/a，不强行算 |

S1/S2/S3 在 Task 0 验证脚本里固化结果到 `test/skill-audit-verification-result.json`。

---

## 三、架构概览

```
┌────────────────────────────────────────────────────────────┐
│ OTel jsonl (来自 #1) + 现有 session JSONL                    │
└─────────────────────┬──────────────────────────────────────┘
                      ↓
┌────────────────────────────────────────────────────────────┐
│ backend/src/skill-index.ts                                  │
│  - scanInstalledSkills() → skill 清单（name, path, desc）   │
│  - buildSkillIndex(sessionId) → 每轮 skill 加载/使用证据      │
└─────────────────────┬──────────────────────────────────────┘
                      ↓
┌────────────────────────────────────────────────────────────┐
│ backend/src/skill-pivot.ts                                  │
│  pivot(groupBy[], filter{}, measure, sessionId)             │
│  → 通用透视引擎，支持任意 dim 交叉                           │
└─────────────────────┬──────────────────────────────────────┘
                      ↓
┌────────────────────────────────────────────────────────────┐
│ backend/src/skill-insights.ts                               │
│  3 条内置规则：误加载 / 强共现 / 无效加载                   │
└─────────────────────┬──────────────────────────────────────┘
                      ↓
┌────────────────────────────────────────────────────────────┐
│ Server API (backend/src/server.ts)                          │
│  GET /api/skills/summary?sessionId=                         │
│  GET /api/skills/detail?name=&sessionId=                    │
│  GET /api/skills/pivot?groupBy=&filter=&measure=&sessionId= │
│  GET /api/skills/insights?sessionId=                        │
└─────────────────────┬──────────────────────────────────────┘
                      ↓
┌────────────────────────────────────────────────────────────┐
│ 前端 Analytics Drawer 新增 Skills 面板                       │
│  SkillList · SkillDetail · PivotView · SkillInsights         │
└────────────────────────────────────────────────────────────┘
```

---

## 四、组件设计

### 4.1 Skill 索引（backend/src/skill-index.ts 新文件）

```ts
type SkillMeta = {
  name: string;           // frontmatter.name
  path: string;           // SKILL.md 绝对路径
  description: string;    // frontmatter.description
  source: 'user' | 'plugin'; // ~/.claude/skills vs plugins/*/skills
  pluginName?: string;
};

type TurnSkillEvidence = {
  turnId: number;
  loadedSkills: string[];        // S1 识别出的 name 列表，带 confidence
  usedSkills: string[];          // S2 识别出的 name 列表
  loadedConfidence: Record<string, number>;  // 0-1，非结构化识别时 < 1
};
```

**扫描路径**：
- `~/.claude/skills/*/SKILL.md`
- `~/.claude/plugins/cache/*/<version>/skills/*/SKILL.md`
- 本项目 `.claude/skills/*/SKILL.md` 和 `plugins/*/skills/*/SKILL.md`（支持项目级 skill）

**识别逻辑（遵循 S1/S2 验证结果）**：
- 加载识别：对 system block 做**两路匹配**，取 confidence 高者：
  1. 结构化：若存在 `<skill name="...">` 或类似标签（S1 验证后固化正则）→ confidence = 1.0
  2. 启发式：system block 里同时出现该 skill 的 name + description 前 20 字 → confidence = 0.7
  3. 仅 name 匹配 → confidence = 0.4（仅作兜底）
- 使用识别：assistant turn 里 tool_use block 且 name 为 `Skill`（S2 验证后固化）→ 记录 input.skill 为使用证据；若 S2 失败则用"assistant 文本提及 skill name"降级，同时在返回数据里标 `usedConfidence < 1`

### 4.2 Pivot 引擎（backend/src/skill-pivot.ts 新文件）

#### 维度（dimension）
| 维度键 | 来源 | 说明 |
|--------|------|------|
| `skill` | skill-index | 当轮加载的每份 skill，一条记录一行（多对多展开） |
| `tool` | JSONL tool_use | 工具名 |
| `stopReason` | JSONL response | `end_turn` / `max_tokens` / `stop_sequence` |
| `subagentType` | JSONL subagent | Explore / general-purpose / 等 |
| `turnSpan` | 固定分桶 | `1-5` / `6-20` / `21-50` / `51+` |
| `inputLenBucket` | OTel input tokens | `<5k` / `5-20k` / `20-100k` / `100k+` |
| `costBucket` | OTel usage | `<0.01` / `0.01-0.1` / `0.1-1` / `1+` USD |
| `cacheHit` | OTel usage | 布尔：cache_read_input_tokens > 0 |
| `loaded` | skill-index | 布尔：该轮是否加载任意 skill |

#### 度量（measure）
| 键 | 计算 |
|----|------|
| `count` | 行数 |
| `errRate` | tool 调用的 error 数 / 总数 |
| `avgTokens` | input+output tokens 均值 |
| `avgTurns` | 分组内轮次均值 |
| `p50Cost` / `p95Cost` | cost 分位 |
| `loadedButUnusedRate` | loaded=true 但 usedSkills 里不含该 skill 的比率 |

#### API 签名
```
GET /api/skills/pivot?groupBy=skill,tool&filter=stopReason:max_tokens&measure=errRate&sessionId=X
```
- `groupBy`: 1-3 个维度逗号分隔
- `filter`: k:v 对，逗号分隔
- `measure`: 单选
- 返回：
  ```ts
  {
    groupBy: string[];
    measure: string;
    rows: Array<{keys: Record<string, string>; value: number; sample: number}>;
  }
  ```

#### 缓存
- 每 session 首次 pivot 查询时构造倒排索引（all turns × all dims），内存驻留
- 失效：底层 `otel/<sessionId>.jsonl` 或 JSONL 的 mtime 变化
- 上限：每 session 索引 < 2MB；session 数量 > 20 时按 LRU 驱逐

### 4.3 Insights 规则引擎（backend/src/skill-insights.ts 新文件）

三条规则，每条输出 0-N 条 `SkillInsight`：

```ts
type SkillInsight = {
  skill: string;
  kind: 'over_loaded' | 'strong_cooccur' | 'ineffective';
  severity: 'info' | 'warn' | 'critical';
  evidence: {loads: number; uses: number; errRateDelta?: number; pairWith?: string};
  suggestion: string;  // i18n key，前端展开
};
```

#### 规则 1：over_loaded
- 触发：skill 被加载 ≥ 10 次 且 `loadedButUnusedRate > 0.5`
- 建议：description 过宽，收紧关键词
- 样本不足（loads < 10）时不触发

#### 规则 2：strong_cooccur
- 对每对 (A, B) 计算共现：`P(A∧B|A) > 0.8` 且 `P(A|¬B) < 0.1`
- 建议：考虑合并或在 SKILL.md 里显式声明前置
- 需要 `loaded` 维度数据 ≥ 5 session 才做对称统计

#### 规则 3：ineffective
- 对每份 skill：对比「加载该 skill 的轮次」vs「未加载但 prompt 长度分桶 + tool 集合相似的控制组」的 errRate + avgCost
- 触发：errRate 未显著下降（Δ < 0.05）且 avgCost 上升 > 10%
- 控制组匹配算法 v1：仅匹配 `inputLenBucket + subagentType`；匹配样本 < 5 时标 `confidence: low`

API：`GET /api/skills/insights?sessionId=X` 返回数组，前端按 severity 排序展示。

### 4.4 Server API（backend/src/server.ts 增补）

| Route | 作用 |
|-------|------|
| `GET /api/skills/summary?sessionId=` | 返回 `SkillMeta[] + 每份 skill 的 loads/uses/firstLoadTurn` |
| `GET /api/skills/detail?name=&sessionId=` | 单 skill 深度：每轮加载/使用轨迹 + confidence |
| `GET /api/skills/pivot?...` | 上文 4.2 |
| `GET /api/skills/insights?sessionId=` | 上文 4.3 |

所有 API 在 OTel 数据缺失时返回 `{enabled: false, reason: 'audit_disabled'}`，前端据此切空态。

### 4.5 前端 Skills 面板

#### AnalyticsNav 新增
在现有 9 个面板之后新增 `nav.skills` 入口，图标与 Context 风格一致。

#### SkillsPanel（frontend/src/components/Analytics/SkillsPanel/SkillsPanel.tsx 新文件）
三栏布局：
- 左：SkillList（按 loads 排序，每项显示 loads / uses / 效果分小圆点）
- 右上：SkillDetail（选中 skill 的加载时间轴、使用率、AB 对比条形图）
- 右下：PivotView
- 底：SkillInsights（3 条规则输出的卡片）

空态：audit 未启用时整个面板显示「Enable audit to unlock Skills analysis」+ 大按钮跳 ContextPanel 横幅。

#### PivotView（复用组件，未来 #4 / #6 可借）
- 三个 dropdown：groupBy（多选，最多 3）· measure · filter（k:v 动态增删）
- 预设快进按钮：`skill×errRate` · `skill×cost/turn` · `skill×stopReason` · `skill-pair 热图` · `skill×firstLoadTurn`
- 结果区按 measure 类型自动选可视化：
  - 单 group-by 数值 measure → 横向条形
  - 双 group-by → 热图
  - 三 group-by → 分组条形 + 下钻

### 4.6 i18n

新增键：
- `nav.skills`
- `skills.title` · `skills.list.title` · `skills.detail.title` · `skills.pivot.title` · `skills.insights.title`
- `skills.metrics.loads` / `.uses` / `.errRateDelta` / `.costDelta` / `.firstLoadTurn`
- `skills.pivot.groupBy` / `.filter` / `.measure` / `.preset.*`（5 个预设）
- `skills.insight.overLoaded.title` / `.suggestion`
- `skills.insight.strongCooccur.title` / `.suggestion`
- `skills.insight.ineffective.title` / `.suggestion`
- `skills.emptyState.auditDisabled`
- `skills.confidence.low` / `.medium` / `.high`

---

## 五、组件隔离与边界

| 组件 | 职责 | 依赖 |
|------|------|------|
| `backend/src/skill-index.ts` | skill 元数据扫描 + 每轮加载/使用识别 | 读 `~/.claude/skills/`、OTel jsonl、JSONL |
| `backend/src/skill-pivot.ts` | 通用透视引擎，纯函数 | 依赖 skill-index 输出的结构化 turn 数据 |
| `backend/src/skill-insights.ts` | 3 条规则，纯函数 | 调用 skill-pivot |
| `backend/src/server.ts` 新 Route | HTTP 层，读 config.auditEnabled 做空态判断 | 调用上述三者 |
| `frontend/SkillsPanel` | 容器 + 空态 | 读 sessionStore |
| `frontend/PivotView` | 通用组件（后续 #4/#6 复用） | props 定义维度/度量选项 |

每个后端模块独立测试：给 fixture session 数据，断言输出。

---

## 六、错误处理

1. **audit 未启用** → API 返回 `{enabled: false}`，前端显示空态
2. **skill 目录扫描失败**（文件权限）→ 跳过该目录，log warn，不影响其他
3. **skill 识别 confidence < 0.4** → 不计入 loads/uses，但保留在 debug 字段里
4. **pivot 维度组合无数据** → 返回空 rows 而非 500
5. **insights 样本不足** → 规则静默，不产出 false positive
6. **前端 Skills 面板加载失败** → 不影响其他 panel

---

## 七、测试策略

- `test/test-skill-audit-verification.js` —— Task 0 跑 S1/S2/S3 固化结果
- `test/test-skill-index.js` —— 给 3 个 session fixture，断言 loadedSkills / usedSkills 正确 + confidence 合理
- `test/test-skill-pivot.js` —— 覆盖 groupBy 1/2/3 维 × 5 种 measure × 2 种 filter，验证结果与手算一致
- `test/test-skill-insights.js` —— 构造各规则的阳性/阴性样本，断言 insight 生成与 suppression
- `test/test-skills-api.js` —— 4 个新 API 的空态 / 正常态 / 参数错误
- 前端：手工验证（dev server 13737）

---

## 八、迁移与兼容

- 不改 config.json schema
- 不改现有 parser / server 已有路由
- 旧 session（无 OTel 数据）→ Skills 面板显示"本 session 无 audit 数据"
- 若 #1 尚未实现 `/api/audit/status` → 本面板降级为永远空态，直到 #1 合入

---

## 九、范围外（显式）

- 写回 SKILL.md 的自动建议
- 跨 session 聚合 → #4
- skill 的语义理解 → #12
- skill-creator 集成（创建时就参考历史数据） → 未来
- Claude 是否"按 skill 指引做"的深度判定 → #12

---

## 十、下一步

1. 用户复核本 spec
2. 通过后，Task 0 跑 S1/S2/S3 验证
3. 验证通过 → invoke writing-plans 生成实施计划
4. 实施计划按以下顺序出 task：skill-index → skill-pivot → skill-insights → API → 前端 PivotView → SkillsPanel → i18n → 手工验证
