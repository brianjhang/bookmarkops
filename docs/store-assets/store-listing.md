# BookmarkOps — Chrome Web Store Listing

**English** (v1 ships English-only; zh-TW / zh-CN listing localization deferred to a later release)

> Single source of truth for the entire Chrome Web Store submission — listing
> fields AND Privacy practices tab fields. Paste each section into the
> matching CWS field at submission time. This now incorporates the corrected
> Privacy-practices content (single purpose, permission justifications, data
> disclosure) that was drafted standalone earlier; that standalone Part B is
> superseded by this file.
>
> **Version:** 2.0 (reconciled) · **Last updated:** 2026-05-19
>
> Must stay exactly consistent with repo-root `PRIVACY-POLICY.md`. Reviewers
> cross-check listing ↔ manifest ↔ privacy policy; any mismatch is the top
> first-time rejection cause.

---

## Title (max 40 characters)

```
BookmarkOps — AI bookmark cleanup
```

> 33 characters · within limit.

---

## Summary / Tagline (max 132 characters)

```
AI bookmark cleanup for Chrome — connect Codex, Claude Code, or Cursor, then approve every change yourself in the dashboard.
```

> 125 characters · within limit. Shown in CWS search results.

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

> **First-time users often find OpenAI Codex the easiest starting point** — its desktop app is a familiar AI-chat interface, so there's little to learn. BookmarkOps works identically with Claude Code or Cursor; use whichever AI tool you already have.

1. Install BookmarkOps from the Chrome Web Store.
2. Open the dashboard, copy the MCP configuration block from the **Quick Setup** card.
3. Paste it into your AI tool (Codex, Claude Code, or Cursor).
4. Ask the AI: "Scan my bookmarks and suggest a cleanup plan."
5. Review the proposed changes in the dashboard. Approve or reject.

### Who BookmarkOps is for

- **People who already work with AI tools.** If you already use Codex, Claude Code, or Cursor, BookmarkOps adds bookmark cleanup to the same conversation. No extra account, no separate tool to learn.
- **People with thousands of unorganized bookmarks.** If your bookmark bar has been growing for years, the AI can do the tedious classification work in minutes.
- **Privacy-conscious users.** If you don't want your bookmark titles uploaded to a cloud service for "AI organization", BookmarkOps keeps everything local.

### Frequently asked questions

**Do I need to install anything besides the extension?**
You need an AI tool that supports MCP (Codex, Claude Code, Cursor, or anything else that speaks the protocol). The MCP bridge (`@bookmarkops/mcp`) is fetched automatically by `npx` the first time your AI tool starts it — no manual installation.

**Can I use BookmarkOps without an MCP-capable AI tool?**
Not in this release. The cleanup workflow currently requires an MCP-capable AI tool to draft and submit the plan. The shortest path is OpenAI Codex (see Quick start above). A file-based manual mode — drop in a plan JSON without any AI tool — is on the roadmap for a future release.

**What happens if a cleanup goes wrong?**
Every apply takes a backup first. Type `RESTORE` in the dashboard and the previous bookmark state is restored, exactly as it was.

**What if I rotate my MCP token?**
Rotate in the dashboard, copy the new Quick Setup config, then restart your AI tool. The old token stops working once your AI tool restarts. See the agent documentation in the repository for the full rotation flow and security model.

### Open source

BookmarkOps is open source under the MIT License. The Chrome extension and the `@bookmarkops/mcp` Node package both live in the same GitHub repository, with the privacy policy, threat model, and architecture documentation alongside the source code.

GitHub: https://github.com/brianjhang/bookmarkops

---

## Category

**Recommended: Productivity**

Justification:
- The core user value is "clean up the bookmark mess I have been avoiding" — a productivity job-to-be-done.
- "Bookmark cleanup" / "bookmark manager" searches in CWS sit in Productivity, not Developer Tools.
- The MCP integration is a *means*, not the *purpose*; Developer Tools would narrow discoverability to coding-AI users only, but the real audience is anyone with a bookmark mess plus a modern AI tool.

Secondary option if Productivity is unavailable in your region: **Workflow & Planning**.
Avoid: Developer Tools (too narrow), Tools (deprecated), Utilities (too generic).

---

## Single-purpose description (CWS Privacy practices field)

```
BookmarkOps helps users review and safely clean up their Chrome bookmarks. It scans the bookmarks, surfaces cleanup suggestions (duplicates, dead links, disorganized folders), and lets the user review and approve every change before it is applied, with automatic local backups. Optionally, a user who runs their own local AI command-line tool can connect it via a loopback (localhost) bridge to assist with the review. All processing happens locally on the user's device; the extension makes no remote network requests.
```

> Single purpose = bookmark cleanup. The MCP/AI integration is a method to achieve that purpose, not a separate purpose. This text must match the privacy policy.

---

## Permission justifications (CWS Privacy practices fields)

### `bookmarks`

> Core functionality. The extension reads the user's bookmarks (including the metadata Chrome exposes per bookmark, such as date added / date last used, to classify usage) to analyze them for duplicates, dead links, and disorganization, and to apply cleanup changes that the user reviews and approves first by typing `APPLY` in the dashboard. Organizing bookmarks is the extension's central purpose and is impossible without this permission. All reads and writes use Chrome's official `chrome.bookmarks` API; no bookmark data is sent to any remote server.

### `storage`

> Stores the extension's own data locally on the user's device via `chrome.storage.local`: settings and UI preferences; the session token that authenticates the connection to the user's optional local AI bridge; cached scan results and health scores; review plans and approval requests the user's AI tool submitted that are pending the user's review; and the safety backups/snapshots that power the review-and-restore workflow. None of this is synced or transmitted off the device.

### `alarms`

> Schedules a periodic (about once per minute) local check that polls the user's optional local AI bridge for any review tasks the user's AI tool may have submitted. The request goes only to a loopback (localhost) address on the user's own machine. It runs from install whether or not the user has set up an AI tool; if no bridge is running it fails silently with nothing sent or received. No other background work is scheduled.

### Host permission `http://localhost:7842/*`

> Connects only to a loopback address on the user's own machine. This is an optional local bridge the user themselves starts (via `npx @bookmarkops/mcp`) when they choose to connect a local AI command-line tool such as Claude Code, Cursor, or Codex to assist with bookmark review. Used to check bridge health and to exchange bookmark-review tasks and results locally. The bridge listens only on the loopback interface and is unreachable from other machines. The extension declares no other host permission and Chrome blocks any non-localhost request.

### Remote code

> No. The extension executes no remotely hosted code. All logic is bundled in the package (Manifest V3 compliant).

---

## Data usage disclosure & Limited Use certification (CWS Privacy practices fields)

**What data the extension handles, and where it goes:**

> BookmarkOps does not collect or transmit user data to the developer or any third party. It contains no analytics or telemetry. Bookmark data is read and processed locally. Two local-only data paths exist, both under the user's control and disclosed in the privacy policy: (1) when the user has connected their own local AI tool and that tool submits a request, bookmark data (e.g. scan results, reports, submitted review plans) is returned to a loopback bridge on the user's own machine — neither the extension nor the bridge forwards it to any cloud service; (2) when the user clicks a copy/launch button or an MCP setup helper, the relevant content (bookmark context, or the local bridge session token) is written to the user's system clipboard, governed by the OS, equivalent to a manual copy. Any onward transmission to a cloud AI is performed solely by the separate AI tool the user installed and configured under their own account/API key — outside BookmarkOps's control.

**Certifications (all truthfully apply):**

- I do not sell or transfer user data to third parties, outside of the approved use cases. ✔ (data goes only to the user's own local bridge at the user's AI tool's request, or to the user's own clipboard on the user's click)
- I do not use or transfer user data for purposes unrelated to my item's single purpose. ✔
- I do not use or transfer user data to determine creditworthiness or for lending purposes. ✔

---

## Privacy policy URL (CWS field)

```
https://github.com/brianjhang/bookmarkops/blob/main/PRIVACY-POLICY.md
```

> This exact URL goes in the CWS "Privacy policy" field. It must match the
> URL inside `PRIVACY-POLICY.md`'s "Changes" section (branch `main`, exact
> filename casing). The policy file must be live and render at this URL
> (verify 200 in a browser) before submission. No GitHub Pages is involved.

---

## Cross-references

- **Privacy policy:** repo-root [`PRIVACY-POLICY.md`](https://github.com/brianjhang/bookmarkops/blob/main/PRIVACY-POLICY.md) — the full statement, including the local data-flow details and the clipboard channel.
- **Threat model / security model:** agent documentation in the repository (`src/agent/README.md`, Security model section) — *verify this path/anchor resolves on the public repo after sync before relying on it in the listing.*
- **README:** project overview, install steps, development guide.

There is no GitHub Pages step. The CWS Privacy Policy URL field is the repo-root blob URL shown in the "Privacy policy URL" section above.
