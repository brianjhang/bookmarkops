# BookmarkOps 快速開始(繁中)

這份文件是給非工程背景的使用者看的繁中入門指引。完整介紹見根目錄 [`README.zh-TW.md`](../../README.zh-TW.md);本檔只談「裝起來、跑一次」。

## BookmarkOps 是什麼

BookmarkOps 是一個 **AI 書籤整理 MCP 工具**(v0.1):

> 透過 Claude Code、Cursor、Codex 等支援 MCP 的 AI 工具掃描、規劃、清理你的 Chrome 書籤;所有會改動書籤的動作,必須由你在 Dashboard 明確核准才會執行。

它不會直接幫你亂刪書籤。正確流程是:**掃描 → 產生整理計畫 → 試跑 → 你核查 → 明確同意後套用**。

## 安全邊界

- 書籤資料不上傳到外部服務 —— BookmarkOps 不經手 AI 工具如何處理你的書籤,那由 AI 工具自己的隱私政策決定。
- 不需要 GitHub token、不需要 AI API key、不收 telemetry。
- 不讀取完整瀏覽紀錄(沒申請 `history` permission)。
- 不直接讀寫 Chrome 的 `Bookmarks` 檔案 —— 一律透過官方 `chrome.bookmarks` API。
- MCP bridge 只綁 `127.0.0.1:7842`,別台機器連不進來。
- 完整威脅模型見 [`src/agent/README.md` → Security model](../../src/agent/README.md#security-model)。

## 開發者驗證(可選)

如果你想自己 build 確認:

```bash
npm install
npm run validate
```

`npm run validate` 會跑核心掃描測試、工作流程測試,並執行正式 build。

## 載入到 Chrome(Chrome Web Store 上架前的方式)

```bash
npm run build
```

1. 打開 Chrome 擴充功能頁:`chrome://extensions`
2. 開啟右上角 **開發人員模式**(Developer mode)。
3. 點 **載入未封裝項目**(Load unpacked)。
4. 選擇剛 build 出來的 `dist/` 資料夾(不是專案根目錄)。

Chrome Web Store 上架後,直接從商店安裝即可,不用這套步驟。

## 接上 AI 工具

打開 BookmarkOps Dashboard → **AI Agent Settings** → **Quick Setup**,複製 JSON 設定貼到你的 AI 工具裡。

**首次使用者推薦 OpenAI Codex** —— Codex 桌面端介面跟 ChatGPT、Claude、Gemini 一樣熟悉,有每天免費額度,整理大多數人的書籤完全夠用。

設定範例完整版見根 README:[Quick Start 段](../../README.zh-TW.md#快速開始)。

## 一句話請 AI 開始

接好 AI 工具後,直接跟它說:

```text
掃描我的書籤,提一個整理計畫,先不要套用任何修改。
```

AI 工具會呼叫 BookmarkOps 的 `scan_bookmarks` + `get_report`,看到你的書籤總數、資料夾數、使用健康度、可整理機會,然後起草一份 `bookmark-plan.json` 排進等你核准的佇列。

這一步**只讀,不修改任何書籤**。

## 隔離測試與真實測試差異

```bash
npm run test:isolated-runtime
```

這個測試開一個**臨時 Chrome profile**,不會碰你真實 Chrome 的書籤。

真實 Chrome 書籤上的 Apply / Restore / Delete backup 一定要你在 Dashboard 上輸入確認字串(`APPLY` / `RESTORE` / `DELETE BACKUP`)才會執行。

## Agent Operator Mode

Agent Operator 預設開啟。Agent 可以做的事:

- 掃描書籤、產生報告。
- 提交整理計畫。
- 要求試跑(dryRun)。
- **排隊**請求套用、還原、刪除備份(等你核准)。

Agent **不能直接做**的事:

- 套用整理計畫。
- 還原備份。
- 刪除備份。

這三種高風險動作都必須在 Dashboard 上由你輸入確認字串才會執行 —— AI 工具沒有任何 bypass 路徑。

## 接下來

- 想看完整安裝步驟、所有 AI 工具(Claude Code / Cursor / Codex)的設定:[`README.zh-TW.md`](../../README.zh-TW.md)
- 想看完整 MCP 整合說明、可用工具、威脅模型:[`src/agent/README.md`](../../src/agent/README.md)
