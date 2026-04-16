# 生态子模板 · Docs-only

`{{ecosystem}} = docs` 时 skill-creator 拼入本子模板。纯文档 / 静态站点的 release 通常轻量——很多项目甚至不打 tag。

---

## `{{bumpBlock}}` 内容

根据 `{{tagNeeded}}` 展开：

### 需要 tag

```bash
# 1. 确认 main 分支为最新
git status && git log -1

# 2. （可选）人工更新 CHANGELOG.md 或版本号元数据
#    文档项目通常无单一「版本号文件」，手动在 README / site config 里写
# 3. 打 tag
git tag {{tagFormat}}
```

### 不需要 tag

```bash
# 文档项目可以「每次 push 即部署」，不需要 tag。但如果想做版本化，强烈建议用 calver（日期）：
# docs-v2026.04.17 / docs-2026-04-17
# 否则 tag 失去标记价值
```

## `{{versionFiles}}` 内容

- `README.md`（可选，如果 README 标注版本）
- `site config`（如 `astro.config.ts` / `docusaurus.config.js` / `_config.yml`）
- `package.json`（如果用构建工具）
- 无版本号文件 → 省略

## `{{testCommand}}` 内容

- 静态检查（如 markdown lint / vale / 404 检查）
- 无 → `TODO:`

## `{{publishTarget}}` 展开

| 用户选择                | 展开文本                                           |
| ----------------------- | -------------------------------------------------- |
| 有，push 即自动部署     | `git push origin main`（部署由 CI / 托管平台完成） |
| 有，但要手动触发        | `git push origin main && <deploy command>`         |
| 无自动部署              | 手动 rsync / scp / 其他传输命令                    |

## 硬性约束补充

- **calver 比 semver 更适合文档**——语义化版本在文档场景语义模糊（什么是 patch？typo 修正？）
- **不要频繁打 tag**——tag 是「值得回溯的里程碑」，不是「每次 push 的书签」
- **部署失败不要重新打同名 tag**——改 tag 后缀（如加 `-redeploy`）

## 变量

| 变量            | 取值示例                              |
| --------------- | ------------------------------------- |
| `{{tagNeeded}}` | `true` / `false`                      |
| `{{tagFormat}}` | `docs-v<version>` / `v<YYYY.MM.DD>`   |
