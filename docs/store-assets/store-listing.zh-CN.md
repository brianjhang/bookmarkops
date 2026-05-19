# BookmarkOps — Chrome 应用商店上架文案

[English](./store-listing.md) · [繁體中文](./store-listing.zh-TW.md) · **简体中文**

> 对应 Chrome Web Store 上架表单的文案来源——listing 字段与 Privacy practices
> 标签页字段都涵盖。提交时把每一段贴到对应字段即可。本文件已并入先前独立草拟
> 的 Privacy-practices 修正内容(单一用途、权限说明、数据使用披露);该独立
> 草稿已被本文件取代。
>
> **版本:** 2.0(已校正)· **最后更新:** 2026-05-19
>
> 必须与 repo 根目录 `PRIVACY-POLICY.md`(英文)完全一致。审核员会交叉比对
> listing ↔ manifest ↔ 隐私政策,任何不一致是首次提审最常见的退回原因。

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

> 约 75 字符 · ✓ 在上限内。CWS 搜索结果页第一眼看到的一句。

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

> **新手通常觉得 OpenAI Codex 最好上手** —— 它的桌面端就是一个熟悉的 AI 对话界面,几乎不用学。BookmarkOps 接 Claude Code 或 Cursor 完全一样;用你手边已经有的那个 AI 工具就行。

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
当前版本不行。整理流程目前一定要靠支持 MCP 的 AI 工具起草方案并提交。最简单的路径是 OpenAI Codex(见上方快速开始)。文件导入式的手动模式 —— 直接放一份 plan JSON、不用接 AI 工具 —— 列入未来版本的路线图。

**万一整理出错怎么办?**
每次应用前都会自动备份。在 Dashboard 输入 `RESTORE`,书签树就会回到之前的状态,一模一样。

**轮替 token 之后要做什么?**
在 Dashboard 轮替后,复制新的 Quick Setup 配置,然后**重启你的 AI 工具**。旧 token 在 AI 工具重启之后就失效。完整流程跟威胁模型见 repository 内的 agent 文档(Security model 段落)。

### 开源

BookmarkOps 采 MIT 协议。Chrome 扩展程序、`@bookmarkops/mcp` Node 包、隐私政策、威胁模型、架构文档,全部都在同一个 GitHub repo。

GitHub: https://github.com/brianjhang/bookmarkops

---

## 类别 / Category

**建议:Productivity(生产力工具)**

理由:
- 核心用户价值是「整理一直拖着没整的书签」 —— 属生产力 job-to-be-done。
- CWS 上「bookmark cleanup」、「bookmark manager」搜索落在 Productivity 类别,不在 Developer Tools。
- MCP 集成是**手段**,不是**目的**;归到 Developer Tools 反而把可触及的用户缩到只剩写代码的人。

备案(若某些地区 Productivity 不开放):**Workflow & Planning**。
避开:Developer Tools(太窄)、Tools(已淘汰)、Utilities(太空)。

---

## 单一用途说明 / Single-purpose description(CWS Privacy practices 字段)

```
BookmarkOps 协助用户检视并安全地整理 Chrome 书签。它扫描书签、提出整理建议(重复、失效链接、杂乱文件夹),每个改动应用前都让用户检视并核准,并自动做本机备份。用户也可以选择把自己本机运行的 AI 命令行工具通过 loopback(localhost)bridge 接上来协助检视。所有处理都在用户设备本机进行;扩展程序不发出任何远程网络请求。
```

> 「单一用途」是书签整理。MCP / AI 集成是达成此目的的手段,不是另一个独立用途。此段必须与隐私政策一致。

---

## 各权限说明 / Permission justifications(CWS Privacy practices 字段)

### `bookmarks`

> 核心功能。扩展程序读取书签(含 Chrome 对每个书签提供的 metadata,如加入日期、最后使用日期,用以分类使用频率)以分析重复、失效链接与杂乱,并在用户于 Dashboard 亲自输入 `APPLY`、检视核准后才应用整理改动。书签整理是本扩展程序的核心目的,没有此权限无法达成。所有读写都通过 Chrome 官方 `chrome.bookmarks` API;不会有任何书签数据送到远程服务器。

### `storage`

> 通过 `chrome.storage.local` 把扩展程序自己的数据存在用户设备本机:设置与 UI 偏好;用来验证与用户本机 AI bridge 连接的 session token;扫描结果与健康度分数的缓存;由用户 AI 工具提交、等待用户检视的整理方案与核准请求;以及 review-and-restore 工作流程用的安全备份/快照。这些都不同步、不传出设备。

### `alarms`

> 调度一个定期(约每分钟一次)的本机检查,向用户本机的可选 AI bridge 轮询用户 AI 工具可能提交的待审工作。该请求只送到用户本机的 loopback(localhost)地址。它从安装起就执行,不论用户是否设置过 AI 工具;若没有 bridge 在跑,请求静默失败,不送出也不接收任何东西。没有其他后台任务。

### Host permission `http://localhost:7842/*`

> 只连到用户本机的 loopback 地址。这是用户自己启动的可选本机 bridge(通过 `npx @bookmarkops/mcp`),在用户选择接上本机 AI 命令行工具(如 Claude Code、Cursor、Codex)协助书签检视时用。用于检查 bridge 健康状态、在本机交换书签检视的工作与结果。Bridge 只监听 loopback 接口,别台机器连不到。扩展程序未声明任何其他 host permission,Chrome 会挡掉任何非 localhost 请求。

### 远程代码 / Remote code

> 无。扩展程序不执行任何远程托管的代码。所有逻辑都打包在包内(符合 Manifest V3)。

---

## 数据使用披露与 Limited Use 声明 / Data usage disclosure & Limited Use(CWS Privacy practices 字段)

**扩展程序处理哪些数据、数据去哪:**

> BookmarkOps 不向开发者或任何第三方收集或传输用户数据。没有任何分析或 telemetry。书签数据在本机读取与处理。存在两条本机限定的数据路径,皆由用户控制且已在隐私政策披露:(1) 当用户已接上自己本机的 AI 工具、该工具提交请求时,书签数据(如扫描结果、报告、提交的整理方案)会回传到用户本机的 loopback bridge —— 扩展程序与 bridge 都不会把它转发到任何云端服务;(2) 当用户点击复制/启动按钮或 MCP 设置助手时,相关内容(书签 context,或本机 bridge session token)会写入用户的系统剪贴板,由操作系统管理,等同于手动复制。任何后续送往云端 AI 的传输,完全由用户自己安装并以自己账号/API key 配置的那个独立 AI 工具执行 —— 不在 BookmarkOps 控制范围内。

**声明(以下皆属实):**

- 除已核准用途外,不销售或转移用户数据给第三方。✔(数据只在用户 AI 工具请求时送到用户自己的本机 bridge,或在用户点击时送到用户自己的剪贴板)
- 不将用户数据用于与本项目单一用途无关的目的。✔
- 不将用户数据用于判断信用度或贷款用途。✔

---

## 隐私政策 URL / Privacy policy URL(CWS 字段)

```
https://github.com/brianjhang/bookmarkops/blob/main/PRIVACY-POLICY.md
```

> 这条确切 URL 填进 CWS「隐私政策」字段。它必须与 `PRIVACY-POLICY.md` 内「Changes」段落的 URL 完全一致(分支 `main`、文件名大小写完全相同)。提审前该文件必须在此 URL 已 live 且能正常 render(在浏览器确认 200)。不涉及任何 GitHub Pages。
>
> 注:v1 隐私政策仅提供英文版(根目录 `PRIVACY-POLICY.md`)。中文化政策为未来版本候选,非 CWS 必要。

---

## 交叉引用 / Cross-references

- **隐私政策:** repo 根目录 [`PRIVACY-POLICY.md`](https://github.com/brianjhang/bookmarkops/blob/main/PRIVACY-POLICY.md)(英文)—— 完整声明,含本机数据流向与剪贴板管道细节。
- **威胁模型 / 安全模型:** repository 内的 agent 文档(`src/agent/README.md`,Security model 段落)—— *引用前须先确认此路径/anchor 在 sync 后的 public repo 真的存在。*
- **README:** 项目总览、安装步骤、开发指南。

没有 GitHub Pages 这一步。CWS 隐私政策 URL 字段填上方「隐私政策 URL」段的 repo 根目录 blob URL。
