# Token Reporter 前端迁移计划：React + Vite + TypeScript + SCSS Modules + Zustand

## Context

当前 token-reporter 前端是 ~3,937 行 vanilla JS 应用，包含 7 个 JS 模块、6 个 CSS 文件和 1 个 HTML 入口。虽然架构清晰（state/session/chart/interactions/renderer/utils 模块分离），但存在以下问题：

- 无类型安全，API 数据结构不明确
- 大量 DOM 手动操作（renderer.js 896 行），SSE 更新时需手动保存/恢复 expand 状态
- CSS 全局命名空间，类名冲突风险
- 无构建步骤，无法使用现代工具链

本次迁移目标：**保持完全的功能一致性和视觉一致性**，同时引入 React 组件化、TypeScript 类型安全、SCSS 模块化和 Zustand 状态管理。

---

## 技术选型总结

| 项目     | 选择                                        |
| -------- | ------------------------------------------- |
| 框架     | React 19 + Vite 6                           |
| 语言     | TypeScript 5.7                              |
| 状态管理 | Zustand 5                                   |
| 样式方案 | CSS Modules + SCSS（`sass`）                |
| 图表     | 保留原生 Canvas 2D，useRef + useEffect 封装 |
| 构建产物 | 提交 `dist/` 到 git                         |
| 自动编译 | pre-push hook                               |
| 开发体验 | Vite HMR + proxy 代理后端 API               |

---

## 1. 目录结构

```
plugins/token-reporter/
  frontend/                         # 新增：React 应用源码
    index.html                      # Vite 入口 HTML
    vite.config.ts
    tsconfig.json
    tsconfig.node.json
    package.json
    src/
      main.tsx                      # React 入口
      App.tsx                       # 顶层布局组件
      types/
        api.ts                      # API 响应类型定义
        state.ts                    # 内部 UI 状态类型
      stores/
        sessionStore.ts             # 会话列表、活跃会话、数据加载
        chartStore.ts               # Brush 范围、hover、dims 切换、barRects
        limitsStore.ts              # 各会话的限额数据
        uiStore.ts                  # 展开/折叠状态持久化
      hooks/
        useSSE.ts                   # SSE 连接 + 指数退避重连
        useCanvasDpr.ts             # DPR 感知的 canvas 初始化
        useScrollSync.ts            # 滚动 <-> brush 双向同步
      services/
        api.ts                      # fetch 封装：getSessions, getSession, getLimits
        adapter.ts                  # adaptSession() - API 响应转内部类型
      utils/
        format.ts                   # fmt, fmtF, fmtDur, fmtBytes, parseDur, parseSize
        canvas.ts                   # setupCanvas, getSegs
      components/
        StickyChart/
          StickyChart.tsx           # 粘性图表区域容器
          StickyChart.module.scss
          DimBar.tsx                # 维度切换按钮组
          DimBar.module.scss
          SessionBar.tsx            # 会话选择器 + 复制按钮 + meta 汇总
          SessionBar.module.scss
          MainChart.tsx             # Canvas 主图表（useRef + useEffect）
          MainChart.module.scss
          BrushChart.tsx            # Canvas 缩略图
          BrushChart.module.scss
          BrushOverlay.tsx          # Brush 拖拽手柄 + 选区
          BrushOverlay.module.scss
          ChartLegend.tsx           # 图例行
          LimitsDisplay.tsx         # Context/5h/7d 进度条
          LimitsDisplay.module.scss
        ConversationList/
          ConversationList.tsx      # 对话列表容器
          ConversationList.module.scss
          TurnItem.tsx              # 单个对话轮次（用户 + 助手）
          TurnItem.module.scss
          UserMessage.tsx           # 用户消息
          AssistantMessage.tsx      # 助手消息
          ThinkingBlock.tsx         # 可折叠的思考过程
          ThinkingBlock.module.scss
          ToolGroup.tsx             # 可折叠的工具调用组
          ToolGroup.module.scss
          ToolCard.tsx              # 单个工具调用卡片
          ToolCard.module.scss
          ToolStatsPanel.tsx        # 工具统计面板
          CompactEvent.tsx          # 上下文压缩事件
          CommandEvent.tsx          # 斜杠命令事件
          CommandEvent.module.scss
        Subagent/
          SubagentSummary.tsx       # Subagent 汇总卡片
          SubagentSummary.module.scss
          SubagentCard.tsx          # Agent 工具调用中的子代理展示
          SubagentTurn.tsx          # Subagent 单个轮次
          SubagentToolGroup.tsx     # Subagent 工具组
        common/
          TokenBadges.tsx           # 可复用的 in/out/cr/cc token 展示
          TokenBadges.module.scss
          CopyButton.tsx            # 复制按钮（带反馈）
          CopyButton.module.scss
          LoadingState.tsx          # Spinner + skeleton 骨架屏
          LoadingState.module.scss
          ErrorDisplay.tsx          # 错误提示
      styles/
        _variables.scss             # SCSS 变量 + :root CSS 自定义属性
        _mixins.scss                # 公共 mixin（skeleton-shimmer, text-clamp 等）
        _reset.scss                 # 基础重置
        global.scss                 # 导入 reset + variables，body 样式，keyframes
  dist/                             # 构建产物（提交到 git）
    index.html
    assets/
  src/
    server.js                       # 修改：从 dist/ 提供静态文件
```

---

## 2. 组件树

```
<App>
  <StickyChart>
    <DimBar />                    # 4个维度切换 chip
    <SessionBar />                # select + CopyButton + meta 汇总
    <MainChart />                 # Canvas：可见范围内的柱状图
    <BrushChart>                  # Canvas：全量缩略柱状图
      <BrushOverlay />            # 左/右手柄 + 选区 + 拖拽区
    </BrushChart>
    <ChartLegend />               # 静态图例
    <LimitsDisplay />             # 上下文/5h/7d 限额进度条
  </StickyChart>

  <ConversationList>
    {items.map(item =>
      item.type === 'turn'    ? <TurnItem />    :
      item.type === 'compact' ? <CompactEvent /> :
      item.type === 'command' ? <CommandEvent /> : null
    )}
  </ConversationList>
</App>

# TurnItem 内部结构：
<TurnItem>
  <UserMessage>                   # 条件渲染
    <TokenBadges />
  </UserMessage>
  <AssistantMessage>
    <TokenBadges />
    <ThinkingBlock />             # 条件渲染，可折叠
  </AssistantMessage>
  <ToolGroup>                     # 条件渲染，可折叠
    <ToolStatsPanel />
    {tools.map(t =>
      <ToolCard>
        {t.name === 'Agent' && <SubagentCard />}
      </ToolCard>
    )}
  </ToolGroup>
</TurnItem>
```

---

## 3. Zustand Store 设计

### sessionStore

```typescript
interface SessionStore {
  sessions: SessionListItem[];
  sessionsLoading: boolean;
  sessionsError: string | null;
  activeSessionId: string | null;
  data: DataItem[]; // 所有 items 按时间排序
  turns: TurnItem[]; // 仅 turn 类型，用于图表索引
  subagents: Record<string, SubagentStats>;
  sessionLoading: boolean;
  sessionError: string | null;
  fetchSessions: () => Promise<void>;
  loadSession: (id: string, opts?: {preserveScroll?: boolean}) => Promise<void>;
  refreshCurrentSession: () => Promise<void>;
}
```

- `fetchSessions()` 从 `/api/sessions` 加载列表，恢复 localStorage 上次选择
- `loadSession()` 并行请求 `/api/sessions/:id` + `/api/limits`，调用 adapter 转换
- `refreshCurrentSession()` 由 SSE 触发，`preserveScroll=true`

### chartStore

```typescript
interface ChartStore {
  brushL: number; // 0..1
  brushR: number; // 0..1
  hoveredId: number | null;
  dims: {input: boolean; output: boolean; cacheR: boolean; cacheC: boolean};
  barRects: BarRect[];
  setBrush: (l: number, r: number) => void;
  setHovered: (id: number | null) => void;
  toggleDim: (key: keyof Dims) => void;
  setBarRects: (rects: BarRect[]) => void;
  initBrushForTurnCount: (n: number) => void;
}
```

### limitsStore

```typescript
interface LimitsStore {
  limits: Record<string, LimitsData>;
  setLimits: (sessionId: string, data: LimitsData) => void;
}
```

### uiStore

```typescript
interface UIStore {
  expandedToolGroups: Set<string>;
  expandedToolDetails: Set<string>;
  expandedThinking: Set<string>;
  expandedTexts: Set<string>;
  toggleToolGroup: (id: string) => void;
  toggleToolDetail: (id: string) => void;
  toggleThinking: (id: string) => void;
  toggleText: (id: string) => void;
  resetAll: () => void;
}
```

### 数据流

```
SSE "update" -> sessionStore.refreshCurrentSession()
  -> fetch API -> adapter -> 更新 data/turns
  -> React 重新渲染（uiStore 中的 expand 状态不受影响）

SSE "limits_update" -> limitsStore.setLimits()
  -> LimitsDisplay 组件自动更新

用户拖拽 brush -> chartStore.setBrush()
  -> MainChart useEffect 重绘 -> ConversationList 滚动同步

用户滚动页面 -> useScrollSync -> chartStore.setBrush()
  -> BrushOverlay 位置更新 + MainChart 重绘
```

---

## 4. TypeScript 类型定义

> 迁移时需要核对 `parser.js` 实际返回的数据结构，确保类型定义准确。

### API 响应类型 (`types/api.ts`)

```typescript
// GET /api/sessions
interface SessionListItem {
  sessionId: string;
  slug: string;
  customTitle: string;
  gitBranch: string;
  mtime: string;
  filePath: string;
}

// GET /api/sessions/:id
interface SessionResponse {
  sessionId: string;
  turns: ApiTurn[];
  systemEvents: ApiSystemEvent[];
  subagents: Record<string, ApiSubagentStats>;
}

interface ApiTurn {
  id: number;
  time: string;
  timestamp: string;
  userText: string;
  assistantText: string;
  model: string;
  isSidechain: boolean;
  input: number;
  output: number;
  cacheR: number;
  cacheC: number;
  thinking: string | null;
  tools: ApiTool[];
}

interface ApiTool {
  name: string;
  cls: string; // 'bash'|'read'|'edit'|'write'|'grep'|'glob'|'web'|'agent'|'mcp'|'other'
  params: string;
  inputArgs: {k: string; v: string; vc: string}[];
  status: 'ok' | 'err';
  isErr: boolean;
  dur: string;
  retContent: string;
  retSize: string;
  retLines: string;
  mcp: {server: string; method: string} | null;
}

interface ApiSystemEvent {
  type: 'command' | 'compact';
  command?: string;
  message?: string;
  output?: string;
  trigger?: string;
  preTokens?: number;
  time: string;
  timestamp: string;
}

interface ApiSubagentStats {
  agentId: string;
  agentType: string;
  description: string;
  totalTurns: number;
  totalTokens: {input: number; output: number; cacheR: number; cacheC: number};
  toolCounts: Record<string, number>;
  turns: ApiTurn[];
}

// GET /api/limits
interface LimitsData {
  timestamp?: number;
  contextWindow?: ContextWindowData;
  context_window?: ContextWindowData;
  rateLimits?: RateLimitsData;
  rate_limits?: RateLimitsData;
  model?: string;
  cost?: number;
}

interface ContextWindowData {
  used_percentage: number;
  context_window_size?: number;
  current_usage?: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens: number;
    cache_creation_input_tokens: number;
  };
}

interface RateLimitsData {
  five_hour?: RateLimitEntry;
  seven_day?: RateLimitEntry;
}

interface RateLimitEntry {
  used_percentage: number;
  resets_at?: number; // unix timestamp in seconds
}
```

### 内部状态类型 (`types/state.ts`)

```typescript
type DataItem = TurnItem | CompactItem | CommandItem;

interface TurnItem {
  type: 'turn';
  id: number;
  time: string;
  timestamp: string;
  user: string;
  assistant: string;
  model: string;
  input: number;
  output: number;
  cacheR: number;
  cacheC: number;
  isSidechain: boolean;
  thinking: string | null;
  tools: ToolItem[];
}

interface ToolItem {
  cls: string;
  name: string;
  params: string;
  status: 'ok' | 'err';
  dur: string;
  retSize: string;
  retLines: string;
  input: {k: string; v: string; vc: string}[];
  output: string;
  isErr: boolean;
  mcp: {server: string; method: string} | null;
}

interface CompactItem {
  type: 'compact';
  trigger: string;
  preTokens: number;
  time: string;
  timestamp: string;
}

interface CommandItem {
  type: 'command';
  command: string;
  message: string;
  output: string;
  time: string;
  timestamp: string;
}

interface BarRect {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
}
```

---

## 5. SCSS 架构

### `_variables.scss`

- 将现有 `variables.css` 中的 CSS 变量提升为 SCSS 变量（`$bg`, `$surface`, `$blue` 等）
- 同时在 `:root` 中输出 CSS 自定义属性，供运行时访问
- COLORS 常量也在此定义（供 canvas 绘图使用，通过 TypeScript 常量同步）

### `_mixins.scss`

```scss
@mixin skeleton-shimmer {
  /* 骨架屏动画 */
}
@mixin text-clamp($lines: 6) {
  /* 文本截断 */
}
@mixin scrollable($max-height) {
  /* 可滚动区域 */
}
@mixin tool-color-band($color) {
  /* 工具颜色条 */
}
```

### CSS Modules 策略

- 每个组件配套 `.module.scss`，类名自动局部化
- 文件头部 `@use '../../styles/variables' as *;` 引入变量
- `localsConvention: 'camelCaseOnly'`，JS 中用 `styles.toolCard` 而非 `styles['tool-card']`

### 样式迁移映射

| 原始 CSS 文件   | 目标组件 SCSS                                                                                                                     |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `variables.css` | `styles/_variables.scss`                                                                                                          |
| `layout.css`    | `StickyChart.module.scss` + `ConversationList.module.scss` + `LimitsDisplay.module.scss`                                          |
| `chart.css`     | `DimBar.module.scss` + `SessionBar.module.scss` + `MainChart.module.scss` + `BrushChart.module.scss` + `BrushOverlay.module.scss` |
| `messages.css`  | `TurnItem.module.scss` + `ThinkingBlock.module.scss` + `ConversationList.module.scss`                                             |
| `tools.css`     | `ToolGroup.module.scss` + `ToolCard.module.scss` + `SubagentSummary.module.scss`                                                  |
| `ui.css`        | `LoadingState.module.scss` + `CopyButton.module.scss` + `global.scss`                                                             |

---

## 6. 构建管线

### `vite.config.ts`

```typescript
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: path.resolve(__dirname, '..', 'dist'),
    emptyOutDir: true,
  },
  css: {
    modules: {localsConvention: 'camelCaseOnly'},
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3737',
      '/events': {target: 'http://localhost:3737'},
      '/notify': 'http://localhost:3737',
    },
  },
});
```

### `server.js` 修改（最小改动）

- `SRC_DIR` 改为指向 `dist/`
- 静态文件服务改为遍历 `dist/` 目录（支持 Vite 哈希文件名 `assets/*.js`, `assets/*.css`）
- 扩展 MIME 类型：`.svg`, `.woff2`, `.png`

### pre-push hook

```bash
#!/bin/bash
# 1. 构建前端
cd plugins/token-reporter/frontend
[ ! -d node_modules ] && npm ci --silent
npm run build || exit 1

# 2. 如果 dist/ 有变更，自动提交
if [ -n "$(git status --porcelain plugins/token-reporter/dist)" ]; then
  git add plugins/token-reporter/dist
  git commit -m "chore: rebuild token-reporter frontend dist"
fi

# 3. 版本检查（现有逻辑）
node plugins/token-reporter/scripts/check-version.cjs
```

---

## 7. 实施步骤

### Phase 1: 脚手架搭建

1. 创建 `frontend/` 目录，初始化 `package.json`、`vite.config.ts`、`tsconfig.json`、`index.html`
2. 安装依赖：`react`, `react-dom`, `zustand`, `sass`, `typescript`, `vite`, `@vitejs/plugin-react`
3. 创建 `src/main.tsx` + `App.tsx` 最小渲染
4. 创建 `styles/global.scss`（从 `variables.css` + `layout.css` body 部分迁移）
5. 验证 `npm run dev` 可启动

### Phase 2: 类型 + 工具 + Store（基础层）

6. 编写 `types/api.ts` 和 `types/state.ts`（核对 parser.js 实际输出）
7. 迁移 `utils/format.ts`（从 utils.js，纯函数 1:1 转换 + 类型标注）
8. 迁移 `utils/canvas.ts`（setupCanvas, getSegs）
9. 创建 4 个 Zustand store
10. 编写 `services/api.ts`（fetch 封装）
11. 编写 `services/adapter.ts`（从 session.js adaptSession 迁移）

### Phase 3: 图表组件（视觉基础）

12. `StickyChart` 容器组件 + SCSS
13. `DimBar` 维度切换
14. `MainChart` Canvas 组件 -- 迁移 chart.js `drawMainChart()`
15. `BrushChart` Canvas 组件 -- 迁移 `drawBrushChart()`
16. `BrushOverlay` -- 迁移 brush 拖拽逻辑
17. MainChart 交互（拖拽平移、hover、点击）
18. `SessionBar`（下拉选择 + 复制 + 汇总）、`ChartLegend`
19. `LimitsDisplay` -- 迁移 renderer.js `renderLimits()`

### Phase 4: 对话列表（最大工作量）

20. `TokenBadges` 和 `CopyButton` 公共组件
21. `TurnItem` 容器
22. `UserMessage` + `AssistantMessage`（含展开/折叠）
23. `ThinkingBlock`
24. `ToolGroup`（可折叠组头 + pills + 统计面板）
25. `ToolCard`（单个工具详情，可展开）
26. `CompactEvent` + `CommandEvent`
27. `SubagentSummary` + `SubagentCard` + `SubagentTurn` + `SubagentToolGroup`

### Phase 5: 数据加载 + SSE

28. 在 `App.tsx` 中接入 `sessionStore.fetchSessions()` + `loadSession()`
29. `useSSE` hook -- 迁移 SSE 逻辑（含指数退避重连）
30. `useScrollSync` hook -- 迁移滚动 <-> brush 同步
31. `LoadingState` + `ErrorDisplay` 组件

### Phase 6: 集成 + 调优

32. `ConversationList` 渲染 items
33. hover 高亮联动（图表 <-> 对话列表）
34. SSE 实时更新验证（expand 状态保持）
35. `scrollToTurnIndex` 实现
36. React.memo 性能优化（TurnItem, ToolCard）
37. 视觉对比验证

### Phase 7: 构建 + 部署

38. `npm run build`，验证 dist/ 输出
39. 修改 `server.js` 从 dist/ 提供服务
40. 设置 pre-push hook
41. 清理旧的 `src/js/` 和 `src/css/` 文件（保留 server.js, parser.js 等后端文件）
42. 提交 dist/，端到端测试

---

## 8. 验证方案

### 功能验证清单

- [ ] 会话列表加载和切换
- [ ] 会话 ID 复制
- [ ] localStorage 记住上次选择的会话
- [ ] 主图表渲染（柱状图、Y 轴、时间轴）
- [ ] Brush 拖拽（左/右手柄、整体移动）
- [ ] 维度切换（input/output/cacheR/cacheC）
- [ ] 图表 hover 高亮 + 对话列表同步
- [ ] 图表点击跳转到对应轮次
- [ ] 滚动 <-> brush 双向同步
- [ ] 对话轮次渲染（用户/助手消息、model tag）
- [ ] 思考过程折叠/展开
- [ ] 工具组折叠/展开 + 统计面板
- [ ] 工具卡片详情展开 + 参数显示 + 输出复制
- [ ] Subagent 渲染（汇总、轮次、工具组）
- [ ] 系统事件（compact、command）
- [ ] SSE 实时更新（数据刷新，展开状态保持）
- [ ] SSE 断线重连（指数退避，最多 5 次）
- [ ] Limits 显示（Context/5h/7d 进度条 + 重置时间）
- [ ] 骨架屏和加载状态
- [ ] 错误提示

### 构建验证

- [ ] `npm run build` 成功
- [ ] `dist/index.html` + `dist/assets/` 生成
- [ ] server.js 从 dist/ 正确提供服务
- [ ] pre-push hook 自动构建 + 提交 dist/

### 关键文件

- `plugins/token-reporter/src/js/renderer.js` -- 需要拆分为 ~15 个 React 组件
- `plugins/token-reporter/src/js/session.js` -- SSE + 数据加载逻辑迁移为 store + hook
- `plugins/token-reporter/src/js/chart.js` -- Canvas 绘制逻辑迁移到 useEffect
- `plugins/token-reporter/src/js/interactions.js` -- 拖拽/滚动逻辑迁移到组件事件 + hook
- `plugins/token-reporter/src/server.js` -- 最小修改，改为服务 dist/
- `plugins/token-reporter/src/parser.js` -- 不修改，但需核对其输出类型
