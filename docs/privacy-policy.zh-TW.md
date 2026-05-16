# BookmarkOps 隱私政策

[English](./privacy-policy.md) · **繁體中文** · [简体中文](./privacy-policy.zh-CN.md)

> **版本:** 1.0 · **最後更新:** 2026-05-15

## 一句話

BookmarkOps 不收集、不傳輸、不在你瀏覽器以外的任何地方儲存你的資料。唯一的網路通訊是 `localhost:7842` 的本機 MCP bridge,只綁本機介面,不對外開放。

## BookmarkOps 會碰到哪些資料

所有 BookmarkOps 讀寫的內容都留在你的電腦裡:

- **書籤樹** —— 透過 `chrome.bookmarks`(Chrome 原生書籤 API)讀取與修改。Plan、DryRun、Apply、Restore、Verify 全部走這個 API。
- **本機擴充套件儲存空間** —— `chrome.storage.local`,存放 Agent session token、BookmarkOps 設定、Dashboard 偏好(主題、語言)、最近一次掃描快照、以及 Apply 前自動建立的書籤完整備份。
- **本機 alarms** —— 排程一個每分鐘執行一次的背景任務,專門 poll 本機 MCP bridge。

沒有遠端資料庫、沒有分析服務、沒有伺服器端 log、也沒有任何第三方 SDK 嵌在裡面。

## 各權限的具體用途

| 權限 | 用途 | 為什麼需要 |
|---|---|---|
| `bookmarks` | 讀寫你的 Chrome 書籤 | 整個核心功能就是這個,沒有它 BookmarkOps 無法掃描或整理。 |
| `storage` | 讀寫 `chrome.storage.local` | 用來持久化 token、設定、掃描快取、備份快照 —— 全部存在你 Chrome profile 的本機檔案。 |
| `alarms` | 排程一個 1 分鐘背景任務 | poll 本機 MCP bridge,看有沒有 AI 工具送來的新請求。 |
| Host permission `http://localhost:7842/*` | 跟本機 MCP bridge 通訊 | 該 bridge 只綁 `127.0.0.1`,別台機器連不進來。 |

BookmarkOps **沒有**請求 `history`、`cookies`、`webRequest`、`notifications`,也沒有任何對外網站的 host permission。

## MCP 資料流向(只在你選擇使用時)

如果你透過 [`@bookmarkops/mcp`](https://www.npmjs.com/package/@bookmarkops/mcp) 接上 AI 工具(Claude Code、Cursor、Codex 等):

1. MCP server —— 你的 AI 工具啟動的一個小型 Node process —— 在 `localhost:7842` 開啟 bridge。
2. 當 AI 要求掃描或產生報告時,BookmarkOps 從你的本機書籤樹讀出書籤標題、URL、資料夾路徑回覆給它。
3. 那份回覆被你的 AI 工具讀走。**那份資料接下來怎麼被處理 —— 包括 AI 工具是否把它送到雲端 LLM —— 由你的 AI 工具自己的隱私政策決定,不是 BookmarkOps 決定。**
4. BookmarkOps 本身**沒有任何** API key、雲端服務,或對外的 HTTP 呼叫(本機 bridge 以外)。

簡單講:BookmarkOps 透過本機 socket 把資料交給你選的 AI 工具;之後發生什麼事是你跟 AI 服務商之間的事。

### 我們防什麼、不防什麼(摘要)

完整威脅模型在 agent README 的 [Security model 段落](https://github.com/brianjhang/bookmarkops/blob/main/src/agent/README.md#security-model)。簡要摘要如下:

**已防的攻擊面**

- MCP bridge 只綁 `127.0.0.1`,別台機器連不到
- MCP server 強制要 `BOOKMARKOPS_TOKEN` env,沒設值直接退出
- Bridge `/enqueue` 驗 token,不對的請求不會進入 queue
- Bridge `/pending` 回應不會回傳 token 明文
- Dashboard 來源檢查 —— `apply` / `restore` / `delete backup` / `reveal token` 全部要從 Dashboard 自己發起
- 上述四個動作各自要打字確認:`APPLY` / `RESTORE` / `DELETE BACKUP` / `REVEAL`

**不防的攻擊面**

- 本機已被入侵的情境 —— 攻擊者拿到 user-level shell 時,可直接從 Chrome profile 檔案讀書籤和 token,沒有任何 extension 機制能擋
- Token rotation 不是即時撤銷 —— 在 Dashboard 輪替後,舊 MCP server 仍會用舊 token 直到重啟,所以輪替後請順手重啟 AI 工具

## 我們不做的事

- 不收集 telemetry、不做使用分析、不收 crash report。
- 沒有追蹤 pixel、fingerprint 或任何識別碼。
- 沒有任何對外 HTTP 呼叫(本機 MCP bridge 以外)。
- 不收集 email、姓名、或任何帳號憑證。
- 沒有「匿名化資料匯出」這種事 —— 因為根本沒有任何資料匯出。

## 你能掌控的事

- **解除安裝就清掉所有資料。** 在 `chrome://extensions` 移除 BookmarkOps,`chrome.storage.local` 裡的 token、設定、備份、掃描快取全部一併消失。遠端伺服器上沒有任何東西可清,因為從來沒送過。
- **本機就可檢視。** Chrome DevTools → Application → Storage → Extensions → BookmarkOps → `chrome.storage` 可看到 BookmarkOps 所有儲存的內容。
- **隨時輪替 token。** Dashboard → AI Agent Settings → Rotate,產一把新 token;舊的隨 AI 工具下次重啟 MCP server 就失效。
- **單獨刪備份。** Apply 前自動建立的每份備份,都可以在 Dashboard 上輸入 `DELETE BACKUP` 個別刪除。

## 聯絡方式

- Email:me@brianjhang.com。
- GitHub issues:[https://github.com/brianjhang/bookmarkops/issues](https://github.com/brianjhang/bookmarkops/issues)(repo 設為 Public 後此連結會生效)。

## 政策更新

本政策的版本管理跟 BookmarkOps 程式碼一起在 git repo 內。任何實質性變動 —— 新增權限、新增資料流向、新增第三方整合 —— 都會反映在本文件,並在主 [`README.md`](../README.md) 標註。文件頂端的「最後更新」是 canonical 時間戳。
