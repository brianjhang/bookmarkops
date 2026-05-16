# BookmarkOps

[English](./README.md) · [繁體中文](./README.zh-TW.md) · **简体中文**

**让 AI 安全整理 Chrome 书签的 MCP 工具。** 通过任何支持 MCP 的 AI 工具(Codex、Claude Code、Cursor)扫描、规划、清理你的 Chrome 书签;所有会改动书签的动作,必须由你在 Dashboard 上明确核准才会执行。

> **版本:** v0.1 · **MCP server:** npm 已发布 [`@bookmarkops/mcp`](https://www.npmjs.com/package/@bookmarkops/mcp) v0.1.3 · **Chrome 应用商店:** 上架审核中。

---

## 四个核心承诺

- **开源(MIT 协议)** —— 每一行代码都可审视。详见 [`LICENSE`](./LICENSE)。
- **完全本机运行** —— 书签数据不会离开浏览器。唯一网络通信是 `localhost:7842` 的 MCP bridge,且只绑本机接口,不对外开放。
- **零 telemetry、零分析** —— BookmarkOps 不收集、不上传任何使用数据。
- **可自行 build 验证** —— `npm install && npm run build` 产出的就是你加载到 Chrome 的那一份代码。

---

## 它是怎么运作的

```text
scan → report → plan → dryRun → preview → backup → apply → verify → restore
```

工作流程由三个角色分担:

1. **Chrome 扩展程序** —— 唯一能调用 `chrome.bookmarks` 的组件。负责扫描、应用、还原以及 Dashboard 渲染。
2. **MCP server**([`@bookmarkops/mcp`](https://www.npmjs.com/package/@bookmarkops/mcp))—— 由你的 AI 工具通过 `npx` 启动的小型 Node bridge。让 AI 能提出整理方案,但**没有任何权限可直接改动书签**。
3. **你** —— 所有 destructive 动作(apply / restore / delete backup)都必须在 Dashboard 上手动输入确认短语(`APPLY` / `RESTORE` / `DELETE BACKUP`)才会执行。

---

## 快速开始

### 1. 安装 Chrome 扩展

Chrome 应用商店上架前,先以「加载已解压的扩展程序」方式安装:

```bash
npm install
npm run build
```

1. 打开 `chrome://extensions`。
2. 启用 **开发者模式**。
3. 点 **加载已解压的扩展程序**。
4. 选择刚 build 出来的 `dist/` 文件夹。

### 2. 配置 AI 工具

打开 BookmarkOps Dashboard → **AI Agent Settings** → **Quick Setup**,复制 JSON 配置粘贴到你的 AI 工具里。

**Codex CLI**(`~/.codex/config.toml`):
```toml
[mcp_servers.bookmarkops]
command = "npx"
args = ["-y", "@bookmarkops/mcp"]

[mcp_servers.bookmarkops.env]
BOOKMARKOPS_TOKEN = "<your-token>"
```

> Codex CLI 采 TOML 格式,通过 `[mcp_servers.<name>]` 与 `[mcp_servers.<name>.env]` 两段定义。若 Codex CLI 版本不同,以官方文档为准。

**Claude Code**(`~/.claude.json`):
```json
{
  "mcpServers": {
    "bookmarkops": {
      "command": "npx",
      "args": ["-y", "@bookmarkops/mcp"],
      "env": { "BOOKMARKOPS_TOKEN": "<your-token>" }
    }
  }
}
```

**Cursor**(项目根目录的 `.cursor/mcp.json`):JSON 结构相同,直接从 Quick Setup 复制即可。

Bridge 不需要事先安装 —— `npx -y @bookmarkops/mcp` 首次执行时会自动下载。MCP server 启动时会检查 `BOOKMARKOPS_TOKEN` 环境变量,没设值就直接退出,不会默默运行。

完整集成说明、可用 MCP tools、以及威胁模型见 [`src/agent/README.md`](./src/agent/README.md)。

### 3. 跟你的 AI 对话

> 「扫描我的书签,给我一个清理方案。」

AI 会调用 `scan_bookmarks` 和 `get_report`,起草一份 `bookmark-plan.json`,然后放入待审核队列。你打开 Dashboard,逐一查看每个操作,输入 `APPLY` 才会真正执行。

---

## 开发

```bash
npm install
npm run dev                     # Vite 开发服务器
npm run build                   # 生产 build → dist/
npm run test:task1              # Smoke test: scanner + report-generator(纯 Node)
npm run test:workflow           # Smoke test: 完整 plan workflow
npm run test:isolated-runtime   # Playwright 扩展 runtime 测试(先 build dist/)
npm run validate                # 完整验证套件(smoke tests + build)
```

真实 Chrome 测试请加载刚 build 好的 `dist/` 文件夹。Isolated runtime 测试使用临时 Chrome profile,**不会碰你真实的书签**。

---

## 权限与安全边界

- Manifest 只申请 `bookmarks` / `storage` / `alarms` 三个权限,没有 `history`、没有对外 host permission —— 只有 `http://localhost:7842/*` 给本机 MCP bridge 用。
- Agent Operator Mode 可以做 scan / report / plan / dryRun;但 Apply、Restore、Delete backup 一定要你在 Dashboard 上输入确认短语才会执行。
- MCP bridge 只绑 `127.0.0.1:7842`,每次 `/enqueue` 都会验 session token。

完整威胁模型:[`src/agent/README.md` → Security model](./src/agent/README.md#security-model)。

---

## 联系

- Email:[me@brianjhang.com](mailto:me@brianjhang.com)
- 问题反馈 & 功能建议:[github.com/brianjhang/bookmarkops/issues](https://github.com/brianjhang/bookmarkops/issues)
- 个人网站:[brianjhang.com](https://brianjhang.com/)

我是把 BookmarkOps 当成自己想用的工具在做。bug 反馈、奇怪的书签树案例、「你有没有想过 X 功能」这类来信都很欢迎。

---

## 协议

MIT 协议 —— 详见 [`LICENSE`](./LICENSE)。Copyright © 2026 Brian Jhang。

---

## 参考资料

- MCP 集成 & 威胁模型 —— [`src/agent/README.md`](./src/agent/README.md)
- 繁中快速上手 —— [`docs/zh-TW/getting-started.zh-TW.md`](./docs/zh-TW/getting-started.zh-TW.md)
