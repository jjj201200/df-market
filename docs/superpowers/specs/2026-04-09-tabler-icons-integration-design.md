# Tabler Icons Integration

**Date:** 2026-04-09  
**Status:** Approved

## Overview

将前端所有符号标志（除 ❤️ 外）替换为 [Tabler Icons](https://tabler.io/icons)（React SVG 组件），按需打包，不引入未使用的图标。

## Icon Mapping

当前符号与对应 Tabler Icons 的映射：

| 符号 | 语义 | Tabler Icon | 组件名 |
|------|------|-------------|--------|
| `&#x25BE;` ▼ 下拉箭头 | Dropdown 触发按钮 | `chevron-down` | `IconChevronDown` |
| `&#x25B6;` ▶ 向右展开 | SubagentSummary、SubagentCard | `chevron-right` | `IconChevronRight` |
| `▼` 向下收起 | ThinkingBlock、UserMessage、AssistantMessage | `chevron-down` | `IconChevronDown` |
| `▶` 向右展开 | ThinkingBlock、UserMessage、AssistantMessage、ToolCard、ToolGroup、CommandEvent | `chevron-right` | `IconChevronRight` |
| `▲` 向上收起 | UserMessage、AssistantMessage | `chevron-up` | `IconChevronUp` |
| `⚡` `&#9889;` 紧凑事件 | CompactEvent | `bolt` | `IconBolt` |
| `⌘` `&#8984;` Command 键 | CommandEvent | `command` | `IconCommand` |
| `→` `&rarr;` MCP 方法箭头 | ToolCard | `arrow-right` | `IconArrowRight` |
| `↗` 跳转到分析 | StickyChart | `external-link` | `IconExternalLink` |
| `⊞` 退出分屏 | AnalyticsDrawer | `layout-columns` | `IconLayoutColumns` |
| `⊟` 进入分屏 | AnalyticsDrawer | `layout-sidebar-right` | `IconLayoutSidebarRight` |
| `✕` 关闭按钮 | AnalyticsDrawer | `x` | `IconX` |
| `🧠` 思考块 | ThinkingBlock | `brain` | `IconBrain` |
| `·` `&middot;` 分隔符 | ToolGroup | 保留原字符，非图标 |

**不替换：** ❤️（品牌标识，保留 emoji）、`·` 中点分隔符（文字分隔符，非图标）。

## Dependency Setup

```bash
cd plugins/token-reporter/frontend
npm install @tabler/icons-react
```

`@tabler/icons-react` 的每个图标都是独立的具名 export，Vite 的 tree-shaking 会自动只打包实际 import 的图标，无需额外配置。

## Implementation Approach

### 直接在组件内 import，不创建包装层

每个组件直接从 `@tabler/icons-react` import 所需图标：

```tsx
import {IconChevronDown} from '@tabler/icons-react';
```

不创建全局 Icon 包装组件——因为各处图标用法差异较大（size、stroke、className 各不同），包装层只会增加复杂度。

### 统一 size 和 stroke

所有图标使用统一参数，除非视觉上明显需要调整：
- `size={14}` — 默认内联图标尺寸
- `stroke={1.5}` — Tabler 默认线宽

部分场景特殊处理：
- AnalyticsDrawer 的关闭/分屏图标：`size={16}`
- StickyChart 的跳转箭头：`size={14}`
- ThinkingBlock 的大脑图标：`size={14}`

### CSS 调整

现有代码中部分符号通过 CSS `transition` / `transform: rotate()` 实现方向切换（如展开/收起箭头）。替换后：
- 展开状态：使用 `IconChevronDown`，收起状态：使用 `IconChevronRight`（条件渲染）
- 或：保持单一图标 + CSS `transform: rotate(90deg)` 切换，视现有实现而定

SVG 图标默认是 `inline` 元素，需确保与文字垂直居中对齐：

```scss
// 在需要的地方添加
svg {
  vertical-align: middle;
  flex-shrink: 0;
}
```

## Files to Modify

| 文件 | 替换内容 |
|------|---------|
| `components/common/Dropdown.tsx` | `&#x25BE;` → `IconChevronDown` |
| `components/Subagent/SubagentSummary.tsx` | `&#x25B6;` → `IconChevronRight` |
| `components/Subagent/SubagentCard.tsx` | `&#x25B6;` → `IconChevronRight` |
| `components/ConversationList/CompactEvent.tsx` | `&#9889;` → `IconBolt` |
| `components/ConversationList/CommandEvent.tsx` | `&#8984;` → `IconCommand`，`&#9654;` → `IconChevronRight` |
| `components/ConversationList/ThinkingBlock.tsx` | `🧠` → `IconBrain`，`▼`/`▶` → `IconChevronDown`/`IconChevronRight` |
| `components/ConversationList/UserMessage.tsx` | `▲`/`▼` → `IconChevronUp`/`IconChevronDown` |
| `components/ConversationList/AssistantMessage.tsx` | `▲`/`▼` → `IconChevronUp`/`IconChevronDown` |
| `components/ConversationList/ToolCard.tsx` | `▶` → `IconChevronRight`，`&rarr;` → `IconArrowRight` |
| `components/ConversationList/ToolGroup.tsx` | `▶` → `IconChevronRight` |
| `components/Analytics/AnalyticsDrawer.tsx` | `⊞`/`⊟` → `IconLayoutColumns`/`IconLayoutSidebarRight`，`✕` → `IconX` |
| `components/StickyChart/StickyChart.tsx` | `↗` → `IconExternalLink` |

## Bundle Impact

`@tabler/icons-react` 包含 5000+ 图标，但每个图标是独立 export 的 SVG 组件。Vite 生产构建时 tree-shaking 只打包实际 import 的图标。预计本次使用约 10 个图标，bundle 增量约 **+3-5 KB gzipped**。

## Out of Scope

- 自定义图标样式主题
- 图标动画效果
- 其他组件库的图标（统一使用 Tabler）
