import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

const { default: pkg } = await import('../package.json', { with: { type: 'json' } })

export function createMcpServer(bridge, agentToken) {
  const server = new McpServer({ name: 'bookmarkops', version: pkg.version })

  function call(tool, params = {}) {
    return bridge.enqueue(tool, params, agentToken)
  }

  function text(data) {
    return { content: [{ type: 'text', text: typeof data === 'string' ? data : JSON.stringify(data, null, 2) }] }
  }

  server.tool(
    'scan_bookmarks',
    'Scan and analyze all Chrome bookmarks. Returns stats, usage categories (frequent/recent/stale/dormant), and AI-generated health insights.',
    {},
    async () => text(await call('scan_bookmarks'))
  )

  server.tool(
    'get_report',
    'Get a full bookmark report. Use format "markdown" for human-readable output, "json" for structured data.',
    { format: z.enum(['json', 'markdown']).optional().default('json').describe('Report format') },
    async ({ format }) => {
      const result = await call('get_report', { format })
      return text(result.body ?? result)
    }
  )

  server.tool(
    'submit_plan',
    [
      'Submit a bookmark-plan.json for validation, dry-run, and dashboard approval.',
      'The plan is validated and simulated immediately. Apply requires the user to approve in the BookmarkOps dashboard.',
      'Required plan fields: bookmarkopsVersion, summary, riskLevel (low|medium|high), createdBy, createdAt, operations.',
    ].join(' '),
    { plan: z.record(z.unknown()).describe('Full bookmark-plan.json object') },
    async ({ plan }) => text(await call('submit_plan', { plan }))
  )

  server.tool(
    'get_status',
    'Get current BookmarkOps status: pending dashboard approvals, last scan summary.',
    {},
    async () => text(await call('get_status'))
  )

  server.tool(
    'list_backups',
    'List available bookmark backups created by BookmarkOps.',
    {},
    async () => text(await call('list_backups'))
  )

  return server
}
