# BookmarkOps — Privacy Policy

**Effective date:** 2026-05-20
**Developer:** Brian Jhang

BookmarkOps is a Chrome extension that helps you review and safely clean up
your bookmarks, with an optional AI-assisted review step. **BookmarkOps does
not collect, transmit, or sell your data. It contains no analytics and no
telemetry, and it makes no remote network requests** — the only network
requests it ever performs are to a loopback (localhost / 127.0.0.1) address
on your own machine, described under "Network behavior" below. Everything
BookmarkOps does happens locally on your device.

## What BookmarkOps accesses, and why

- **Bookmarks** (`bookmarks` permission): BookmarkOps reads your Chrome
  bookmarks to analyze them — detecting duplicates, dead links, and
  disorganization, and reading the metadata Chrome exposes for each bookmark
  (such as date added and date last used) to classify usage — and to apply
  cleanup changes that **you review and approve first**. This is the
  extension's core function. Bookmark data is processed locally and is not
  sent to the developer or any third party.
- **Local storage** (`storage` permission): BookmarkOps stores its own data
  on your device only, via `chrome.storage.local`. This includes: your
  settings and UI preferences; the session token used to authenticate the
  connection to your optional local AI bridge; cached scan results and
  health scores; review plans and approval requests submitted by your AI
  tool that are pending your review; and the safety backups/snapshots used
  by the review-and-restore workflow. None of this leaves your device.
- **Alarms** (`alarms` permission): BookmarkOps schedules a periodic local
  check (about once per minute) that polls your optional local AI bridge for
  any review tasks your AI tool may have submitted. This check is sent only
  to a loopback (localhost) address on your own machine. It runs from the
  moment the extension is installed, whether or not you have set up an AI
  tool; if no bridge is running, the request fails silently and nothing is
  sent or received.

## Network behavior

BookmarkOps makes **no remote network requests**. It declares exactly one
host permission, `http://localhost:7842/*`, which is a **loopback
(localhost / 127.0.0.1) address on your own machine**. Chrome blocks any
request to any other host.

This local channel runs **whenever BookmarkOps is installed** — the
extension periodically polls a loopback address on your own machine to check
whether you have started a local AI bridge. This happens about once per
minute, when you open the popup or the dashboard, and — if you turn on the
optional bridge status monitor in the dashboard — every few seconds while
that monitor is enabled. **These requests never leave your device.** No
bookmark data is sent or received unless you have set up an AI tool and it
has actually submitted a review task; if no bridge is running, the requests
fail silently.

The bridge at `localhost:7842` is a separate program that **you** start on
your own machine (via `npx @bookmarkops/mcp`) when you want to use an AI
command-line tool (such as Claude Code, Cursor, or Codex) to assist with
bookmark review. Regardless of whether a bridge is running, the extension
may perform these local-only requests:

- a health check (`GET /health` — empty request),
- a poll for review tasks your AI tool submitted (`GET /pending`),
- returning task results to the local bridge (`POST /result/...`).

When the extension picks up a request from your AI tool, the response sent
back to the local bridge can include the data the AI tool asked to read or
submit — for example, a full scan result (bookmark titles, URLs, folder
paths, date-added / date-last-used timestamps, and usage classifications),
a generated report, the review plan your AI tool submitted for your
approval, current status, or backup metadata.

**This data goes only to the local bridge on your own machine. Neither
BookmarkOps nor the bridge forwards it to any cloud service.** If bookmark
information ever reaches a cloud AI model, that happens solely because the
separate AI command-line tool *you* installed and configured — under *your*
own account and API key — sends it. That data flow is between you and your
chosen AI provider, governed by that provider's policies, and is outside
BookmarkOps's control and not handled by BookmarkOps.

## Clipboard

Several BookmarkOps buttons copy content to your system clipboard **when you
click them**. Depending on the button, that content may be:

- **Bookmark context** — the titles and URLs of the bookmarks you are about
  to discuss with an AI tool (for example, the "Copy for AI" and "Launch
  with AI" buttons).
- **The local AI bridge session token** — for example, the "Copy" button
  next to the token in agent settings, or the MCP setup/configuration
  helpers, so you can paste the token or configuration into your AI tool's
  setup. This token is a sensitive credential; treat it like a password.
- **Prompt templates** — fixed helper text that contains no bookmark data
  and no credentials.

"Launch with AI" additionally opens the chosen AI website (claude.ai,
chatgpt.com, or gemini.google.com) in a new browser tab. The URL itself
contains no data — context only moves into the AI tool if and when **you**
paste it.

In every case this is triggered by you pressing a button and is equivalent
to copying the same content manually. Clipboard contents are managed by your
operating system, not by BookmarkOps, and are not persisted by BookmarkOps.

## No tracking, no analytics, no data collection

BookmarkOps contains no analytics or telemetry of any kind. It does not
collect usage data, does not phone home, and sends nothing to the developer
or any third party.

## Data retention and deletion

BookmarkOps stores all of its own persistent data inside your browser's
local storage (`chrome.storage.local`), which is removed when you uninstall
the extension. As described under "Clipboard" above, when you click the
copy/launch buttons or the setup helpers, the relevant content (and, where
applicable, the bridge session token) is written to your system clipboard —
this is the same as any copy-paste operation and is governed by your
operating system, not by BookmarkOps. Your Chrome bookmarks themselves are
never modified except by changes you explicitly approve, and remain intact
if you remove BookmarkOps.

## Limited Use disclosure

BookmarkOps's use of data accessed through Chrome APIs complies with the
[Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq),
including the Limited Use requirements. Specifically:

- BookmarkOps uses bookmark data **only** to provide its user-facing
  bookmark review and cleanup features.
- BookmarkOps does **not** transfer this data to others, except as carried
  to a local bridge on the user's own machine when the user's own AI tool
  submits a request, or to the user's own system clipboard when the user
  clicks a copy/launch button, as described above.
- BookmarkOps does **not** use or transfer this data for serving
  advertising.
- BookmarkOps does **not** use or transfer this data to determine
  creditworthiness or for lending purposes.
- BookmarkOps does **not** sell this data.
- No humans read this data; it is not transmitted to the developer.

## Changes

If this policy changes, the updated version will be posted at
<https://github.com/brianjhang/bookmarkops/blob/main/PRIVACY-POLICY.md> with
a new effective date.

## Contact

Questions about this policy: brianjhang.ai@gmail.com
