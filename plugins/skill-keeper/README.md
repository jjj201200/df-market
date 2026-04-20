# skill-keeper

Skill 与文档一致性管家。本插件捆绑了一套「方法论 skill 套装」，以 **「任务回顾编排 + 落盘双守门 + commit 前代码审查循环 + subagent 守门 + 全量双审计」** 五档能力保护你的 SKILL.md 与项目文档不漂移。

## 捆绑的 skill

| skill                     | 角色                                                                |
| ------------------------- | ------------------------------------------------------------------- |
| `skill-recap`             | 任务回顾 + 改进编排入口（流程主轴）                                 |
| `skill-doc-sync-check`    | 文档落盘前增量守门（被 recap 串联）                                 |
| `skill-sync-check`        | SKILL.md 落盘前增量守门（被 recap 串联）                            |
| `skill-coding-review`            | commit 前循环式代码审查与修复（零修改收敛前阻断 commit）            |
| `skill-subagent-audit`    | Subagent 报告接收端守门（主 skill 派发 subagent 后消费结论前串联）  |
| `skill-doc-audit`         | 文档与代码一致性全量审计                                            |
| `skill-audit`             | SKILL.md 全量审计                                                   |

每份 skill 都附有「如何派生项目定制版」章节——通用版跨项目复用，**具体项目需要派生 `-<project>` 后缀的定制版**才能真正守门（把项目的绝对路径、核心业务链路、忽略项台账位置等写死进去）。

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
- 主 skill 派发 subagent 后、消费其结论前 → 触发 `skill-subagent-audit` 做接收端守门
- 准备 commit/push 时 → 触发 `skill-coding-review` 做循环代码审查，零修改收敛前阻断 commit
- 修改 SKILL.md 或规范文档前，主流程会自动串起 `sync-check` 系列守门

## 许可与作者

- Author: jjj201200 <jjj201200@gmail.com>
- Repository: https://github.com/jjj201200/df-market
