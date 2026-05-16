# BookmarkOps — Chrome Web Store 上架文案

[English](./store-listing.md) · **繁體中文** · [简体中文](./store-listing.zh-CN.md)

> 對應 Chrome Web Store 上架表單的文案來源。提交時把每一段貼到對應欄位即可。
>
> **版本:** 1.0 · **最後更新:** 2026-05-15

---

## 名稱 / Title(上限 40 字元)

```
BookmarkOps — AI 書籤整理工具
```

> 字元數:23 · ✓ 在上限內。

---

## 簡介 / Summary(上限 132 字元)

```
用 AI 整理 Chrome 書籤 —— 接上 Codex、Claude Code 或 Cursor,每個改動都要你在 Dashboard 親自確認才會生效。
```

> 字元數:約 75 · ✓ 在上限內。
>
> 這是 CWS 搜尋結果頁第一眼看到的一句。先講價值、點名 AI 工具、設定安全感的預期。

---

## 詳細描述 / Detailed description

你的書籤多半是一團亂。多年累積下來「之後再整理」的書頁,塞在沒人開過的資料夾裡。你想清理,但「手動重新排一千條書籤」這件事光想就累,所以一直沒做。

BookmarkOps 讓 AI 工具 —— **OpenAI Codex**、**Claude Code**、或 **Cursor** —— 替你做規劃。你跟 AI 說「掃一下我的書籤,提一個整理計畫」,BookmarkOps 產出結構化報告、AI 起草計畫、擴充套件把計畫排進等你審核的佇列。**在你親手在 Dashboard 上輸入 `APPLY` 之前,書籤樹一個字都不會被改動。**

### 什麼是 MCP?為什麼重要?

MCP —— **Model Context Protocol**(模型上下文協議)—— 是一條小橋,讓 AI 工具能安全地跟本機程式對話。把 BookmarkOps 的 MCP server 接上去之後,你的 AI 工具能要求擴充套件:

- 掃描書籤樹、回傳報告。
- 提交一份整理計畫等你審核。
- 試跑(dry run)看看計畫會不會出錯。

但 AI 工具**做不到的事**是:**直接動手改**。它只能提案。能按下 `APPLY` 的只有你。

### 三個讓 BookmarkOps 不一樣的地方

**1. 完全本機執行。** 你的書籤不會被上傳到任何地方。MCP bridge 只綁 `localhost:7842`,別台機器連不到。沒有 telemetry、沒有分析、沒有遠端 log、沒有任何第三方 SDK 嵌在裡面。每一行程式碼都開源、可審查。

**2. 任何破壞性動作都要三層確認。** 套用計畫、還原備份、刪除備份,各自要打不同的確認字串 —— `APPLY` / `RESTORE` / `DELETE BACKUP`。每次套用前,書籤樹會自動完整備份;不滿意可以打一個字回到先前狀態。

**3. MIT 開源。** BookmarkOps 擴充套件本身、加上 `@bookmarkops/mcp` Node 套件,全部程式碼公開在 GitHub。可讀、可自行 build、可 fork、可審查。沒有閉源伺服器、沒有獨佔後端、也不會未來轉型成蒐集 telemetry。

### 工作流程

```
scan → report → plan → dryRun → preview → backup → apply → verify → restore
```

1. **掃描(Scan)** —— BookmarkOps 透過 Chrome 官方 `chrome.bookmarks` API 讀書籤樹。
2. **報告(Report)** —— 本機產生 AI 看得懂的 Markdown 或 JSON 摘要。
3. **計畫(Plan)** —— 你的 AI 工具透過 MCP 起草 `bookmark-plan.json` 並提交。
4. **試跑(DryRun)** —— BookmarkOps 對著書籤樹的副本模擬計畫,呈現會發生什麼變動。
5. **預覽(Preview)** —— Dashboard 用顏色分組顯示每個操作。
6. **備份(Backup)** —— 真正動手前,完整書籤樹自動快照。
7. **套用(Apply)** —— **只有**你輸入 `APPLY` 之後,改動才會發生。
8. **驗證(Verify)** —— BookmarkOps 把實際樹的狀態跟計畫比對,呈現通過 / 失敗。
9. **還原(Restore)** —— 任何不對勁,輸入 `RESTORE` 從任何一份備份還原。

### 快速開始

> **首次使用者推薦 OpenAI Codex。** Codex 桌面端介面跟 ChatGPT、Claude、Gemini 一樣,對用過現代 AI 對話工具的人來說零門檻。每天有免費額度,整理大多數人的書籤完全夠用,不必付訂閱費。

1. 從 Chrome Web Store 安裝 BookmarkOps。
2. 打開 Dashboard,從 **Quick Setup** 卡片複製 MCP 設定。
3. 貼到你的 AI 工具(Codex、Claude Code、Cursor)。
4. 跟 AI 說:「掃描我的書籤,提一個整理計畫。」
5. 在 Dashboard 上審核提案、決定要不要套用。

### 適合誰

- **已經在跟 AI 工具一起做事的人** —— 用過 Codex、Claude Code 或 Cursor 都可以,不管你寫不寫程式,只要在用 AI 對話。BookmarkOps 把書籤整理塞進你既有的 AI 對話。不用多開帳號、不用學新工具。
- **書籤多到爆的人** —— 書籤列累積五年沒整,AI 可以幾分鐘做完那個無聊的分類工作。
- **重視隱私的人** —— 不想把書籤資料丟到雲端「AI 整理」服務的話,BookmarkOps 全程本機。

### 常見問題

**除了擴充套件還要裝什麼?**
要有一個支援 MCP 的 AI 工具(Codex、Claude Code、Cursor 等)。MCP bridge 本身(`@bookmarkops/mcp`)會在 AI 工具第一次啟動時透過 `npx` 自動下載,不用手動安裝。

**沒有支援 MCP 的 AI 工具能用嗎?**
v0.1 不行。整理流程目前一定要靠支援 MCP 的 AI 工具起草計畫並提交。最簡單的路徑是 OpenAI Codex(見上方快速開始)。檔案匯入式的手動模式 —— 直接丟一份 plan JSON、不用接 AI 工具 —— 列入 v0.2 路線圖。

**萬一整理出錯怎麼辦?**
每次套用前都會自動備份。在 Dashboard 輸入 `RESTORE`,書籤樹就會回到先前狀態,一模一樣。

**輪替 token 之後要做什麼?**
在 Dashboard 輪替後,複製新的 Quick Setup 設定,然後**重啟你的 AI 工具**。舊 token 在 AI 工具重啟之後就失效。完整流程跟威脅模型在 [agent 文件的 Security model 段落](https://github.com/brianjhang/bookmarkops/blob/main/src/agent/README.md#security-model)。

### 開源

BookmarkOps 採 MIT 授權。Chrome 擴充套件、`@bookmarkops/mcp` Node 套件、隱私政策、威脅模型、架構文件,全部都在同一個 GitHub repo。

GitHub: https://github.com/brianjhang/bookmarkops

---

## 類別 / Category

**建議:Productivity(生產力工具)**

理由:
- 核心使用者價值是「整理一直拖著沒整的書籤」 —— 屬生產力 job-to-be-done。
- CWS 上「bookmark cleanup」、「bookmark manager」搜尋落在 Productivity 類別,不在 Developer Tools。
- MCP 整合是**手段**,不是**目的**;歸到 Developer Tools 反而把可觸及的使用者縮到只剩寫程式的人,但實際 TAM 是「有書籤亂、有現代 AI 工具可用」的所有人。

備案(若某些地區 Productivity 不開放):**Workflow & Planning**。

避開:Developer Tools(太窄)、Tools(已淘汰)、Utilities(太空)。

---

## 單一用途說明 / Single-purpose description(CWS 必填)

```
BookmarkOps 協助使用者透過安全的本機工作流程整理 Chrome 書籤。透過 Model Context Protocol 連線的 AI 工具可協助提出整理計畫,但任何書籤改動前都必須使用者在 Dashboard 親自輸入確認字串才會執行。
```

> 「單一用途」是書籤整理。MCP 整合是達成此目的的手段,不是另一個獨立用途。

---

## 各權限說明 / Permission justifications

Chrome Web Store 審查員會問每個敏感權限為什麼需要。以下是給審查員看的口語化說明。

### `bookmarks`(審查最仔細的權限)

BookmarkOps 是書籤整理擴充套件,`bookmarks` 權限就是整個核心功能:擴充套件讀取書籤樹做掃描、產生報告、模擬整理計畫;**只有**在使用者於 Dashboard 上親自輸入 `APPLY` 字串、明確核准計畫之後,才會寫入書籤樹。沒有任何書籤資料會被送到遠端伺服器。所有讀寫都透過 Chrome 官方 `chrome.bookmarks` API。

### `storage`

用於持久化下列項目:
- 使用者的 MCP session token(讓 AI 工具不用每次重新配對)。
- Dashboard 偏好設定(主題、語言)。
- 最近一次掃描快照(讓 Dashboard 不用每次重掃就能顯示統計)。
- 套用前的完整書籤備份(讓使用者整理出錯時可還原)。

全部資料存在使用者裝置上的 `chrome.storage.local`,不同步、不上傳。

### `alarms`

只排程一個每分鐘執行一次的 polling 任務,讓 BookmarkOps 能透過 `localhost:7842` 的本機 bridge 取得 AI 工具送來的新 MCP 請求。沒有這個 alarm,MCP 請求無法及時處理。沒有其他背景任務。

### Host permission `http://localhost:7842/*`

BookmarkOps 透過綁在 `127.0.0.1:7842` 的本機 bridge 跟使用者的 MCP server 通訊。這個 host permission 允許擴充套件對該本機 bridge 發 HTTP 請求。Bridge 只監聽 loopback 介面,別台機器連不到。BookmarkOps **不存取任何外部主機**。

---

## 交叉引用

- **隱私政策:** [`docs/privacy-policy.zh-TW.md`](../privacy-policy.zh-TW.md) —— 含完整資料流向說明、使用者可掌控的事項。
- **威脅模型:** [`src/agent/README.md` → Security model](https://github.com/brianjhang/bookmarkops/blob/main/src/agent/README.md#security-model)。
- **README:** 專案總覽、安裝步驟、開發指南。

填 CWS 表單時,**Privacy Policy URL** 欄位應指向 `docs/privacy-policy.md` 的 GitHub Pages URL(等 B.7 啟用 Pages 後即可生效)。
