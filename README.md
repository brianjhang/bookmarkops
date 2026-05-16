# BookmarkOps

**English** · [繁體中文](./README.zh-TW.md) · [简体中文](./README.zh-CN.md)

**AI-assisted bookmark cleanup MCP tool for Chrome.** Scan, plan, and clean up your Chrome bookmarks through any MCP-capable AI agent — Codex, Claude Code, Cursor — with destructive actions gated by your explicit dashboard approval.

> **Version:** v0.1 · **MCP server:** [`@bookmarkops/mcp`](https://www.npmjs.com/package/@bookmarkops/mcp) v0.1.3 on npm · **Chrome Web Store:** submission in progress.

---

## Core promises

- **Open source under MIT** — every line of code is auditable. See [`LICENSE`](./LICENSE).
- **Runs entirely on your machine** — bookmark data never leaves your browser. The only network traffic is the MCP bridge on `localhost:7842`, which never binds to a public interface.
- **No telemetry, no analytics** — BookmarkOps does not collect or transmit any usage data.
- **Build it yourself** — `npm install && npm run build` produces the exact extension you load into Chrome.

---

## How it works

```text
scan → report → plan → dryRun → preview → backup → apply → verify → restore
```

The workflow splits between three pieces:

1. **The Chrome extension** — the only thing that talks to `chrome.bookmarks`. Scans, applies, restores, and renders the dashboard.
2. **The MCP server** ([`@bookmarkops/mcp`](https://www.npmjs.com/package/@bookmarkops/mcp)) — a small Node bridge launched by your AI tool over `npx`. Lets the AI propose cleanup plans without ever holding bookmark mutation authority.
3. **You** — every destructive action (apply / restore / delete backup) requires typing a confirmation phrase (`APPLY` / `RESTORE` / `DELETE BACKUP`) in the dashboard.

---

## Quick start

### 1. Install the Chrome extension

Until the Chrome Web Store listing is live, load it as an unpacked extension:

```bash
npm install
npm run build
```

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the `dist/` folder.

### 2. Wire up your AI tool

Open the BookmarkOps dashboard → **AI Agent Settings** → **Quick Setup**. Copy the JSON config and paste it into your AI tool.

**Codex** (`~/.codex/config.toml`):
```toml
[mcp_servers.bookmarkops]
command = "npx"
args = ["-y", "@bookmarkops/mcp"]

[mcp_servers.bookmarkops.env]
BOOKMARKOPS_TOKEN = "<your-token>"
```

**Claude Code** (`~/.claude.json`):
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

**Cursor** (`.cursor/mcp.json`): same shape — copy from Quick Setup.

No local install of the bridge is required — `npx -y @bookmarkops/mcp` downloads it on first run. The bridge requires `BOOKMARKOPS_TOKEN` in its environment and refuses to start without it.

Full setup walkthrough, available MCP tools, and the threat model are in [`src/agent/README.md`](./src/agent/README.md).

### 3. Talk to your AI

> "Scan my bookmarks and suggest a cleanup plan."

The agent calls `scan_bookmarks` and `get_report`, drafts a `bookmark-plan.json`, and queues it for your approval. Open the dashboard, review every operation, then type `APPLY` to execute.

---

## Development

```bash
npm install
npm run dev                     # Vite dev server
npm run build                   # Production build → dist/
npm run test:task1              # Smoke test: scanner + report-generator (pure Node)
npm run test:workflow           # Smoke test: full plan workflow
npm run test:isolated-runtime   # Playwright extension runtime test (build dist/ first)
npm run validate                # Full validation suite (smoke tests + build)
```

For real Chrome testing, load the freshly built `dist/` as an unpacked extension. The isolated runtime test uses a temporary Chrome profile and never touches your real bookmarks.

---

## Permissions and safety boundary

- The manifest requests only `bookmarks`, `storage`, and `alarms`. No `history`, no external host permissions — only `http://localhost:7842/*` for the local MCP bridge.
- Agent Operator Mode can prepare scan / report / plan / dryRun work, but Apply, Restore, and Delete backup all require a typed confirmation phrase from you in the dashboard.
- The MCP bridge binds to `127.0.0.1:7842` only and validates a per-session token on every `/enqueue` call.

Full threat model: [`src/agent/README.md` → Security model](./src/agent/README.md#security-model).

---

## Contact

- Email: [me@brianjhang.com](mailto:me@brianjhang.com)
- Issues & feature requests: [github.com/brianjhang/bookmarkops/issues](https://github.com/brianjhang/bookmarkops/issues)
- Personal site: [brianjhang.com](https://brianjhang.com/)

I'm building BookmarkOps as a real tool I want to use. Bug reports, weird-bookmark-tree stories, and "have you considered X" emails are all welcome.

---

## License

Licensed under MIT — see [`LICENSE`](./LICENSE). Copyright © 2026 Brian Jhang.

---

## References

- MCP integration & threat model — [`src/agent/README.md`](./src/agent/README.md)
- Traditional Chinese quickstart — [`docs/zh-TW/getting-started.zh-TW.md`](./docs/zh-TW/getting-started.zh-TW.md)
