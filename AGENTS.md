# BrowserUserScripts 项目维护规范

本仓库收录独立发布的 Tampermonkey 用户脚本。修改前先阅读受影响脚本目录下的 `README.md` 和 `CHANGELOG.md`；本文件适用于整个仓库，除非更深层目录另有 `AGENTS.md`。

## 目录约定

每个脚本目录应包含：

- `*.user.js`：唯一的可安装脚本与事实来源。
- `README.md`：脚本用途、使用方式、配置说明和安装入口。
- `CHANGELOG.md`：按版本倒序记录面向用户的改动。

根目录的 `README.md` 是项目索引，必须列出每个已发布脚本、其当前版本、简要功能和 Greasy Fork 安装链接。根目录 `LICENSE` 是整个项目的许可证来源。

## 修改脚本时的必做同步

只要改动了用户脚本代码，或改动了会随脚本发布的元数据（例如 `@name`、`@description`、`@match`、`@grant`、更新地址、`@supportURL`、`@license`），必须在同一个变更中完成以下事项：

1. 递增该脚本 `@version` 的最后一位（补丁版本）。仅在用户明确要求或改动不兼容时才调整更高位版本号。
2. 在对应 `CHANGELOG.md` 顶部新增该版本的条目，准确说明改动；不要修改历史版本条目。
3. 将根目录 `README.md` 脚本表中的版本号同步为新的 `@version`。
4. 检查对应脚本 README 的功能说明、配置说明和安装方式是否仍然准确，并在需要时同步更新。

纯文档调整（不改动 `*.user.js`）通常不递增脚本版本；若文档描述的是本次脚本功能改动的一部分，仍应随脚本变更一起更新。

## 用户脚本元数据

- 保持元数据格式为 `// @key value`，并保证脚本名、描述、匹配范围和权限与实际功能一致。
- 全仓库脚本使用 `// @license MIT`，并与根目录 `LICENSE` 保持一致。
- `@homepageURL`、`@updateURL`、`@downloadURL` 和 `@supportURL` 的仓库路径必须与当前目录和文件名一致。
- `@supportURL` 统一使用：`https://github.com/Aizen232503/BrowserUserScripts/issues`。
- 用户指定 Greasy Fork 安装页时，在 README 中使用稳定的数字地址 `https://greasyfork.org/zh-CN/scripts/<脚本 ID>`，不要使用名称 slug，也不要将 Raw 地址作为首选安装入口。

## 文档与许可证

- 面向用户的文档和更新日志使用简体中文。
- 功能文档应明确自动化边界，特别是涉及登录、支付、领取、复制或提交操作时；不得将“预填”描述为“自动执行”。
- 根目录 README 的“开源许可”说明必须与 `LICENSE` 文件及所有脚本的 `@license` 一致。
- 更换项目许可证时，必须同时更新根目录 `LICENSE`、根目录 README 和所有 `*.user.js` 的 `@license`；由于后者属于脚本元数据，也必须按“修改脚本时的必做同步”递增所有受影响脚本版本并记录更新日志。

## 交付前检查

提交前至少执行：

```bash
git diff --check
rg -n "@(version|license)\\b" --glob '*.user.js' .
git status --short
```

并人工确认：

1. 每个已改脚本的 `@version`、变更日志顶部版本与根 README 表格版本完全一致。
2. 每个脚本的 `@license` 都是 `MIT`，且根目录 `LICENSE` 是 MIT 文本。
3. 所有新增或修改的 README 链接、脚本路径和 Greasy Fork 脚本 ID 均有效。
4. 不将无关的工作区变更纳入提交；用户明确要求“所有更改”时才可提交全部变更。

## Git 约定

- 提交前说明提交范围；除非用户明确要求，不推送、不强推。
- 提交信息使用简洁英文祈使句，概括用户可感知的改动。
- 不重写历史、不使用强推，除非用户对该次操作明确授权。
- 仓库提供 `scripts/check-release.sh` 用于校验暂存区的脚本版本、更新日志与根 README 是否同步；被 `.gitignore` 匹配的内部用户脚本不参与该发布检查。克隆仓库后执行一次 `git config core.hooksPath .githooks`，即可在每次提交前自动运行该校验；仍可手动执行该脚本进行检查。
- 需要机械地递增单个脚本的补丁版本时，可显式执行 `scripts/bump-version.sh <脚本目录> <更新说明>`；它会同步更新脚本、对应 `CHANGELOG.md` 和根 README。不得在日常提交、hook 或 AI 常规改动中自动调用，除非用户明确指定使用该脚本。
