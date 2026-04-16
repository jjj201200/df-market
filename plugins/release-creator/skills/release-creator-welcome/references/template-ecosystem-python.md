# 生态子模板 · Python

`{{ecosystem}} = python` 时 skill-creator 拼入本子模板。

---

## `{{bumpBlock}}` 内容

根据 `{{buildBackend}}` 展开不同命令：

### backend = hatchling / setuptools

```bash
# 编辑 pyproject.toml > project.version，或用 hatch version
hatch version patch   # 1.0.0 → 1.0.1
hatch version minor
hatch version major
```

### backend = poetry

```bash
poetry version patch   # 1.0.0 → 1.0.1
poetry version minor
poetry version major
```

### backend = setuptools + setup.cfg

```bash
# 手动编辑 setup.cfg > [metadata] > version
```

### backend = flit / 其他

手动编辑 `pyproject.toml` > `project.version`，或 `<package>/__init__.py > __version__`。

## `{{versionFiles}}` 内容

根据 `{{versionSource}}` 展开：

- `pyproject.toml > project.version` → `pyproject.toml`
- `__version__ in package/__init__.py` → `<package>/__init__.py`
- 动态（hatch-vcs / setuptools-scm） → **无静态 version 文件**（从 git tag 自动推导，release 只要打 tag 即可）

## `{{testCommand}}` 内容

优先级顺序：

1. `pytest`
2. `python -m unittest`
3. `tox`（如项目有 tox.ini）
4. 没有测试 → `TODO: 本项目未配置测试命令`

## `{{publishTarget}}` 展开

| 用户选择                | 展开文本                                                     |
| ----------------------- | ------------------------------------------------------------ |
| PyPI                    | `python -m build && twine upload dist/*` 或 `poetry publish --build` |
| 私有 index              | `twine upload --repository-url <url> dist/*`                  |
| GitHub release only     | `gh release create <tag> --generate-notes`                   |

## 硬性约束补充

- **上 PyPI 前必须 `python -m build`**（生成 sdist + wheel）
- **twine upload 要配置 `~/.pypirc` 或用 token**，不要把 token 写进 skill
- **动态版本（setuptools-scm）的项目**：不要手动 bump version 字段；打 tag 即完成「bump」
- **pre-release 标识符**：semver 在 Python 里不完全通用——`1.0.0rc1` / `1.0.0a1` 是 PEP 440 规范，不是 `-rc.1`

## 变量

| 变量                | 取值示例                                        |
| ------------------- | ----------------------------------------------- |
| `{{buildBackend}}`  | `hatchling` / `poetry` / `setuptools` / `flit`  |
| `{{versionSource}}` | 见上                                            |
