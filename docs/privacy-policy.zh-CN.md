# BookmarkOps 隐私政策

[English](./privacy-policy.md) · [繁體中文](./privacy-policy.zh-TW.md) · **简体中文**

> **版本:** 1.0 · **最后更新:** 2026-05-15

## 一句话

BookmarkOps 不收集、不传输、不在你浏览器以外的任何地方存储你的数据。唯一的网络通信是 `localhost:7842` 的本机 MCP bridge,只绑本机接口,不对外开放。

## BookmarkOps 会接触到哪些数据

所有 BookmarkOps 读写的内容都留在你的电脑里:

- **书签树** —— 通过 `chrome.bookmarks`(Chrome 原生书签 API)读取与修改。Plan、DryRun、Apply、Restore、Verify 全部走这个 API。
- **本机扩展存储** —— `chrome.storage.local`,存放 Agent session token、BookmarkOps 配置、Dashboard 偏好(主题、语言)、最近一次扫描快照、以及 Apply 前自动建立的书签完整备份。
- **本机 alarms** —— 调度一个每分钟执行一次的后台任务,专门 poll 本机 MCP bridge。

没有远端数据库、没有分析服务、没有服务器端 log、也没有任何第三方 SDK 嵌在里面。

## 各权限的具体用途

| 权限 | 用途 | 为什么需要 |
|---|---|---|
| `bookmarks` | 读写你的 Chrome 书签 | 整个核心功能就是这个,没有它 BookmarkOps 无法扫描或整理。 |
| `storage` | 读写 `chrome.storage.local` | 用来持久化 token、配置、扫描缓存、备份快照 —— 全部存在你 Chrome profile 的本机文件。 |
| `alarms` | 调度一个 1 分钟后台任务 | poll 本机 MCP bridge,看有没有 AI 工具发来的新请求。 |
| Host permission `http://localhost:7842/*` | 跟本机 MCP bridge 通信 | 该 bridge 只绑 `127.0.0.1`,别台机器连不进来。 |

BookmarkOps **没有**申请 `history`、`cookies`、`webRequest`、`notifications`,也没有任何对外网站的 host permission。

## MCP 数据流向(仅在你选择使用时)

如果你通过 [`@bookmarkops/mcp`](https://www.npmjs.com/package/@bookmarkops/mcp) 接上 AI 工具(Claude Code、Cursor、Codex 等):

1. MCP server —— 你的 AI 工具启动的一个小型 Node process —— 在 `localhost:7842` 开启 bridge。
2. 当 AI 要求扫描或生成报告时,BookmarkOps 从你的本机书签树读出书签标题、URL、文件夹路径回复给它。
3. 那份回复被你的 AI 工具读走。**那份数据接下来怎么被处理 —— 包括 AI 工具是否把它送到云端 LLM —— 由你的 AI 工具自己的隐私政策决定,不是 BookmarkOps 决定。**
4. BookmarkOps 本身**没有任何** API key、云服务,或对外的 HTTP 调用(本机 bridge 以外)。

简单讲:BookmarkOps 通过本机 socket 把数据交给你选的 AI 工具;之后发生什么事是你跟 AI 服务商之间的事。完整威胁模型见 agent README 的 [Security model 段落](https://github.com/brianjhang/bookmarkops/blob/main/src/agent/README.md#security-model)。

## 我们不做的事

- 不收集 telemetry、不做使用分析、不收 crash report。
- 没有追踪 pixel、fingerprint 或任何识别码。
- 没有任何对外 HTTP 调用(本机 MCP bridge 以外)。
- 不收集 email、姓名、或任何账号凭证。
- 没有「匿名化数据导出」这种事 —— 因为根本没有任何数据导出。

## 你能掌控的事

- **卸载就清掉所有数据。** 在 `chrome://extensions` 移除 BookmarkOps,`chrome.storage.local` 里的 token、配置、备份、扫描缓存全部一并消失。远端服务器上没有任何东西可清,因为从来没发送过。
- **本机就可查看。** Chrome DevTools → Application → Storage → Extensions → BookmarkOps → `chrome.storage` 可看到 BookmarkOps 所有存储的内容。
- **随时轮替 token。** Dashboard → AI Agent Settings → Rotate,生成一把新 token;旧的随 AI 工具下次重启 MCP server 就失效。
- **单独删备份。** Apply 前自动建立的每份备份,都可以在 Dashboard 上输入 `DELETE BACKUP` 个别删除。

## 联系方式

- Email:me@brianjhang.com。
- GitHub issues:[https://github.com/brianjhang/bookmarkops/issues](https://github.com/brianjhang/bookmarkops/issues)(repo 设为 Public 后此链接会生效)。

## 政策更新

本政策的版本管理跟 BookmarkOps 代码一起在 git repo 内。任何实质性变动 —— 新增权限、新增数据流向、新增第三方集成 —— 都会反映在本文件,并在主 [`README.md`](../README.md) 标注。文件顶端的「最后更新」是 canonical 时间戳。
