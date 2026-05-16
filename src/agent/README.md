# BookmarkOps Agent Operator Mode

BookmarkOps lets any AI agent scan, analyze, and propose changes to your Chrome bookmarks — while keeping all destructive actions under your explicit control via the dashboard.

---

## What agents can do

| Action | Agent | Notes |
|--------|-------|-------|
| Scan bookmarks | ✅ | Read-only, no changes |
| Get report (JSON/Markdown) | ✅ | Local only, not uploaded |
| Submit a plan | ✅ | Validates + dry-runs immediately |
| Request Apply / Restore | ✅ | Queued — needs dashboard approval |
| Apply directly | ❌ | Dashboard-only |
| Restore backup directly | ❌ | Dashboard-only |
| Delete backup directly | ❌ | Dashboard-only |

---

## Setup: MCP Server (Codex / Claude Code / Cursor)

### 1. Copy your agent token

Open BookmarkOps dashboard → **AI Agent Settings** → **Quick Setup** — the JSON config is already filled in with your token. Click **Copy Config** and paste it into your AI tool.

### 2. Configure your AI tool manually (optional)

**Codex CLI** (`~/.codex/config.toml`):
```toml
[mcp_servers.bookmarkops]
command = "npx"
args = ["-y", "@bookmarkops/mcp"]

[mcp_servers.bookmarkops.env]
BOOKMARKOPS_TOKEN = "your-token-here"
```

**Claude Code** (`~/.claude.json`):
```json
{
  "mcpServers": {
    "bookmarkops": {
      "command": "npx",
      "args": ["-y", "@bookmarkops/mcp"],
      "env": {
        "BOOKMARKOPS_TOKEN": "your-token-here"
      }
    }
  }
}
```

**Cursor** (`.cursor/mcp.json`):
```json
{
  "mcpServers": {
    "bookmarkops": {
      "command": "npx",
      "args": ["-y", "@bookmarkops/mcp"],
      "env": {
        "BOOKMARKOPS_TOKEN": "your-token-here"
      }
    }
  }
}
```

No local installation required — `npx` downloads the bridge on first run.

### 3. Keep Chrome open with BookmarkOps

The MCP bridge communicates with the extension via HTTP polling at `localhost:7842`. Chrome must be open and BookmarkOps installed. Response time is ~2 seconds when the dashboard is open.

---

## Available MCP tools

```
scan_bookmarks()
  Scan all Chrome bookmarks. Returns stats and usage categories.

get_report(format: "json" | "markdown")
  Get a full bookmark report. Use "markdown" for human-readable output.

submit_plan(plan: object)
  Submit a bookmark-plan.json. Validates and dry-runs immediately.
  Apply requires user approval in the dashboard.

get_status()
  Current status: pending approvals, last scan summary.

list_backups()
  List available bookmark backups.
```

---

## Example agent workflow

```
You: "Scan my bookmarks and suggest a cleanup plan."

Agent calls: scan_bookmarks()
Agent calls: get_report("markdown")
Agent analyzes the report and creates bookmark-plan.json
Agent calls: submit_plan({ ...plan })

→ BookmarkOps validates the plan and queues it for your approval.
→ You open the dashboard, review every proposed change, and approve or reject.
```

---

## Token management

- Token is stored locally in `chrome.storage.local`, never sent to any server.
- Rotate your token in the dashboard (AI Agent Settings → **Rotate**) if you suspect it is compromised.
- After rotating, the **Quick Setup** block auto-updates — copy and paste again.
- Tokens do not expire automatically — rotate manually when needed.

---

## Security model

BookmarkOps is designed to protect bookmarks from accidental damage and to limit what a local AI agent can do without explicit user consent. It is not designed to defend a fully compromised machine.

### Threat model

We focus on the **local exposure surface**: limiting which local processes can talk to the bridge, observe tokens in flight, or trigger destructive actions. We do **not** try to revoke access after the machine itself is compromised — once an attacker has user-level shell access, the bookmarks and the stored token are already reachable directly through Chrome's profile files.

### What is protected

- **Bridge binds to `127.0.0.1` only.** `localhost:7842` is not reachable from other machines.
- **MCP server requires `BOOKMARKOPS_TOKEN`** in its environment. Starting without one fails immediately.
- **`/enqueue` validates the token.** Local processes posting to the bridge must include the configured token in the request body, or the bridge returns 401 before the request reaches the extension.
- **`/pending` never returns the token.** The extension polls for work without the bridge leaking the token in its response.
- **Dashboard origin enforced.** Privileged messages (apply, restore, delete backup, reveal) only accept callers whose URL is `chrome-extension://.../dashboard.html`.
- **Reveal requires a typed phrase.** Showing the token in plaintext in the dashboard requires typing `REVEAL`, mirroring the `APPLY` / `RESTORE` / `DELETE BACKUP` pattern.
- **Typed-phrase gate on destructive actions.** Apply, restore, and delete-backup each require an explicit typed phrase before the action runs, even when an agent has queued the request.

### What is not protected

- **A compromised machine.** An attacker with user-level access can read bookmarks from the Chrome profile files and the token from `chrome.storage.local` directly. No in-extension control prevents that.
- **In-flight request hijack on `/pending`.** A local process racing the extension can steal an individual queued request before the extension picks it up. The stolen request cannot mutate bookmarks (the extension is the only path to `chrome.bookmarks`), but the tool name and parameters are visible.
- **Stale MCP servers after rotation.** Rotating the dashboard token does not revoke a running MCP server that still holds the old token in its environment.

### Token rotation

Rotating in the dashboard generates a new token and updates the Quick Setup block. **The running MCP server still holds the old token in its environment, and the extension treats it as valid until the server restarts.** To complete a rotation:

1. Rotate the token in the dashboard.
2. Copy the new Quick Setup config.
3. Restart your AI tool (Claude Code / Cursor / Codex) so the MCP server picks up the new token.

This is a deliberate trade-off: by not leaking the token over `/pending`, the extension no longer verifies each request's token against live storage. Rotation is still useful for new sessions; it is not an immediate revocation.

### Recommendations

- Rotate your token periodically and **always restart your AI tool** afterwards.
- Run BookmarkOps only on machines and Chrome profiles you trust.
- Verify the source you install from — BookmarkOps is open source, and the code in the GitHub repository can be reviewed and built locally.
