# release-creator

**为本项目派生一份专属 release skill 的元 skill 插件。**

release-creator **本身不执行任何 release 动作**。它通过渐进式 AskUserQuestion + 动态模板库，引导你为当前项目定制一份 `release-<project>` skill，落盘由官方 `skill-creator` 完成。

## 为什么不做通用 release 器

业界 release 工具（Changesets / release-please / semantic-release）已经证明「通用发布器 + 零配置」不可兼得——每种工具都必须在版本决策哲学、打包粒度、tag 格式上做出取舍。`release-creator` 跳出这个悖论：**派生器通用，派生出的 release skill 特化**。每个项目只决定一次、落盘为明确可读的 SKILL.md，后续 release 直接按这份 skill 执行。

## 派生流程（高层）

1. 语言选择（沟通语言 + 骨架正文语言，一次 AUQ 两问）
2. 价值阐述
3. 意向分流（直接派生 / 暂时跳过）
4. 检测官方 `skill-creator`
5. **第一道核心 AUQ：选分支维度**（生态 / 哲学 / 打包+tag / 穷举）
6. 分维度追问（读对应 flow reference）
7. 通用参数（派生 skill 命名、落盘位置）
8. Override（展示默认骨架 + 各维度 3 个替代 + 自定义）
9. 委派 `skill-creator` 落盘
10. 收尾提示（含重启 Claude Code 才能生效的警告）

welcome skill 本身**不写任何 SKILL.md 文件**——落盘全部交给 `skill-creator`。

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
/plugin install release-creator@df-market
```

## 首次安装后

```
/release-creator-welcome
```

启动渐进式派生对话。整套流程平均 5–8 次 AUQ 回合，全部问题都支持「Other 自由输入」或「跳过/终止」。

## 依赖

- 官方 `skill-creator` skill（派生流程需要；welcome 会自动检测并引导安装）

## 与 skill-keeper 的关系

`release-creator` 和 `skill-keeper-welcome`（在 `skill-keeper` 插件中）**架构同构**——都是渐进式派生器、都委派 skill-creator 落盘、都不自己写 SKILL.md 文件。两者相互独立，可以只装其中一个。

## 许可与作者

- Author: jjj201200 <jjj201200@gmail.com>
- Repository: https://github.com/jjj201200/df-market
