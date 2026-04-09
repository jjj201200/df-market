# New Session Detection & Badge Notification

**Date:** 2026-04-09  
**Status:** Approved

## Overview

当有新的 Claude Code session 被创建时，前端能够实时感知并在 session 下拉按钮上显示数字徽标。用户点击某个新 session 后，该 session 的"新"标记消除。

## Architecture

整体链路：

```
session-start.js (hook)
  → POST /notify-new-session  { sessionId }
    → server.js 广播 SSE: { type: "new_session", sessionId }
      → useSSE.ts 接收
        → sessionStore.fetchSessionsQuietly() 静默刷新列表
        → sessionStore.addNewSessionId(sessionId)
          → SessionBar 显示徽标
          → Dropdown 列表中该条目高亮
```

## Backend Changes

### `hooks/session-start.js`

在服务器启动、PID 文件确认存在后，新增：

```js
// 通知服务器有新 session
const http = require('http');
const port = config.port || 3737;
const sessionId = process.env.CLAUDE_SESSION_ID || '';
const body = JSON.stringify({ sessionId });
const req = http.request(
  { hostname: '127.0.0.1', port, path: '/notify-new-session', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
  () => {}
);
req.on('error', () => {}); // 静默失败，不影响 hook 正常退出
req.end(body);
```

注意：使用 `http.request` 而非 `fetch`，因为 Node.js 旧版本兼容性更好；发送后不等待响应，hook 照常 `process.exit(0)`。

### `src/server.js`

新增 `/notify-new-session` 端点：

```js
if (url.pathname === '/notify-new-session' && req.method === 'POST') {
  let body = '';
  req.on('data', (d) => (body += d));
  req.on('end', () => {
    try {
      const { sessionId } = JSON.parse(body);
      broadcast({ type: 'new_session', sessionId: sessionId || '' });
    } catch {}
    res.writeHead(200).end('ok');
  });
  return;
}
```

广播事件格式：
```json
{ "type": "new_session", "sessionId": "abc123..." }
```

## Frontend Changes

### `stores/sessionStore.ts`

新增状态字段与方法：

```ts
newSessionIds: Set<string>          // 未读的新 session ID 集合

addNewSessionId(id: string): void   // 添加一个新 session ID
clearNewSessionId(id: string): void // 点击时清除单个 ID
fetchSessionsQuietly(): Promise<void> // 静默刷新列表（不触发 loading 状态，不切换当前 session）
```

`fetchSessionsQuietly` 实现要点：
- 调用 `getSessions()` 获取最新列表
- 仅执行 `set({ sessions: list })`
- 不修改 `sessionsLoading`、`activeSessionId`

`loadSession` 内部在成功加载后调用 `clearNewSessionId(sessionId)`。

### `hooks/useSSE.ts`

在事件处理中新增 `new_session` 分支：

```ts
} else if (msg.type === 'new_session') {
  await get().fetchSessionsQuietly();
  if (msg.sessionId) {
    get().addNewSessionId(msg.sessionId);
  }
}
```

### `components/common/Dropdown.tsx`

`DropdownOption` 接口新增可选字段：

```ts
export interface DropdownOption {
  value: string;
  label: string;
  sub?: string;
  isNew?: boolean; // 新增：是否显示"新"标记
}
```

列表项渲染时，若 `opt.isNew` 为 `true`，在条目右侧追加一个 `NEW` 徽标 span（通过 CSS Module 样式控制，小圆角红色标签）。

### `components/StickyChart/SessionBar.tsx`

1. 从 `sessionStore` 订阅 `newSessionIds`
2. 构造 `sessionOptions` 时，为 `newSessionIds` 中存在的 session 设置 `isNew: true`
3. `handleSessionChange` 中调用 `loadSession`（`loadSession` 内部已处理 `clearNewSessionId`）
4. 在 `Dropdown` 外层包裹相对定位容器，当 `newSessionIds.size > 0` 时渲染徽标：

```tsx
// 徽标：绝对定位在 Dropdown 触发按钮右上角
{newSessionIds.size > 0 && (
  <span className={styles.newBadge}>
    {newSessionIds.size > 9 ? '9+' : newSessionIds.size}
  </span>
)}
```

### `components/StickyChart/SessionBar.module.scss`

```scss
.sessionSelectContainer {
  position: relative; // 已存在，确保徽标定位参照
}

.newBadge {
  position: absolute;
  top: -4px;
  right: -4px; // 相对于 Dropdown 触发按钮右上角
  background: var(--color-danger, #e53e3e);
  color: #fff;
  border-radius: 9999px;
  font-size: 10px;
  font-weight: 700;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 10;
}
```

### `components/common/Dropdown.module.scss`

列表中新 session 条目的 `NEW` 标签样式：

```scss
.optNew {
  margin-left: auto;
  background: var(--color-danger, #e53e3e);
  color: #fff;
  border-radius: 4px;
  font-size: 9px;
  font-weight: 700;
  padding: 1px 4px;
  flex-shrink: 0;
}
```

## Edge Cases

- **服务器未启动时 hook 发送失败**：使用 `req.on('error', () => {})` 静默忽略，不影响 session 正常启动。
- **当前 session 就是新 session**：`loadSession` 调用后 `clearNewSessionId` 会立即清除，徽标不出现或瞬间消失。
- **多个新 session 同时到达**：`newSessionIds` 是 Set，每个 SSE 事件独立处理，徽标数字正确累加。
- **sessionId 为空字符串**：`addNewSessionId` 跳过空字符串（`if (msg.sessionId)`已守卫）。
- **页面刷新后**：`newSessionIds` 不持久化，刷新后重置为空 Set，符合预期（刷新即代表用户主动重新加载）。

## Out of Scope

- 新 session 的持久化提醒（刷新后丢失）
- 声音/系统通知
- 徽标动画效果
