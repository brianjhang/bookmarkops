# BookmarkOps — Chrome 应用商店上架文案

[English](./store-listing.md) · [繁體中文](./store-listing.zh-TW.md) · **简体中文**

> 对应 Chrome Web Store 上架表单的文案来源。提交时把每一段贴到对应字段即可。
>
> **版本:** 1.0 · **最后更新:** 2026-05-15

---

## 名称 / Title(上限 40 字符)

```
BookmarkOps — AI 书签整理工具
```

> 字符数:23 · ✓ 在上限内。

---

## 摘要 / Summary(上限 132 字符)

```
用 AI 整理 Chrome 书签 —— 接上 Codex、Claude Code 或 Cursor,每个改动都要你在 Dashboard 亲自确认才会生效。
```

> 字符数:约 75 · ✓ 在上限内。
>
> 这是 CWS 搜索结果页第一眼看到的一句。先讲价值、点名 AI 工具、设定安全感的预期。

---

## 详细描述 / Detailed description

你的书签多半是一团乱。多年累积下来「以后再整理」的网页,塞在没人开过的文件夹里。你想清理,但「手动重新排一千条书签」这件事光想就累,所以一直没做。

BookmarkOps 让 AI 工具 —— **OpenAI Codex**、**Claude Code**、或 **Cursor** —— 替你做规划。你跟 AI 说「扫一下我的书签,提一个整理方案」,BookmarkOps 产出结构化报告、AI 起草方案、扩展程序把方案排进等你审核的队列。**在你亲手在 Dashboard 上输入 `APPLY` 之前,书签树一个字都不会被改动。**

### 什么是 MCP?为什么重要?

MCP —— **Model Context Protocol**(模型上下文协议)—— 是一条小桥,让 AI 工具能安全地跟本机程序对话。把 BookmarkOps 的 MCP server 接上去之后,你的 AI 工具能要求扩展程序:

- 扫描书签树、返回报告。
- 提交一份整理方案等你审核。
- 试跑(dry run)看看方案会不会出错。

但 AI 工具**做不到的事**是:**直接动手改**。它只能提案。能按下 `APPLY` 的只有你。

### 三个让 BookmarkOps 不一样的地方

**1. 完全本机运行。** 你的书签不会被上传到任何地方。MCP bridge 只绑 `localhost:7842`,别台机器连不到。没有 telemetry、没有分析、没有远程 log、没有任何第三方 SDK 嵌在里面。每一行代码都开源、可审查。

**2. 任何破坏性动作都要三层确认。** 应用方案、还原备份、删除备份,各自要打不同的确认短语 —— `APPLY` / `RESTORE` / `DELETE BACKUP`。每次应用前,书签树会自动完整备份;不满意可以打一个字回到之前的状态。

**3. MIT 开源。** BookmarkOps 扩展程序本身、加上 `@bookmarkops/mcp` Node 包,全部代码公开在 GitHub。可读、可自行 build、可 fork、可审查。没有闭源服务器、没有独占后端、也不会未来转型成收集 telemetry。

### 工作流程

```
scan → report → plan → dryRun → preview → backup → apply → verify → restore
```

1. **扫描(Scan)** —— BookmarkOps 通过 Chrome 官方 `chrome.bookmarks` API 读书签树。
2. **报告(Report)** —— 本机生成 AI 看得懂的 Markdown 或 JSON 摘要。
3. **方案(Plan)** —— 你的 AI 工具通过 MCP 起草 `bookmark-plan.json` 并提交。
4. **试跑(DryRun)** —— BookmarkOps 对着书签树的副本模拟方案,呈现会发生什么变动。
5. **预览(Preview)** —— Dashboard 用颜色分组显示每个操作。
6. **备份(Backup)** —— 真正动手前,完整书签树自动快照。
7. **应用(Apply)** —— **只有**你输入 `APPLY` 之后,改动才会发生。
8. **验证(Verify)** —— BookmarkOps 把实际树的状态跟方案比对,呈现通过 / 失败。
9. **还原(Restore)** —— 任何不对劲,输入 `RESTORE` 从任何一份备份还原。

### 快速开始

> **新手推荐 OpenAI Codex。** Codex 桌面端界面跟 ChatGPT、Claude、Gemini 一样,对用过现代 AI 对话工具的人来说零门槛。每天有免费额度,整理大多数人的书签完全够用,不必付订阅费。

1. 从 Chrome 应用商店安装 BookmarkOps。
2. 打开 Dashboard,从 **Quick Setup** 卡片复制 MCP 配置。
3. 粘贴到你的 AI 工具(Codex、Claude Code、Cursor)。
4. 跟 AI 说:「扫描我的书签,提一个整理方案。」
5. 在 Dashboard 上审核提案、决定要不要应用。

### 适合谁

- **已经在跟 AI 工具一起做事的人** —— 用过 Codex、Claude Code 或 Cursor 都可以,不管你写不写代码,只要在用 AI 对话。BookmarkOps 把书签整理塞进你既有的 AI 对话。不用多开账号、不用学新工具。
- **书签多到爆的人** —— 书签栏累积五年没整,AI 可以几分钟做完那个无聊的分类工作。
- **重视隐私的人** —— 不想把书签数据丢到云端「AI 整理」服务的话,BookmarkOps 全程本机。

### 常见问题

**除了扩展程序还要装什么?**
要有一个支持 MCP 的 AI 工具(Codex、Claude Code、Cursor 等)。MCP bridge 本身(`@bookmarkops/mcp`)会在 AI 工具第一次启动时通过 `npx` 自动下载,不用手动安装。

**没有支持 MCP 的 AI 工具能用吗?**
v0.1 不行。整理流程目前一定要靠支持 MCP 的 AI 工具起草方案并提交。最简单的路径是 OpenAI Codex(见上方快速开始)。文件导入式的手动模式 —— 直接放一份 plan JSON、不用接 AI 工具 —— 列入 v0.2 路线图。

**万一整理出错怎么办?**
每次应用前都会自动备份。在 Dashboard 输入 `RESTORE`,书签树就会回到之前的状态,一模一样。

**轮替 token 之后要做什么?**
在 Dashboard 轮替后,复制新的 Quick Setup 配置,然后**重启你的 AI 工具**。旧 token 在 AI 工具重启之后就失效。完整流程跟威胁模型在 [agent 文档的 Security model 段落](https://github.com/brianjhang/bookmarkops/blob/main/src/agent/README.md#security-model)。

### 开源

BookmarkOps 采 MIT 协议。Chrome 扩展程序、`@bookmarkops/mcp` Node 包、隐私政策、威胁模型、架构文档,全部都在同一个 GitHub repo。

GitHub: https://github.com/brianjhang/bookmarkops

---

## 类别 / Category

**建议:Productivity(生产力工具)**

理由:
- 核心用户价值是「整理一直拖着没整的书签」 —— 属生产力 job-to-be-done。
- CWS 上「bookmark cleanup」、「bookmark manager」搜索落在 Productivity 类别,不在 Developer Tools。
- MCP 集成是**手段**,不是**目的**;归到 Developer Tools 反而把可触及的用户缩到只剩写代码的人,但实际 TAM 是「有书签乱、有现代 AI 工具可用」的所有人。

备案(若某些地区 Productivity 不开放):**Workflow & Planning**。

避开:Developer Tools(太窄)、Tools(已淘汰)、Utilities(太空)。

---

## 单一用途说明 / Single-purpose description(CWS 必填)

```
BookmarkOps 协助用户通过安全的本机工作流程整理 Chrome 书签。通过 Model Context Protocol 连线的 AI 工具可协助提出整理方案,但任何书签改动前都必须用户在 Dashboard 亲自输入确认短语才会执行。
```

> 「单一用途」是书签整理。MCP 集成是达成此目的的手段,不是另一个独立用途。

---

## 各权限说明 / Permission justifications

Chrome Web Store 审核员会问每个敏感权限为什么需要。以下是给审核员看的口语化说明。

### `bookmarks`(审核最仔细的权限)

BookmarkOps 是书签整理扩展程序,`bookmarks` 权限就是整个核心功能:扩展程序读取书签树做扫描、生成报告、模拟整理方案;**只有**在用户于 Dashboard 上亲自输入 `APPLY` 短语、明确核准方案之后,才会写入书签树。没有任何书签数据会被送到远程服务器。所有读写都通过 Chrome 官方 `chrome.bookmarks` API。

### `storage`

用于持久化下列项目:
- 用户的 MCP session token(让 AI 工具不用每次重新配对)。
- Dashboard 偏好配置(主题、语言)。
- 最近一次扫描快照(让 Dashboard 不用每次重扫就能显示统计)。
- 应用前的完整书签备份(让用户整理出错时可还原)。

全部数据存在用户设备上的 `chrome.storage.local`,不同步、不上传。

### `alarms`

只调度一个每分钟执行一次的 polling 任务,让 BookmarkOps 能通过 `localhost:7842` 的本机 bridge 取得 AI 工具发来的新 MCP 请求。没有这个 alarm,MCP 请求无法及时处理。没有其他后台任务。

### Host permission `http://localhost:7842/*`

BookmarkOps 通过绑在 `127.0.0.1:7842` 的本机 bridge 跟用户的 MCP server 通信。这个 host permission 允许扩展程序对该本机 bridge 发 HTTP 请求。Bridge 只监听 loopback 接口,别台机器连不到。BookmarkOps **不访问任何外部主机**。

---

## 交叉引用

- **隐私政策:** [`docs/privacy-policy.zh-CN.md`](../privacy-policy.zh-CN.md) —— 含完整数据流向说明、用户可掌控的事项。
- **威胁模型:** [`src/agent/README.md` → Security model](https://github.com/brianjhang/bookmarkops/blob/main/src/agent/README.md#security-model)。
- **README:** 项目总览、安装步骤、开发指南。

填 CWS 表单时,**Privacy Policy URL** 字段应指向 `docs/privacy-policy.md` 的 GitHub Pages URL(等 B.7 启用 Pages 后即可生效)。
