# Pending Tasks — F 路径流量分析后续价值点

> **来源**：token-reporter v2 的 fetch hook 在 smoke test 中抓到真实 Anthropic API 请求/响应后发现的、**超出当前 Context Composition MVP 范围**但有独立分析价值的点。
>
> **状态**：所有条目均为**观察记录 + 可能的后续 feature**，尚未立项。如有需要可独立成 spec。

---

## 1. `x-stainless-retry-count` header —— API 抖动指标

**观察**：Anthropic SDK 的每个请求都附带 `x-stainless-retry-count` header。

**洞察**：
- 值 > 0 说明本次请求**之前已有失败重试**
- 这是 SDK 原生可靠性指标，完全免费
- 可以做「API 抖动 / 网络稳定性」面板 —— "你本月有 3% 的请求触发了重试，主要集中在 10:xx"

**规模**：单独一个 panel 级别的 feature，不依赖其他新数据

---

## 2. `x-stainless-runtime` / `x-stainless-runtime-version` —— 环境指纹

**观察**：每个请求都带 Node 运行时版本。

**洞察**：
- 插件生态内跨用户聚合能回答「Claude Code 用户典型 Node 版本分布」
- 本地单用户层面用处不大（就一个值）
- 更适合 marketplace 层面的元分析，非 token-reporter 本体

**规模**：低优先级，需要跨用户数据才有意义

---

## 3. `?beta=true` URL 参数 —— beta 通道感知

**观察**：Claude Code 默认走 `api.anthropic.com/v1/messages?beta=true`。

**洞察**：
- 这个 query param 是"默认走 beta"的标志
- 将来 Anthropic 切换或新增 beta 通道时**我们能第一时间感知**，不需要解析 body
- 可以做一个 "Claude Code 正在使用的 API 通道" 的只读显示

**规模**：小——一行信息展示，适合放进 audit status UI

---

## 4. `anthropic-beta` header —— 启用的 beta features 清单 ⭐

**观察**：`anthropic-beta` header 列出本次请求启用的具体 beta 特性。

**洞察**：
- **这是金矿**：能看到 `thinking` / `fine-grained-tool-streaming` / `prompt-caching-2024-07-31` 等等
- 不同 session 启用的 beta 不同（看模型、entrypoint、flag）
- 分析方向：
  - 「你在用哪些未稳定特性」—— 稳定性风险提示
  - 「启用 `fine-grained-tool-streaming` 后，tool_use 的 token 占比下降了 X%」—— beta 特性的 ROI
  - 「`thinking` beta 被激活的轮次 vs. 未激活轮次的 cache 命中率对比」

**规模**：中等——值得独立 panel "Beta Features Insight"

---

## 5. `max_tokens: 32000` —— 硬编码输出上限

**观察**：Claude Code 在每次 Messages API 请求的 body 里**固定写 `max_tokens: 32000`**（我们在 smoke test 里看到的值）。

**洞察**：
- Claude Code **不是**按「剩余上下文最大值」动态计算的
- 对 200k 窗口的模型，每轮要为输出预留 32k，**真正能塞输入的只有 168k**
- 这直接改写 context pressure 计算：
  - 原 ContextPanel 的 `estimatedTurnsToLimit` 应该按 **168k** 算，不是 200k
  - compact 触发阈值如果按"输入接近 200k"判断会失效（实际上 Claude Code 可能在 150k 左右就开始压缩，给输出留空间）
- 需要验证：这个 32000 是否随模型变化？（Haiku vs Opus vs Sonnet）

**规模**：小但**会触动现有 ContextPanel 计算**——值得在 v2 完成后单独开 spec 校准 pressure 公式

---

## 6. GrowthBook feature flag 请求 —— 环境元数据暴露

**观察**：`https://api.anthropic.com/api/eval/sdk-<xxx>` 请求（GrowthBook），每次 Claude Code 启动发一次。

**抓到的 payload 字段**：
```json
{
  "attributes": {…deviceId, sessionId, email, org…},
  "forcedVariations": {},
  "forcedFeatures": {},
  "url": "…"
}
```

**洞察**：
- 这个请求**不是 Messages API**，composition 不需要它（captures-parser 按 `x-claude-code-session-id` 过滤，自然排除）
- 但从**隐私透明度**角度：用户可能不知道 Claude Code 启动时会往 Anthropic 发这些元数据
- 可选：AuditBanner 的隐私说明里加一句「Claude Code 自身会在启动时发送匿名化的环境元数据（GrowthBook feature flag），token-reporter 会记录但不解析这些」
- 也可选：做一个 **「Telemetry transparency」**只读 view，展示所有非 Messages 请求的去向和内容—**给用户完整可见性**

**规模**：中等——跟产品定位强相关。token-reporter 本来就叫自己「Context Audit」，这种透明化的信息是产品一致性的自然延伸

---

## 7. Response body 流式结构未利用

**观察**：我们抓到了完整 response body（SSE stream 结果已累积成最终 message object）。

**洞察**：v2 spec 明确写了「response 本期只落盘不分析，为 TTFT / 生成速率分析留余地」。真实拥有的数据包括：
- `usage.cache_creation.ephemeral_5m_input_tokens` / `ephemeral_1h_input_tokens`（spec §4.3 提到但 MVP 不用）
- `stop_reason` / `stop_sequence`
- 完整 assistant content（含 thinking blocks 的完整文本）

**未来可做**：
- TTFT：需要抓 SSE 的首 byte 时间戳（hook 需要再改一点，拦截 stream 的 first chunk）
- Thinking 质量分析：完整 thinking block 文本 + output_tokens → 「N thinking token 得到多少改动」
- Cache tier 真值：5m vs 1h 的精确拆分，现在 CachePanel 是估算

**规模**：每条都可独立成 panel 或独立 spec

---

## 归属与优先级

| 观察 | 成熟度 | 适合归入 |
|------|--------|----------|
| 1. retry-count | 数据已在手，可立即做 | 单独小 feature |
| 2. node runtime | 单用户意义弱 | 不做 |
| 3. ?beta=true | 仅显示用途 | audit status 角落 |
| 4. anthropic-beta header | ⭐ 高价值 | 独立 panel "Beta Insight" |
| 5. max_tokens=32000 | ⚠️ 影响现有 pressure | 单独 spec，校准 ContextPanel |
| 6. GrowthBook 透明化 | 产品价值 | "Telemetry Transparency" view |
| 7. response body 深挖 | 数据已在手，只差 UI | #5 token-budget-forecaster 等后续 spec |

本文件**不是 todo 列表**——是"记录下来以免遗忘"。当 v2 MVP 完成后，用户可以挑其中任意一条立项为新 spec。
