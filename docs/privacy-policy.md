# BookmarkOps Privacy Policy

**English** · [繁體中文](./privacy-policy.zh-TW.md) · [简体中文](./privacy-policy.zh-CN.md)

> **Version:** 1.0 · **Last updated:** 2026-05-15

## In one sentence

BookmarkOps does not collect, transmit, or store your data anywhere outside your own browser. The only network traffic is a local-only MCP bridge on `localhost:7842`, which never binds to a public interface and never leaves your machine.

## What data BookmarkOps touches

Everything BookmarkOps reads or writes stays on your computer:

- **Bookmark tree** — read and modified through `chrome.bookmarks` (Chrome's native bookmark API). Plans, dry runs, applies, restores, and verifies all go through this same API.
- **Local extension storage** — `chrome.storage.local` holds your agent session token, BookmarkOps settings, dashboard preferences (theme, locale), the latest scan snapshot, and full bookmark backups taken automatically before each apply.
- **Local alarms** — used to schedule the MCP bridge polling cycle on a 1-minute interval.

There is no remote database, no analytics service, no server-side log, and no third-party SDK embedded anywhere.

## Permissions explained

| Permission | What it lets BookmarkOps do | Why we ask for it |
|---|---|---|
| `bookmarks` | Read and write your Chrome bookmarks | This is the entire core feature; without it BookmarkOps cannot scan or clean up. |
| `storage` | Read and write `chrome.storage.local` | To persist your agent token, settings, scan cache, and backup snapshots — all on disk in your Chrome profile. |
| `alarms` | Schedule a 1-minute background task | To poll the local MCP bridge for new requests from your AI tool. |
| Host permission `http://localhost:7842/*` | Talk to the local MCP bridge | The bridge only binds to `127.0.0.1`. It is unreachable from other machines. |

BookmarkOps does not request `history`, `cookies`, `webRequest`, `notifications`, or any host permission for external sites.

## MCP data flow (only when you choose to use it)

If you wire up an AI tool (Claude Code, Cursor, Codex, …) through [`@bookmarkops/mcp`](https://www.npmjs.com/package/@bookmarkops/mcp):

1. The MCP server — a small Node process launched by your AI tool — opens a bridge on `localhost:7842`.
2. When the AI asks to scan or generate a report, BookmarkOps reads your local bookmark tree and returns bookmark titles, URLs, and folder paths.
3. That response is read by your AI tool. **What the AI tool then does with the data — including whether it sends it to a cloud LLM — is governed by your AI tool's own privacy policy, not by BookmarkOps.**
4. BookmarkOps itself has no API key, no cloud service, and no outbound HTTP call other than the local bridge.

In short: BookmarkOps hands data to your chosen AI tool over a local socket; what happens after that is between you and your AI vendor. The full threat model — including what BookmarkOps does and does not protect against — is documented in the [Security model section](https://github.com/brianjhang/bookmarkops/blob/main/src/agent/README.md#security-model) of the agent README.

## What we don't do

- No telemetry, no usage analytics, no crash reporting.
- No tracking pixel, fingerprint, or identifier of any kind.
- No outbound HTTP calls other than the local MCP bridge.
- No collection of email, name, or any account credentials.
- No "anonymized" data export. No data export at all.

## Your control

- **Uninstall removes all data.** Removing the extension from `chrome://extensions` deletes everything stored in `chrome.storage.local` — token, settings, backups, scan cache. There is nothing left behind on a remote server because nothing was ever sent there.
- **Inspect locally.** All BookmarkOps data is visible in Chrome DevTools → Application → Storage → Extensions → BookmarkOps → `chrome.storage`.
- **Rotate the token.** Dashboard → AI Agent Settings → Rotate generates a fresh token; the old one stops being accepted by new agent sessions once your AI tool's MCP server restarts.
- **Delete backups individually.** Each automatic pre-apply backup can be deleted from the Dashboard with an explicit `DELETE BACKUP` confirmation.

## Contact

- Email: me@brianjhang.com
- GitHub issues: [https://github.com/brianjhang/bookmarkops/issues](https://github.com/brianjhang/bookmarkops/issues) (link becomes live once the repository is set to Public).

## Changes to this policy

This policy is versioned alongside the source code in the BookmarkOps repository. Any material change — a new permission, a new data flow, a new third-party integration — will be reflected here and flagged in the main [`README.md`](../README.md). The `Last updated` line at the top of this document is the canonical timestamp.
