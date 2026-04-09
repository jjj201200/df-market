# New Session Detection & Badge Notification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 当有新 Claude Code session 创建时，前端 session 下拉按钮显示数字徽标，下拉列表中新 session 条目高亮，点击后标记消除。

**Architecture:** `session-start.js` 在服务器启动后 POST `/notify-new-session`，服务端广播 `new_session` SSE 事件；前端 `useSSE` 收到后静默刷新 session 列表并记录新 session ID；`SessionBar` 在 Dropdown 上渲染徽标，`Dropdown` 列表中新条目显示 `NEW` 标签；点击 session 后 `loadSession` 清除该 ID 的标记。

**Tech Stack:** Node.js (backend hook + server)，React + Zustand + TypeScript (frontend)，CSS Modules (styling)

---

### Task 1: 后端 — server.js 新增 `/notify-new-session` 端点

**Files:**
- Modify: `plugins/token-reporter/backend/server.js:85-95`

- [ ] **Step 1: 在 `/notify` 端点之后插入新端点**

在 `server.js` 第 95 行（`/notify` 的 `return;` 之后），插入以下代码：

```js
  if (url.pathname === "/notify-new-session" && req.method === "POST") {
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", () => {
      try {
        const { sessionId } = JSON.parse(body);
        broadcast({ type: "new_session", sessionId: sessionId || "" });
      } catch {}
      res.writeHead(200).end("ok");
    });
    return;
  }
```

- [ ] **Step 2: 手动验证服务器能广播 `new_session` 事件**

启动服务器并用 curl 测试：
```bash
# 终端 1：启动服务器
cd plugins/token-reporter
node backend/server.js

# 终端 2：监听 SSE
curl -N http://localhost:3737/events

# 终端 3：发送通知
curl -X POST http://localhost:3737/notify-new-session \
  -H 'Content-Type: application/json' \
  -d '{"sessionId":"test-abc123"}'
```
预期终端 2 输出：`data: {"type":"new_session","sessionId":"test-abc123"}`

- [ ] **Step 3: 提交**

```bash
git add plugins/token-reporter/backend/server.js
git commit -m "feat(token-reporter): add /notify-new-session SSE broadcast endpoint"
```

---

### Task 2: 后端 — session-start.js 启动后通知服务器

**Files:**
- Modify: `plugins/token-reporter/hooks/session-start.js:111-117`

- [ ] **Step 1: 在等待 PID 写入完成后，添加通知逻辑**

将 `session-start.js` 第 111-117 行（等待 PID 循环 + `process.exit(0)`）替换为：

```js
  // 7. Wait for server.pid to be written (up to 3 seconds)
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 100));
    if (fs.existsSync(PID_PATH)) break;
  }

  // 8. Notify server of new session (fire-and-forget)
  const sessionId = process.env.CLAUDE_SESSION_ID || "";
  const port = config.port || 3737;
  const body = JSON.stringify({ sessionId });
  const notifyReq = http.request(
    {
      hostname: "127.0.0.1",
      port,
      path: "/notify-new-session",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    },
    () => {},
  );
  notifyReq.on("error", () => {});
  notifyReq.end(body);

  process.exit(0);
```

- [ ] **Step 2: 在文件顶部添加 `http` 模块引入**

在 `session-start.js` 第 1 行 `"use strict";` 之后，第 2 行 `const fs = require("fs");` 之前插入：

```js
const http = require("http");
```

- [ ] **Step 3: 手动验证 hook 能触发通知**

```bash
# 终端 1：启动服务器
cd plugins/token-reporter
node backend/server.js

# 终端 2：监听 SSE
curl -N http://localhost:3737/events

# 终端 3：模拟运行 hook（设置测试数据目录避免影响真实数据）
TOKEN_REPORTER_DATA_DIR=/tmp/tr-test CLAUDE_SESSION_ID=session-xyz node hooks/session-start.js
```
预期终端 2 输出：`data: {"type":"new_session","sessionId":"session-xyz"}`

- [ ] **Step 4: 提交**

```bash
git add plugins/token-reporter/hooks/session-start.js
git commit -m "feat(token-reporter): notify server of new session on startup"
```

---

### Task 3: 前端 — sessionStore 新增 newSessionIds 状态与方法

**Files:**
- Modify: `plugins/token-reporter/frontend/src/stores/sessionStore.ts`

- [ ] **Step 1: 扩展 `SessionStore` 接口**

在 `sessionStore.ts` 第 11 行的 `interface SessionStore {` 块中，在 `refreshCurrentSession` 之后添加：

```ts
  newSessionIds: Set<string>;
  addNewSessionId: (id: string) => void;
  clearNewSessionId: (id: string) => void;
  fetchSessionsQuietly: () => Promise<void>;
```

- [ ] **Step 2: 添加初始状态**

在 `create<SessionStore>((set, get) => ({` 的初始值块（第 26 行），在 `sessionError: null,` 之后添加：

```ts
  newSessionIds: new Set<string>(),
```

- [ ] **Step 3: 实现三个新方法**

在 `refreshCurrentSession` 方法之后添加：

```ts
  addNewSessionId: (id) => {
    if (!id) return;
    set((s) => ({ newSessionIds: new Set([...s.newSessionIds, id]) }));
  },

  clearNewSessionId: (id) => {
    set((s) => {
      const next = new Set(s.newSessionIds);
      next.delete(id);
      return { newSessionIds: next };
    });
  },

  fetchSessionsQuietly: async () => {
    try {
      const list = await getSessions();
      set({ sessions: list });
    } catch {
      // Silent failure — don't disrupt the current session view
    }
  },
```

- [ ] **Step 4: 在 `loadSession` 成功时清除标记**

在 `loadSession` 方法中，`localStorage.setItem(LAST_SESSION_KEY, sessionId);` 这行（第 84 行）之后添加：

```ts
      get().clearNewSessionId(sessionId);
```

- [ ] **Step 5: 验证 TypeScript 编译无错误**

```bash
cd plugins/token-reporter/frontend
npx tsc --noEmit
```
预期：无错误输出。

- [ ] **Step 6: 提交**

```bash
git add plugins/token-reporter/frontend/src/stores/sessionStore.ts
git commit -m "feat(token-reporter): add newSessionIds state and quiet refresh to sessionStore"
```

---

### Task 4: 前端 — useSSE 处理 new_session 事件

**Files:**
- Modify: `plugins/token-reporter/frontend/src/hooks/useSSE.ts`

- [ ] **Step 1: 订阅新 store 方法**

在 `useSSE.ts` 第 11 行，在 `const refreshCurrentSession` 之后添加：

```ts
  const fetchSessionsQuietly = useSessionStore((s) => s.fetchSessionsQuietly);
  const addNewSessionId = useSessionStore((s) => s.addNewSessionId);
```

- [ ] **Step 2: 在消息处理中新增 `new_session` 分支**

在 `es.onmessage` 的消息处理块中（第 64 行），在 `limits_update` 的 `else if` 之后添加：

```ts
            } else if (msg.type === 'new_session') {
              await fetchSessionsQuietly();
              if (msg.sessionId) {
                addNewSessionId(msg.sessionId);
              }
            }
```

- [ ] **Step 3: 更新 useEffect 依赖数组**

将 `useEffect` 的依赖数组（第 133 行）从：
```ts
  }, [refreshCurrentSession, setLimits]);
```
改为：
```ts
  }, [refreshCurrentSession, setLimits, fetchSessionsQuietly, addNewSessionId]);
```

- [ ] **Step 4: 验证 TypeScript 编译无错误**

```bash
cd plugins/token-reporter/frontend
npx tsc --noEmit
```
预期：无错误输出。

- [ ] **Step 5: 提交**

```bash
git add plugins/token-reporter/frontend/src/hooks/useSSE.ts
git commit -m "feat(token-reporter): handle new_session SSE event in useSSE"
```

---

### Task 5: 前端 — Dropdown 支持 isNew 标记与 NEW 标签

**Files:**
- Modify: `plugins/token-reporter/frontend/src/components/common/Dropdown.tsx`
- Modify: `plugins/token-reporter/frontend/src/components/common/Dropdown.module.scss`

- [ ] **Step 1: 扩展 `DropdownOption` 接口**

在 `Dropdown.tsx` 第 17 行的 `DropdownOption` 接口中，在 `sub?: string;` 之后添加：

```ts
  isNew?: boolean;
```

- [ ] **Step 2: 在普通渲染模式中添加 NEW 标签**

在非虚拟化渲染（第 144 行）的 `<button>` 内，在 `{opt.sub && ...}` 之后添加：

```tsx
                    {opt.isNew && <span className={styles.optNew}>NEW</span>}
```

- [ ] **Step 3: 在虚拟化渲染模式中也添加 NEW 标签**

在虚拟化渲染（第 124 行）的 `<button>` 内，在 `{opt.sub && ...}` 之后同样添加：

```tsx
                        {opt.isNew && <span className={styles.optNew}>NEW</span>}
```

- [ ] **Step 4: 在 Dropdown.module.scss 末尾添加 NEW 标签样式**

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
  line-height: 1.4;
}
```

- [ ] **Step 5: 验证 TypeScript 编译无错误**

```bash
cd plugins/token-reporter/frontend
npx tsc --noEmit
```

- [ ] **Step 6: 提交**

```bash
git add plugins/token-reporter/frontend/src/components/common/Dropdown.tsx \
        plugins/token-reporter/frontend/src/components/common/Dropdown.module.scss
git commit -m "feat(token-reporter): add isNew option support to Dropdown component"
```

---

### Task 6: 前端 — SessionBar 显示徽标并传递 isNew

**Files:**
- Modify: `plugins/token-reporter/frontend/src/components/StickyChart/SessionBar.tsx`
- Modify: `plugins/token-reporter/frontend/src/components/StickyChart/SessionBar.module.scss`

- [ ] **Step 1: 订阅 `newSessionIds`**

在 `SessionBar.tsx` 第 15 行现有 store 订阅之后添加：

```ts
  const newSessionIds = useSessionStore((s) => s.newSessionIds);
```

- [ ] **Step 2: 在 `sessionOptions` 构造中设置 `isNew`**

将现有的 `sessionOptions` useMemo（第 25-34 行）替换为：

```ts
  const sessionOptions: DropdownOption[] = useMemo(
    () =>
      sessions.map((s) => {
        const time = `${s.mtime.slice(0, 10)} ${s.mtime.slice(11, 16)}`;
        const title = s.customTitle || s.slug || s.sessionId;
        const shortId = s.sessionId.slice(0, 8);
        return {
          value: s.sessionId,
          label: `${time} \u00b7 ${title}`,
          sub: shortId,
          isNew: newSessionIds.has(s.sessionId),
        };
      }),
    [sessions, newSessionIds],
  );
```

- [ ] **Step 3: 将 Dropdown 外层容器改为相对定位并添加徽标**

将 `SessionBar.tsx` 中的 `<div className={styles.sessionSelectContainer}>` 块替换为：

```tsx
      <div className={styles.sessionSelectContainer}>
        <div className={styles.sessionDropdownWrap}>
          <Dropdown
            options={sessionOptions}
            value={activeSessionId ?? ''}
            onChange={handleSessionChange}
            size="md"
            maxHeight={320}
            matchWidth
            className={styles.sessionDropdown}
          />
          {newSessionIds.size > 0 && (
            <span className={styles.newBadge}>
              {newSessionIds.size > 9 ? '9+' : newSessionIds.size}
            </span>
          )}
        </div>
        <Tooltip content={t('session.copySessionId')}>
          <button
            className={clsx(styles.sessionCopyBtn, copied && styles.copied)}
            onClick={handleCopy}
          >
            {copied ? t('session.copiedId') : t('session.copyId')}
          </button>
        </Tooltip>
      </div>
```

- [ ] **Step 4: 在 `SessionBar.module.scss` 末尾添加徽标样式**

```scss
.sessionDropdownWrap {
  position: relative;
  min-width: 0;
  flex: 1;
}

.newBadge {
  position: absolute;
  top: -5px;
  right: -5px;
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
  line-height: 1;
}
```

- [ ] **Step 5: 更新 `.sessionDropdown` 样式**

将现有的：
```scss
.sessionDropdown {
  min-width: 0;
  flex: 1;
}
```
改为：
```scss
.sessionDropdown {
  min-width: 0;
  width: 100%;
}
```
（flex 改由 `sessionDropdownWrap` 承担）

- [ ] **Step 6: 验证 TypeScript 编译无错误**

```bash
cd plugins/token-reporter/frontend
npx tsc --noEmit
```

- [ ] **Step 7: 提交**

```bash
git add plugins/token-reporter/frontend/src/components/StickyChart/SessionBar.tsx \
        plugins/token-reporter/frontend/src/components/StickyChart/SessionBar.module.scss
git commit -m "feat(token-reporter): show new session badge on session dropdown"
```

---

### Task 7: 构建并验证

**Files:**
- Modify: `plugins/token-reporter/dist/` (构建产物)

- [ ] **Step 1: 构建前端**

```bash
cd plugins/token-reporter/frontend
npm run build
```
预期：无错误，`dist/` 目录更新。

- [ ] **Step 2: 运行现有测试**

```bash
cd plugins/token-reporter
node test/test-hooks.js
node test/test-migration.js
node test/test-single-instance.js
```
预期：所有测试通过。

- [ ] **Step 3: 手动端到端验证**

```bash
# 终端 1：启动服务器
cd plugins/token-reporter
node backend/server.js

# 终端 2：打开浏览器访问 http://localhost:3737
# 终端 3：模拟新 session
curl -X POST http://localhost:3737/notify-new-session \
  -H 'Content-Type: application/json' \
  -d '{"sessionId":"fake-new-session-001"}'
```
预期：浏览器中 session 下拉按钮右上角出现红色徽标显示 `1`。

多次发送不同 sessionId，验证数字正确累加（上限显示 `9+`）。

- [ ] **Step 4: 版本检查**

```bash
node plugins/token-reporter/scripts/check-version.js
```
如提示需要 bump，运行：
```bash
node plugins/token-reporter/scripts/bump-version.js patch
```

- [ ] **Step 5: 提交构建产物**

```bash
git add plugins/token-reporter/dist/
git commit -m "chore: rebuild token-reporter frontend dist"
```
