# BookmarkOps

[English](./README.md) · **繁體中文** · [简体中文](./README.zh-CN.md)

**讓 AI 安全整理 Chrome 書籤的 MCP 工具。** 透過任何支援 MCP 的 AI 工具（Codex、Claude Code、Cursor）掃描、規劃、清理你的 Chrome 書籤;所有會改動書籤的動作,必須由你在 Dashboard 上明確核准才會執行。

> **版本:** v0.1 · **MCP server:** npm 已發佈 [`@bookmarkops/mcp`](https://www.npmjs.com/package/@bookmarkops/mcp) v0.1.3 · **Chrome Web Store:** 上架審核中。

---

## 四個核心訴求

- **開源（MIT 授權)** —— 每一行程式碼都可審視。詳見 [`LICENSE`](./LICENSE)。
- **完全本機執行** —— 書籤資料不會離開瀏覽器。唯一網路通訊是 `localhost:7842` 的 MCP bridge,且只綁本機介面,不對外開放。
- **零 telemetry、零分析** —— BookmarkOps 不蒐集、不傳送任何使用資料。
- **可自行 build 驗證** —— `npm install && npm run build` 產出的就是你載入 Chrome 的那一份程式。

---

## 它是怎麼運作的

```text
scan → report → plan → dryRun → preview → backup → apply → verify → restore
```

工作流程由三個角色分擔:

1. **Chrome 擴充套件** —— 唯一能呼叫 `chrome.bookmarks` 的元件。負責掃描、套用、還原、以及 Dashboard 渲染。
2. **MCP server**([`@bookmarkops/mcp`](https://www.npmjs.com/package/@bookmarkops/mcp))—— 由你的 AI 工具透過 `npx` 啟動的小型 Node bridge。讓 AI 能提出整理計畫,但**沒有任何權限可直接改動書籤**。
3. **你** —— 所有 destructive 動作(apply / restore / delete backup)都必須在 Dashboard 上手動輸入確認字串(`APPLY` / `RESTORE` / `DELETE BACKUP`)才會執行。

---

## 快速開始

### 1. 安裝 Chrome 擴充套件

Chrome Web Store 上架前,先以「未封裝擴充套件」載入:

```bash
npm install
npm run build
```

1. 打開 `chrome://extensions`。
2. 啟用 **開發人員模式**。
3. 點 **載入未封裝項目**。
4. 選擇剛剛 build 出來的 `dist/` 資料夾。

### 2. 設定 AI 工具

打開 BookmarkOps Dashboard → **AI Agent Settings** → **Quick Setup**,複製 JSON 設定貼到你的 AI 工具裡。

**Codex CLI**(`~/.codex/config.toml`):
```toml
[mcp_servers.bookmarkops]
command = "npx"
args = ["-y", "@bookmarkops/mcp"]

[mcp_servers.bookmarkops.env]
BOOKMARKOPS_TOKEN = "<your-token>"
```

> Codex CLI 採 TOML 格式,以 `[mcp_servers.<name>]` 與 `[mcp_servers.<name>.env]` 兩段定義。若你的 Codex CLI 版本路徑不同,以 Codex 官方文件為準。

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

**Cursor**(專案根目錄的 `.cursor/mcp.json`):JSON 結構相同,直接從 Quick Setup 複製即可。

Bridge 不需要事先安裝 —— `npx -y @bookmarkops/mcp` 第一次執行時會自動下載。MCP server 啟動時會檢查 `BOOKMARKOPS_TOKEN` 環境變數,沒設值就直接失敗離開,不會默默運作。

完整整合說明、可用的 MCP tools、以及威脅模型在 [`src/agent/README.md`](./src/agent/README.md)。

### 3. 跟你的 AI 對話

> 「掃描我的書籤,提一個清理計畫。」

AI 會呼叫 `scan_bookmarks` 跟 `get_report`,起草一份 `bookmark-plan.json`,然後排入待審核佇列。你打開 Dashboard,逐一檢視每個操作,輸入 `APPLY` 才會真正執行。

---

## 開發

```bash
npm install
npm run dev                     # Vite 開發伺服器
npm run build                   # 產品 build → dist/
npm run test:task1              # Smoke test: scanner + report-generator(純 Node)
npm run test:workflow           # Smoke test: 完整 plan workflow
npm run test:isolated-runtime   # Playwright 擴充套件 runtime 測試(先 build dist/)
npm run validate                # 完整驗證套件(smoke tests + build)
```

真實 Chrome 測試請載入剛 build 好的 `dist/` 資料夾。Isolated runtime 測試使用臨時 Chrome profile,**不會碰你真實的書籤**。

---

## 權限與安全邊界

- Manifest 只請求 `bookmarks` / `storage` / `alarms` 三個權限,沒有 `history`、沒有對外 host permission —— 只有 `http://localhost:7842/*` 給本機 MCP bridge 用。
- Agent Operator Mode 可以做 scan / report / plan / dryRun;但 Apply、Restore、Delete backup 一定要你在 Dashboard 上輸入確認字串才會執行。
- MCP bridge 只綁 `127.0.0.1:7842`,每次 `/enqueue` 都會驗 session token。

完整威脅模型:[`src/agent/README.md` → Security model](./src/agent/README.md#security-model)。

---

## 聯絡

- Email:[brianjhang.ai@gmail.com](mailto:brianjhang.ai@gmail.com)
- 問題回報 & 功能建議:[github.com/brianjhang/bookmarkops/issues](https://github.com/brianjhang/bookmarkops/issues)
- 個人網站:[brianjhang.com](https://brianjhang.com/)

我是把 BookmarkOps 當成自己想用的工具在做。bug 回報、奇怪的書籤樹案例、「你有沒有想過 X 功能」這類來信都很歡迎。

---

## 授權

MIT 授權 —— 詳見 [`LICENSE`](./LICENSE)。Copyright © 2026 Brian Jhang。

---

## 延伸閱讀

- MCP 整合 & 威脅模型 —— [`src/agent/README.md`](./src/agent/README.md)
- 繁中快速上手 —— [`docs/zh-TW/getting-started.zh-TW.md`](./docs/zh-TW/getting-started.zh-TW.md)
