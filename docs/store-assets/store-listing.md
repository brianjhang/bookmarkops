# BookmarkOps — Chrome Web Store Listing

**English** · [繁體中文](./store-listing.zh-TW.md) · [简体中文](./store-listing.zh-CN.md)

> Source of truth for the Chrome Web Store form. Paste each section into the matching CWS field at submission time.
>
> **Version:** 1.0 · **Last updated:** 2026-05-15

---

## Title (max 40 characters)

```
BookmarkOps — AI bookmark cleanup
```

> Count: 33 characters · ✓ within limit.

---

## Summary / Tagline (max 132 characters)

```
AI bookmark cleanup for Chrome — connect Codex, Claude Code, or Cursor, then approve every change yourself in the dashboard.
```

> Count: 125 characters · ✓ within limit.
>
> This is the line shown in CWS search results. Lead with the value, name the AI tools, set the safety expectation.

---

## Detailed description

Your bookmarks are probably a mess. Years of "I'll get to that later" piled into folders nobody opens. You've thought about cleaning them up, but the prospect of manually re-sorting a thousand entries is exactly why it never happens.

BookmarkOps lets an AI tool — **OpenAI Codex**, **Claude Code**, or **Cursor** — do the planning work for you. You ask it to scan your bookmarks and propose a cleanup plan. BookmarkOps generates a structured report, the AI drafts the plan, and the extension queues that plan for your review. **Nothing in your bookmark tree changes until you type the word `APPLY` in the dashboard.**

### What is MCP, and why does it matter?

MCP — the **Model Context Protocol** — is a small bridge that lets AI tools talk to local applications safely. With BookmarkOps's MCP server connected, your AI tool can ask the extension to:

- Scan your bookmark tree and return a report.
- Submit a cleanup plan for your review.
- Check whether the plan would succeed (a "dry run").

What the AI tool **cannot** do is change anything. It can only propose. You're the only one who can hit APPLY.

### Three things that make BookmarkOps different

**1. Runs entirely on your machine.** Your bookmarks are not uploaded anywhere. The MCP bridge binds to `localhost:7842` and is unreachable from outside your computer. No telemetry, no analytics, no remote logging, no third-party SDK. Every byte of code is open source and auditable.

**2. Three-layer confirmation before any destructive change.** Applying a plan, restoring a backup, and deleting a backup each require typing a different confirmation phrase — `APPLY`, `RESTORE`, `DELETE BACKUP`. Before any apply, a full snapshot of your bookmark tree is taken automatically. You can roll back to any prior snapshot with a single typed confirmation.

**3. Open source under MIT.** Every line of the BookmarkOps extension and the `@bookmarkops/mcp` Node package is on GitHub. You can read the code, build it yourself, fork it, audit it. There is no closed-source server, no proprietary backend, no future pivot into telemetry.

### How the workflow runs

```
scan → report → plan → dryRun → preview → backup → apply → verify → restore
```

1. **Scan** — BookmarkOps reads your bookmark tree through Chrome's official `chrome.bookmarks` API.
2. **Report** — An AI-readable Markdown or JSON summary is generated locally.
3. **Plan** — Your AI tool drafts a `bookmark-plan.json` and submits it through MCP.
4. **DryRun** — BookmarkOps simulates the plan against a copy of your tree and shows you exactly what would change.
5. **Preview** — Grouped, color-coded operations appear in the dashboard.
6. **Backup** — Before any change runs, the full bookmark tree is snapshotted.
7. **Apply** — Only after you type `APPLY` do the changes happen.
8. **Verify** — BookmarkOps re-checks the live tree against the plan and reports what passed or failed.
9. **Restore** — If anything looks wrong, restore from any prior backup with a typed `RESTORE`.

### Quick start

> **First-time users: we recommend OpenAI Codex.** Its desktop app looks like ChatGPT, Claude, or Gemini — familiar to anyone who has used a modern AI chat. Codex also has a generous free tier, which is enough to clean up most bookmark collections without paying for a subscription.

1. Install BookmarkOps from the Chrome Web Store.
2. Open the dashboard, copy the MCP configuration block from the **Quick Setup** card.
3. Paste it into your AI tool (Codex, Claude Code, or Cursor).
4. Ask the AI: "Scan my bookmarks and suggest a cleanup plan."
5. Review the proposed changes in the dashboard. Approve or reject.

### Who BookmarkOps is for

- **People who already work with AI tools.** If you already use Codex, Claude Code, or Cursor — whether for writing code or just talking with an AI — BookmarkOps adds bookmark cleanup to the same conversation. No extra account, no separate tool to learn.
- **People with thousands of unorganized bookmarks.** If your bookmark bar has been growing for years and you keep putting off the cleanup, the AI can do the tedious classification work in minutes.
- **Privacy-conscious users.** If you don't want your browsing history or bookmark titles uploaded to a cloud service for "AI organization", BookmarkOps keeps everything local.

### Frequently asked questions

**Do I need to install anything besides the extension?**
You need an AI tool that supports MCP (Codex, Claude Code, Cursor, or anything else that speaks the protocol). The MCP bridge (`@bookmarkops/mcp`) is fetched automatically by `npx` the first time your AI tool starts it — no manual installation.

**Can I use BookmarkOps without an MCP-capable AI tool?**
Not in v0.1. The cleanup workflow currently requires an MCP-capable AI tool to draft and submit the plan. The shortest path is OpenAI Codex (see Quick start above). A file-based manual mode — drop in a plan JSON without any AI tool — is on the v0.2 roadmap.

**What happens if a cleanup goes wrong?**
Every apply takes a backup first. Type `RESTORE` in the dashboard and the previous bookmark state is restored, exactly as it was.

**What if I rotate my MCP token?**
Rotate in the dashboard, copy the new Quick Setup config, then restart your AI tool. The old token stops working once your AI tool restarts. See the [agent documentation](https://github.com/brianjhang/bookmarkops/blob/main/src/agent/README.md#security-model) for the full rotation flow and security model.

### Open source

BookmarkOps is open source under the MIT License. The Chrome extension and the `@bookmarkops/mcp` Node package both live in the same GitHub repository, with the privacy policy, threat model, and architecture documentation alongside the source code.

GitHub: https://github.com/brianjhang/bookmarkops

---

## Category

**Recommended: Productivity**

Justification:
- The core user value is "clean up the bookmark mess I have been avoiding" — a productivity job-to-be-done.
- "Bookmark cleanup" and "bookmark manager" searches in CWS sit in Productivity, not Developer Tools.
- The MCP integration is a *means*, not the *purpose*; placing it under Developer Tools would narrow discoverability to coding-AI users only, but the real audience is anyone with a bookmark mess plus access to a modern AI tool.

Secondary option if Productivity is not allowed in your region: **Workflow & Planning**.

Avoid: Developer Tools (too narrow), Tools (deprecated), Utilities (too generic).

---

## Single-purpose description (CWS required field)

```
BookmarkOps helps users clean up and reorganize their Chrome bookmarks through a safe, local workflow. AI tools connected via the Model Context Protocol may assist by proposing cleanup plans, but every change requires the user's explicit typed confirmation in the dashboard before any bookmark is modified.
```

> The single purpose is bookmark cleanup. MCP integration is a method to achieve that purpose, not a separate purpose.

---

## Permission justifications

The Chrome Web Store reviewer asks why each sensitive permission is needed. Here is the justification text for each — written conversationally for a human reviewer.

### `bookmarks` (most heavily scrutinized)

BookmarkOps is a bookmark cleanup extension. The `bookmarks` permission is the entire core feature: the extension reads the bookmark tree to scan, generate reports, and simulate cleanup plans; it writes to the tree only when applying a plan that the user has explicitly approved by typing the word `APPLY` in the dashboard. No bookmark data is ever sent to a remote server. All reads and writes go through Chrome's official `chrome.bookmarks` API.

### `storage`

Used to persist:
- The user's MCP session token (so AI tools can reconnect without re-pairing).
- Dashboard preferences (theme, locale).
- The most recent scan snapshot (so the dashboard can show stats without re-scanning).
- Full pre-apply backups (so the user can restore the bookmark tree if a cleanup goes wrong).

All data is stored in `chrome.storage.local` on the user's device. Nothing is synced or uploaded.

### `alarms`

Schedules a single 1-minute polling cycle so BookmarkOps can pick up new MCP requests sent by the user's AI tool through the local bridge at `localhost:7842`. Without this alarm, MCP requests would not be processed in a timely manner. There is no other background work scheduled.

### Host permission `http://localhost:7842/*`

BookmarkOps communicates with the user's MCP server through a local-only bridge that binds to `127.0.0.1:7842`. This host permission grants the extension the ability to make HTTP requests to that local bridge. The bridge is unreachable from other machines because it only listens on the loopback interface. No external host is accessed by BookmarkOps.

---

## Cross-references

- **Privacy policy:** [`docs/privacy-policy.md`](../privacy-policy.md) — the full statement, including data-flow details and the user's data-control options.
- **Threat model:** [`src/agent/README.md` → Security model](https://github.com/brianjhang/bookmarkops/blob/main/src/agent/README.md#security-model).
- **README:** project overview, install steps, development guide.

When filling in the CWS form, the **Privacy Policy URL** field should point to the GitHub Pages URL of `docs/privacy-policy.md` once Pages is enabled (see release checklist B.7).
