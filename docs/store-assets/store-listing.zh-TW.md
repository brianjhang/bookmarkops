# BookmarkOps — Chrome Web Store 上架文案

[English](./store-listing.md) · **繁體中文** · [简体中文](./store-listing.zh-CN.md)

> 對應 Chrome Web Store 上架表單的文案來源——listing 欄位與 Privacy practices
> 分頁欄位皆涵蓋。提交時把每一段貼到對應欄位即可。本檔已併入先前獨立草擬的
> Privacy-practices 修正內容(單一用途、權限說明、資料使用揭露);該獨立草稿
> 已被本檔取代。
>
> **版本:** 2.0(已校正)· **最後更新:** 2026-05-19
>
> 必須與 repo 根目錄 `PRIVACY-POLICY.md`(英文)完全一致。審查員會交叉比對
> listing ↔ manifest ↔ 隱私政策,任何不一致是首次送審最常見的退件原因。

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

> 約 75 字元 · ✓ 在上限內。CWS 搜尋結果頁第一眼看到的一句。

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

> **新手通常覺得 OpenAI Codex 最好上手** —— 它的桌面端就是一個熟悉的 AI 對話介面,幾乎不用學。BookmarkOps 接 Claude Code 或 Cursor 完全一樣;用你手邊已經有的那個 AI 工具就行。

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
目前版本不行。整理流程目前一定要靠支援 MCP 的 AI 工具起草計畫並提交。最簡單的路徑是 OpenAI Codex(見上方快速開始)。檔案匯入式的手動模式 —— 直接丟一份 plan JSON、不用接 AI 工具 —— 列入未來版本的路線圖。

**萬一整理出錯怎麼辦?**
每次套用前都會自動備份。在 Dashboard 輸入 `RESTORE`,書籤樹就會回到先前狀態,一模一樣。

**輪替 token 之後要做什麼?**
在 Dashboard 輪替後,複製新的 Quick Setup 設定,然後**重啟你的 AI 工具**。舊 token 在 AI 工具重啟之後就失效。完整流程與威脅模型見 repository 內的 agent 文件(Security model 段落)。

### 開源

BookmarkOps 採 MIT 授權。Chrome 擴充套件、`@bookmarkops/mcp` Node 套件、隱私政策、威脅模型、架構文件,全部都在同一個 GitHub repo。

GitHub: https://github.com/brianjhang/bookmarkops

---

## 類別 / Category

**建議:Productivity(生產力工具)**

理由:
- 核心使用者價值是「整理一直拖著沒整的書籤」 —— 屬生產力 job-to-be-done。
- CWS 上「bookmark cleanup」、「bookmark manager」搜尋落在 Productivity 類別,不在 Developer Tools。
- MCP 整合是**手段**,不是**目的**;歸到 Developer Tools 反而把可觸及的使用者縮到只剩寫程式的人。

備案(若某些地區 Productivity 不開放):**Workflow & Planning**。
避開:Developer Tools(太窄)、Tools(已淘汰)、Utilities(太空)。

---

## 單一用途說明 / Single-purpose description(CWS Privacy practices 欄位)

```
BookmarkOps 協助使用者檢視並安全地整理 Chrome 書籤。它掃描書籤、提出整理建議(重複、失效連結、雜亂資料夾),每個改動套用前都讓使用者檢視並核准,並自動做本機備份。使用者也可以選擇把自己本機跑的 AI 命令列工具透過 loopback(localhost)bridge 接上來協助檢視。所有處理都在使用者裝置本機進行;擴充套件不發出任何遠端網路請求。
```

> 「單一用途」是書籤整理。MCP / AI 整合是達成此目的的手段,不是另一個獨立用途。此段必須與隱私政策一致。

---

## 各權限說明 / Permission justifications(CWS Privacy practices 欄位)

### `bookmarks`

> 核心功能。擴充套件讀取書籤(含 Chrome 對每個書籤提供的 metadata,如加入日期、最後使用日期,用以分類使用頻率)以分析重複、失效連結與雜亂,並在使用者於 Dashboard 親自輸入 `APPLY`、檢視核准後才套用整理改動。書籤整理是本擴充套件的核心目的,沒有此權限無法達成。所有讀寫都透過 Chrome 官方 `chrome.bookmarks` API;不會有任何書籤資料送到遠端伺服器。

### `storage`

> 透過 `chrome.storage.local` 把擴充套件自己的資料存在使用者裝置本機:設定與 UI 偏好;用來驗證與使用者本機 AI bridge 連線的 session token;掃描結果與健康度分數的快取;由使用者 AI 工具提交、等待使用者檢視的整理計畫與核准請求;以及 review-and-restore 工作流程用的安全備份/快照。這些都不同步、不傳出裝置。

### `alarms`

> 排程一個定期(約每分鐘一次)的本機檢查,向使用者本機的選用 AI bridge 輪詢使用者 AI 工具可能提交的待審工作。該請求只送到使用者本機的 loopback(localhost)位址。它從安裝起就執行,不論使用者是否設定過 AI 工具;若沒有 bridge 在跑,請求靜默失敗,不送出也不接收任何東西。沒有其他背景任務。

### Host permission `http://localhost:7842/*`

> 只連到使用者本機的 loopback 位址。這是使用者自己啟動的選用本機 bridge(透過 `npx @bookmarkops/mcp`),在使用者選擇接上本機 AI 命令列工具(如 Claude Code、Cursor、Codex)協助書籤檢視時用。用於檢查 bridge 健康狀態、在本機交換書籤檢視的工作與結果。Bridge 只監聽 loopback 介面,別台機器連不到。擴充套件未宣告任何其他 host permission,Chrome 會擋掉任何非 localhost 請求。

### 遠端程式碼 / Remote code

> 無。擴充套件不執行任何遠端託管的程式碼。所有邏輯都打包在套件內(符合 Manifest V3)。

---

## 資料使用揭露與 Limited Use 聲明 / Data usage disclosure & Limited Use(CWS Privacy practices 欄位)

**擴充套件處理哪些資料、資料去哪:**

> BookmarkOps 不向開發者或任何第三方蒐集或傳輸使用者資料。沒有任何分析或 telemetry。書籤資料在本機讀取與處理。存在兩條本機限定的資料路徑,皆由使用者控制且已在隱私政策揭露:(1) 當使用者已接上自己本機的 AI 工具、該工具提交請求時,書籤資料(如掃描結果、報告、提交的整理計畫)會回傳到使用者本機的 loopback bridge —— 擴充套件與 bridge 都不會把它轉發到任何雲端服務;(2) 當使用者點擊複製/啟動按鈕或 MCP 設定助手時,相關內容(書籤 context,或本機 bridge session token)會寫入使用者的系統剪貼簿,由作業系統管理,等同於手動複製。任何後續送往雲端 AI 的傳輸,完全由使用者自己安裝並以自己帳號/API key 設定的那個獨立 AI 工具執行 —— 不在 BookmarkOps 控制範圍內。

**聲明(以下皆屬實):**

- 除已核准用途外,不販售或轉移使用者資料給第三方。✔(資料只在使用者 AI 工具請求時送到使用者自己的本機 bridge,或在使用者點擊時送到使用者自己的剪貼簿)
- 不將使用者資料用於與本項目單一用途無關的目的。✔
- 不將使用者資料用於判斷信用度或貸款用途。✔

---

## 隱私政策 URL / Privacy policy URL(CWS 欄位)

```
https://github.com/brianjhang/bookmarkops/blob/main/PRIVACY-POLICY.md
```

> 這條確切 URL 填進 CWS「隱私政策」欄位。它必須與 `PRIVACY-POLICY.md` 內「Changes」段落的 URL 完全一致(分支 `main`、檔名大小寫完全相同)。送審前該檔必須在此 URL 已 live 且能正常 render(在瀏覽器確認 200)。不涉及任何 GitHub Pages。
>
> 註:v1 隱私政策僅提供英文版(根目錄 `PRIVACY-POLICY.md`)。中文化政策為未來版本候選,非 CWS 必要。

---

## 交叉引用 / Cross-references

- **隱私政策:** repo 根目錄 [`PRIVACY-POLICY.md`](https://github.com/brianjhang/bookmarkops/blob/main/PRIVACY-POLICY.md)(英文)—— 完整聲明,含本機資料流向與剪貼簿管道細節。
- **威脅模型 / 安全模型:** repository 內的 agent 文件(`src/agent/README.md`,Security model 段落)—— *引用前須先確認此路徑/anchor 在 sync 後的 public repo 真的存在。*
- **README:** 專案總覽、安裝步驟、開發指南。

沒有 GitHub Pages 這一步。CWS 隱私政策 URL 欄位填上方「隱私政策 URL」段的 repo 根目錄 blob URL。
