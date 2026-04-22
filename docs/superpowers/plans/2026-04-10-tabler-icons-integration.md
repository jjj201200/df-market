# Tabler Icons Integration Implementation Plan

> **Status**: ✓ 已完成
> **最后更新**: 2026-04-15（实施提交：`776ce1c` `fc690f7` `5437d53` `5b24187`）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将前端所有符号标志（除 ❤️ 外）替换为 Tabler Icons SVG React 组件，按需打包，不引入未使用的图标。

**Architecture:** 直接在每个组件内 import 所需 Tabler icon，利用 Vite tree-shaking 自动按需打包。不创建全局包装层。所有图标统一 `size={14} stroke={1.5}`，部分场景特殊处理。

**Tech Stack:** `@tabler/icons-react`，React，Vite (tree-shaking)，CSS Modules

---

### Task 1: 安装 @tabler/icons-react 依赖

**Files:**

- Modify: `plugins/token-reporter/frontend/package.json`

- [x] **Step 1: 安装依赖**

```bash
cd plugins/token-reporter/frontend
npm install @tabler/icons-react
```

- [x] **Step 2: 验证安装成功**

```bash
node -e "const {IconX} = require('@tabler/icons-react'); console.log('ok', typeof IconX)"
```

预期输出：`ok function`

- [x] **Step 3: 提交**

```bash
git add plugins/token-reporter/frontend/package.json \
        plugins/token-reporter/frontend/package-lock.json
git commit -m "feat(token-reporter): install @tabler/icons-react"
```

---

### Task 2: 替换 Dropdown.tsx 的下拉箭头

**Files:**

- Modify: `plugins/token-reporter/frontend/src/components/common/Dropdown.tsx`
- Modify: `plugins/token-reporter/frontend/src/components/common/Dropdown.module.scss`

当前：第 107 行 `<span className={...}>&#x25BE;</span>` 用 CSS `rotate(180deg)` 翻转实现展开状态。
替换后：用 `IconChevronDown`，CSS transform 保持不变（图标本身朝下，旋转 180 度变朝上，符合逻辑）。

- [x] **Step 1: 添加 import**

在 `Dropdown.tsx` 第 1 行 import 列表末尾添加：

```ts
import {IconChevronDown} from '@tabler/icons-react';
```

- [x] **Step 2: 替换 chevron span**

将第 107 行：

```tsx
<span className={clsx(styles.chevron, open && styles.chevronOpen)}>&#x25BE;</span>
```

替换为：

```tsx
<span className={clsx(styles.chevron, open && styles.chevronOpen)}>
  <IconChevronDown size={12} stroke={1.5} />
</span>
```

- [x] **Step 3: 更新 chevron CSS（移除 font-size，SVG 不需要）**

在 `Dropdown.module.scss` 中，将：

```scss
.chevron {
  font-size: 10px;
  color: var(--fg-subtle);
  transition: transform 0.15s;
  flex-shrink: 0;
}
```

替换为：

```scss
.chevron {
  color: var(--fg-subtle);
  transition: transform 0.15s;
  flex-shrink: 0;
  display: flex;
  align-items: center;
}
```

- [x] **Step 4: 验证 TypeScript 编译无错误**

```bash
cd plugins/token-reporter/frontend
npx tsc --noEmit
```

- [x] **Step 5: 提交**

```bash
git add plugins/token-reporter/frontend/src/components/common/Dropdown.tsx \
        plugins/token-reporter/frontend/src/components/common/Dropdown.module.scss
git commit -m "feat(token-reporter): replace dropdown chevron with IconChevronDown"
```

---

### Task 3: 替换 AnalyticsDrawer.tsx 的图标

**Files:**

- Modify: `plugins/token-reporter/frontend/src/components/Analytics/AnalyticsDrawer.tsx`

当前符号：

- 第 47 行 `⊞` — 退出分屏（split view 模式下）
- 第 52 行 `✕` — 关闭（split view 模式下）
- 第 76 行 `⊟` — 进入分屏（普通 drawer 模式下）
- 第 81 行 `✕` — 关闭（普通 drawer 模式下）

- [x] **Step 1: 添加 import**

在 `AnalyticsDrawer.tsx` 第 1 行 import 列表末尾添加：

```ts
import {IconX, IconLayoutColumns, IconLayoutSidebarRight} from '@tabler/icons-react';
```

- [x] **Step 2: 替换 split view 模式下的图标（第 46-54 行）**

将：

```tsx
            <Tooltip content={t('nav.exitSplitView')}>
              <button className={s.closeBtn} onClick={toggleSplitView}>
                ⊞
              </button>
            </Tooltip>
            <Tooltip content={t('common.close')}>
              <button className={s.closeBtn} onClick={closeDrawer}>
                ✕
              </button>
            </Tooltip>
```

替换为：

```tsx
            <Tooltip content={t('nav.exitSplitView')}>
              <button className={s.closeBtn} onClick={toggleSplitView}>
                <IconLayoutColumns size={16} stroke={1.5} />
              </button>
            </Tooltip>
            <Tooltip content={t('common.close')}>
              <button className={s.closeBtn} onClick={closeDrawer}>
                <IconX size={16} stroke={1.5} />
              </button>
            </Tooltip>
```

- [x] **Step 3: 替换普通 drawer 模式下的图标（第 74-83 行）**

将：

```tsx
            <Tooltip content={t('nav.splitView')}>
              <button className={s.closeBtn} onClick={toggleSplitView}>
                ⊟
              </button>
            </Tooltip>
            <Tooltip content={t('common.close')}>
              <button className={s.closeBtn} onClick={closeDrawer}>
                ✕
              </button>
            </Tooltip>
```

替换为：

```tsx
            <Tooltip content={t('nav.splitView')}>
              <button className={s.closeBtn} onClick={toggleSplitView}>
                <IconLayoutSidebarRight size={16} stroke={1.5} />
              </button>
            </Tooltip>
            <Tooltip content={t('common.close')}>
              <button className={s.closeBtn} onClick={closeDrawer}>
                <IconX size={16} stroke={1.5} />
              </button>
            </Tooltip>
```

- [x] **Step 4: 验证 TypeScript 编译无错误**

```bash
cd plugins/token-reporter/frontend
npx tsc --noEmit
```

- [x] **Step 5: 提交**

```bash
git add plugins/token-reporter/frontend/src/components/Analytics/AnalyticsDrawer.tsx
git commit -m "feat(token-reporter): replace AnalyticsDrawer symbols with Tabler icons"
```

---

### Task 4: 替换 StickyChart.tsx 的跳转箭头

**Files:**

- Modify: `plugins/token-reporter/frontend/src/components/StickyChart/StickyChart.tsx`

当前：第 78 行 `{t('nav.analytics')} ↗`

- [x] **Step 1: 添加 import**

在 `StickyChart.tsx` 第 1 行 import 列表末尾添加：

```ts
import {IconExternalLink} from '@tabler/icons-react';
```

- [x] **Step 2: 替换跳转箭头**

将第 78 行：

```tsx
          {t('nav.analytics')} ↗
```

替换为：

```tsx
{
  t('nav.analytics');
}
<IconExternalLink size={12} stroke={1.5} style={{verticalAlign: 'middle'}} />;
```

- [x] **Step 3: 验证 TypeScript 编译无错误**

```bash
cd plugins/token-reporter/frontend
npx tsc --noEmit
```

- [x] **Step 4: 提交**

```bash
git add plugins/token-reporter/frontend/src/components/StickyChart/StickyChart.tsx
git commit -m "feat(token-reporter): replace analytics button arrow with IconExternalLink"
```

---

### Task 5: 替换 CompactEvent.tsx 的闪电符号

**Files:**

- Modify: `plugins/token-reporter/frontend/src/components/ConversationList/CompactEvent.tsx`

当前：第 50 行 `<span style={styles.bolt}>&#9889;</span>`

- [x] **Step 1: 添加 import**

在 `CompactEvent.tsx` 第 1 行 import 列表末尾添加：

```ts
import {IconBolt} from '@tabler/icons-react';
```

- [x] **Step 2: 替换闪电符号**

将第 50 行：

```tsx
<span style={styles.bolt}>&#9889;</span>
```

替换为：

```tsx
<IconBolt size={14} stroke={1.5} style={styles.bolt} />
```

- [x] **Step 3: 验证 TypeScript 编译无错误**

```bash
cd plugins/token-reporter/frontend
npx tsc --noEmit
```

- [x] **Step 4: 提交**

```bash
git add plugins/token-reporter/frontend/src/components/ConversationList/CompactEvent.tsx
git commit -m "feat(token-reporter): replace CompactEvent bolt symbol with IconBolt"
```

---

### Task 6: 替换 CommandEvent.tsx 的符号

**Files:**

- Modify: `plugins/token-reporter/frontend/src/components/ConversationList/CommandEvent.tsx`

当前：

- 第 28 行 `&#8984;` ⌘ — Command 键图标
- 第 35 行 `&#9654;` ▶ — 展开箭头（CSS transition，展开时可能旋转）

- [x] **Step 1: 添加 import**

在 `CommandEvent.tsx` 第 1 行 import 列表末尾添加：

```ts
import {IconCommand, IconChevronRight} from '@tabler/icons-react';
```

- [x] **Step 2: 替换 Command 键图标（第 28 行）**

将：

```tsx
<span className={s.evCmdIcon}>&#8984;</span>
```

替换为：

```tsx
<span className={s.evCmdIcon}>
  <IconCommand size={14} stroke={1.5} />
</span>
```

- [x] **Step 3: 替换展开箭头（第 35 行）**

将：

```tsx
<span className={s.arrow}>&#9654;</span>
```

替换为：

```tsx
<span className={s.arrow}>
  <IconChevronRight size={14} stroke={1.5} />
</span>
```

- [x] **Step 4: 确认现有 CSS 中 `.arrow` 的旋转动画仍然适用**

查看 `CommandEvent.module.scss`，确认 `.arrow` 通过 `transform: rotate(90deg)` 或类似方式处理展开状态。SVG 图标会继承 transform，无需调整。

- [x] **Step 5: 验证 TypeScript 编译无错误**

```bash
cd plugins/token-reporter/frontend
npx tsc --noEmit
```

- [x] **Step 6: 提交**

```bash
git add plugins/token-reporter/frontend/src/components/ConversationList/CommandEvent.tsx
git commit -m "feat(token-reporter): replace CommandEvent symbols with Tabler icons"
```

---

### Task 7: 替换 ThinkingBlock.tsx 的符号

**Files:**

- Modify: `plugins/token-reporter/frontend/src/components/ConversationList/ThinkingBlock.tsx`

当前：

- 第 25 行 `🧠` — 大脑图标
- 第 28 行 模板字符串中 `▼`/`▶` — 展开/收起箭头

- [x] **Step 1: 添加 import**

在 `ThinkingBlock.tsx` 第 1 行 import 列表末尾添加：

```ts
import {IconBrain, IconChevronDown, IconChevronRight} from '@tabler/icons-react';
```

- [x] **Step 2: 替换大脑图标（第 25 行）**

将：

```tsx
<span className={s.thinkingIcon}>🧠</span>
```

替换为：

```tsx
<span className={s.thinkingIcon}>
  <IconBrain size={14} stroke={1.5} />
</span>
```

- [x] **Step 3: 替换展开/收起箭头（第 28 行）**

将：

```tsx
<span className={s.thinkingToggle}>{expanded ? `▼ ${t('common.collapse')}` : `▶ ${t('common.expand')}`}</span>
```

替换为：

```tsx
<span className={s.thinkingToggle}>
  {expanded ? (
    <>
      <IconChevronDown size={12} stroke={1.5} style={{verticalAlign: 'middle'}} /> {t('common.collapse')}
    </>
  ) : (
    <>
      <IconChevronRight size={12} stroke={1.5} style={{verticalAlign: 'middle'}} /> {t('common.expand')}
    </>
  )}
</span>
```

- [x] **Step 4: 验证 TypeScript 编译无错误**

```bash
cd plugins/token-reporter/frontend
npx tsc --noEmit
```

- [x] **Step 5: 提交**

```bash
git add plugins/token-reporter/frontend/src/components/ConversationList/ThinkingBlock.tsx
git commit -m "feat(token-reporter): replace ThinkingBlock symbols with Tabler icons"
```

---

### Task 8: 替换 UserMessage.tsx 和 AssistantMessage.tsx 的展开/收起箭头

**Files:**

- Modify: `plugins/token-reporter/frontend/src/components/ConversationList/UserMessage.tsx`
- Modify: `plugins/token-reporter/frontend/src/components/ConversationList/AssistantMessage.tsx`

当前：两个文件各有一处 `expanded ? \`▲ ...\` : \`▼ ...\``

- [x] **Step 1: 修改 UserMessage.tsx**

添加 import：

```ts
import {IconChevronUp, IconChevronDown} from '@tabler/icons-react';
```

将第 50 行：

```tsx
{
  expanded ? `▲ ${t('common.collapse')}` : `▼ ${t('common.expandAll')}`;
}
```

替换为：

```tsx
{
  expanded ? (
    <>
      <IconChevronUp size={12} stroke={1.5} style={{verticalAlign: 'middle'}} /> {t('common.collapse')}
    </>
  ) : (
    <>
      <IconChevronDown size={12} stroke={1.5} style={{verticalAlign: 'middle'}} /> {t('common.expandAll')}
    </>
  );
}
```

- [x] **Step 2: 修改 AssistantMessage.tsx**

添加 import：

```ts
import {IconChevronUp, IconChevronDown} from '@tabler/icons-react';
```

将第 53 行：

```tsx
{
  expanded ? `▲ ${t('common.collapse')}` : `▼ ${t('common.expandAll')}`;
}
```

替换为：

```tsx
{
  expanded ? (
    <>
      <IconChevronUp size={12} stroke={1.5} style={{verticalAlign: 'middle'}} /> {t('common.collapse')}
    </>
  ) : (
    <>
      <IconChevronDown size={12} stroke={1.5} style={{verticalAlign: 'middle'}} /> {t('common.expandAll')}
    </>
  );
}
```

- [x] **Step 3: 验证 TypeScript 编译无错误**

```bash
cd plugins/token-reporter/frontend
npx tsc --noEmit
```

- [x] **Step 4: 提交**

```bash
git add plugins/token-reporter/frontend/src/components/ConversationList/UserMessage.tsx \
        plugins/token-reporter/frontend/src/components/ConversationList/AssistantMessage.tsx
git commit -m "feat(token-reporter): replace expand/collapse arrows with Tabler icons"
```

---

### Task 9: 替换 ToolCard.tsx 的符号

**Files:**

- Modify: `plugins/token-reporter/frontend/src/components/ConversationList/ToolCard.tsx`

当前：

- 第 75 行 `&rarr;` → — MCP 方法箭头
- 第 93 行 `▶` — 展开参数箭头

- [x] **Step 1: 添加 import**

在 `ToolCard.tsx` 第 1 行 import 列表末尾添加：

```ts
import {IconArrowRight, IconChevronRight} from '@tabler/icons-react';
```

- [x] **Step 2: 替换 MCP 箭头（第 75 行）**

将：

```tsx
<span className={s.tcMcpSep}>&rarr;</span>
```

替换为：

```tsx
<span className={s.tcMcpSep}>
  <IconArrowRight size={12} stroke={1.5} style={{verticalAlign: 'middle'}} />
</span>
```

- [x] **Step 3: 替换展开参数箭头（第 93 行）**

将：

```tsx
<span className={s.arrow}>▶</span>
```

替换为：

```tsx
<span className={s.arrow}>
  <IconChevronRight size={14} stroke={1.5} />
</span>
```

- [x] **Step 4: 验证 TypeScript 编译无错误**

```bash
cd plugins/token-reporter/frontend
npx tsc --noEmit
```

- [x] **Step 5: 提交**

```bash
git add plugins/token-reporter/frontend/src/components/ConversationList/ToolCard.tsx
git commit -m "feat(token-reporter): replace ToolCard symbols with Tabler icons"
```

---

### Task 10: 替换 ToolGroup.tsx 的展开箭头

**Files:**

- Modify: `plugins/token-reporter/frontend/src/components/ConversationList/ToolGroup.tsx`

当前：第 55 行 `▶`，通过 `clsx(s.arrow, expanded && s.open)` 的 CSS 旋转实现展开状态。

- [x] **Step 1: 添加 import**

在 `ToolGroup.tsx` 第 1 行 import 列表末尾添加：

```ts
import {IconChevronRight} from '@tabler/icons-react';
```

- [x] **Step 2: 替换展开箭头（第 55 行）**

将：

```tsx
<span className={clsx(s.arrow, expanded && s.open)}>▶</span>
```

替换为：

```tsx
<span className={clsx(s.arrow, expanded && s.open)}>
  <IconChevronRight size={14} stroke={1.5} />
</span>
```

- [x] **Step 3: 验证 TypeScript 编译无错误**

```bash
cd plugins/token-reporter/frontend
npx tsc --noEmit
```

- [x] **Step 4: 提交**

```bash
git add plugins/token-reporter/frontend/src/components/ConversationList/ToolGroup.tsx
git commit -m "feat(token-reporter): replace ToolGroup arrow with IconChevronRight"
```

---

### Task 11: 替换 SubagentSummary.tsx 和 SubagentCard.tsx 的展开箭头

**Files:**

- Modify: `plugins/token-reporter/frontend/src/components/Subagent/SubagentSummary.tsx`
- Modify: `plugins/token-reporter/frontend/src/components/Subagent/SubagentCard.tsx`

当前：

- `SubagentSummary.tsx` 第 70 行：`&#x25B6;`，通过 `clsx(s.arrow, expanded && s.open)` 旋转
- `SubagentCard.tsx` 第 51 行：`&#x25B6;`，通过 `${s.arrow} ${expanded ? s.open : ''}` 旋转

- [x] **Step 1: 修改 SubagentSummary.tsx**

添加 import（在文件第 1 行现有 imports 末尾）：

```ts
import {IconChevronRight} from '@tabler/icons-react';
```

将第 70 行：

```tsx
<span className={clsx(s.arrow, expanded && s.open)}>&#x25B6;</span>
```

替换为：

```tsx
<span className={clsx(s.arrow, expanded && s.open)}>
  <IconChevronRight size={14} stroke={1.5} />
</span>
```

- [x] **Step 2: 修改 SubagentCard.tsx**

添加 import（在文件第 1 行现有 imports 末尾）：

```ts
import {IconChevronRight} from '@tabler/icons-react';
```

将第 51 行：

```tsx
<span className={`${s.arrow} ${expanded ? s.open : ''}`}>&#x25B6;</span>
```

替换为：

```tsx
<span className={`${s.arrow} ${expanded ? s.open : ''}`}>
  <IconChevronRight size={14} stroke={1.5} />
</span>
```

- [x] **Step 3: 验证 TypeScript 编译无错误**

```bash
cd plugins/token-reporter/frontend
npx tsc --noEmit
```

- [x] **Step 4: 提交**

```bash
git add plugins/token-reporter/frontend/src/components/Subagent/SubagentSummary.tsx \
        plugins/token-reporter/frontend/src/components/Subagent/SubagentCard.tsx
git commit -m "feat(token-reporter): replace Subagent expand arrows with IconChevronRight"
```

---

### Task 12: 构建验证并提交产物

**Files:**

- Modify: `plugins/token-reporter/dist/` (构建产物)

- [x] **Step 1: 构建前端**

```bash
cd plugins/token-reporter/frontend
npm run build
```

预期：无错误，`dist/` 目录更新。

- [x] **Step 2: 验证 bundle 中只包含用到的图标**

```bash
# 检查 bundle 中有 IconChevronDown 等，但没有随机未使用的图标如 IconAnchor
grep -l "IconAnchor\|iconAnchor\|anchor" plugins/token-reporter/dist/assets/*.js | wc -l
```

预期：输出 `0`（未使用的图标不在 bundle 中）。

- [x] **Step 3: 运行现有测试**

```bash
cd plugins/token-reporter
node test/test-hooks.js
node test/test-migration.js
node test/test-single-instance.js
```

预期：所有测试通过。

- [x] **Step 4: 版本检查**

```bash
node plugins/token-reporter/scripts/check-version.cjs
```

如提示需要 bump，运行：

```bash
node plugins/token-reporter/scripts/bump-version.cjs minor
```

- [x] **Step 5: 提交构建产物**

```bash
git add plugins/token-reporter/dist/
git commit -m "chore: rebuild token-reporter frontend dist"
```
