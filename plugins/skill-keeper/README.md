# skill-keeper

Skill 与文档一致性管家。本插件捆绑了一套「方法论 skill 套装」，以 **「任务回顾编排 + 落盘双守门 + commit 前代码审查循环 + subagent 守门 + 全量双审计」** 五档能力保护你的 SKILL.md 与项目文档不漂移。

## 捆绑的 skill

| skill                     | 角色                                                                |
| ------------------------- | ------------------------------------------------------------------- |
| `skill-recap`             | 任务回顾 + 改进编排入口（流程主轴）                                 |
| `skill-doc-sync-check`    | 文档落盘前增量守门（被 recap 串联）                                 |
| `skill-sync-check`        | SKILL.md 落盘前增量守门（被 recap 串联）                            |
| `skill-coding-review`            | commit 前循环式代码审查与修复（零修改收敛前阻断 commit）            |
| `skill-subagent-check`    | Subagent 报告接收端即时守门（每次消费 subagent 报告前串联）         |
| `skill-doc-audit`         | 文档与代码一致性全量审计                                            |
| `skill-audit`             | SKILL.md 全量审计                                                   |

每份 skill 都附有「如何派生项目定制版」章节——通用版跨项目复用，**具体项目需要派生 `-<project>` 后缀的定制版**才能真正守门（把项目的绝对路径、核心业务链路、忽略项台账位置等写死进去）。

## 合理的执行顺序

7 份 skill 在典型会话中按以下 4 步串联。知道"什么时候调用哪份"比单独理解每份 skill 更重要：

1. **编码/调研期**：主 skill 派发 subagent 做调研、审查、索引枚举时，在消费报告前调用 `skill-subagent-check` 做接收端守门。每次派发都要跑；coding-review 内部派 subagent 时也由它守门。
2. **commit 前**：用户说 commit / push / ship 时触发 `skill-coding-review`。循环审查直至零修改收敛；build 成功是前置门槛。
3. **任务收尾**：任务完成或用户说 recap 时触发 `skill-recap`。它是回顾主轴，阶段 5.1 内部自动串联 `skill-doc-sync-check`（文档变更时）与 `skill-sync-check`（SKILL.md 变更时），无需手动再跑这两个 check。
4. **周期性体检**：手动触发或定期运行 `skill-doc-audit` / `skill-audit`，对既有资产做全量漂移扫描。

关键依赖：

- coding-review 必须在 recap 之前——代码变更本身是任务的一部分，recap 只在 commit 完成后提取经验
- subagent-check 贯穿步骤 1 和 2——任何派发 subagent 的阶段都调用
- recap 自动串联两个 sync-check，不需要手动再跑
- audit 类（skill-audit / skill-doc-audit）是周期性的"既成事实"体检，与单次任务解耦

命名语义：

- `-check` 后缀 = 即时守门（subagent-check / sync-check / doc-sync-check；coding-review 虽无后缀也属此族）
- `-audit` 后缀 = 周期性全量体检（audit / doc-audit）
- 无后缀 = 编排入口（recap）

## Installation

Add to your `~/.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "df-market": {
      "source": {
        "source": "github",
        "repo": "jjj201200/df-market"
      }
    }
  }
}
```

Then install via Claude Code:

```
/plugin install skill-keeper@df-market
```

## 首次安装后：派生定制版（可选）

安装完毕后，**建议立即运行一次**：

```
/skill-keeper-welcome
```

这会启动一段渐进式 AskUserQuestion 对话：

1. 先介绍 7 个通用 skill 与派生定制版的价值
2. 询问你是否要派生，以及派生哪几份（轻量 / 标准 / 全量 / 自选）
3. 检测官方 `skill-creator` 是否已安装（未装会引导你安装）
4. 收集项目代号、生成位置、正文语言、命名方案
5. 逐份追问每份定制版的项目特有字段（核心业务链路、忽略项台账、硬性索引规则等）
6. 委派 `skill-creator` 落盘骨架文件，未填字段留 `TODO:` 占位

**派生完全可选**——你也可以只装 skill-keeper 直接用通用版，之后随时再跑 welcome。

## 依赖

- 官方 `skill-creator` skill（派生流程需要；welcome 会自动检测并引导安装）

## 使用

- `/skill-keeper-welcome` —— 首次派生定制版的渐进引导
- 直接对 Claude 说"回顾一下本次任务"→ 触发 `skill-recap`
- 直接对 Claude 说"审计本项目文档/skill"→ 触发 `skill-doc-audit` / `skill-audit`
- 主 skill 派发 subagent 后、消费其结论前 → 触发 `skill-subagent-check` 做接收端守门
- 准备 commit/push 时 → 触发 `skill-coding-review` 做循环代码审查，零修改收敛前阻断 commit
- 修改 SKILL.md 或规范文档前，主流程会自动串起 `sync-check` 系列守门

## 许可与作者

- Author: jjj201200 <jjj201200@gmail.com>
- Repository: https://github.com/jjj201200/df-market
