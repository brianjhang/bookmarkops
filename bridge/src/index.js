#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createHttpBridge, createHttpClientBridge } from './http-bridge.js'
import { createMcpServer } from './mcp-tools.js'

const { default: pkg } = await import('../package.json', { with: { type: 'json' } })
const VERSION = pkg.version
const PORT = Number(process.env.BOOKMARKOPS_PORT || 7842)
const TOKEN = process.env.BOOKMARKOPS_TOKEN || ''

if (!TOKEN) {
  process.stderr.write(
    'BookmarkOps MCP: BOOKMARKOPS_TOKEN is required.\n' +
    'Copy your agent token from the BookmarkOps dashboard and set:\n' +
    '  BOOKMARKOPS_TOKEN=<your-token>\n\n'
  )
  process.exit(1)
}

// Try to start the HTTP bridge server. If port is taken, use HTTP client mode instead.
const bridge = await new Promise((resolve) => {
  const candidate = createHttpBridge(PORT, TOKEN)

  candidate.server.once('listening', () => {
    process.stderr.write(`BookmarkOps MCP v${VERSION}: bridge listening on port ${PORT}, connecting stdio transport...\n`)
    resolve(candidate)
  })

  candidate.server.once('eaddrinuse', () => {
    process.stderr.write(`BookmarkOps MCP v${VERSION}: port ${PORT} in use — attaching as secondary client...\n`)
    resolve(createHttpClientBridge(PORT))
  })
})

const mcpServer = createMcpServer(bridge, TOKEN)
const transport = new StdioServerTransport()

try {
  await mcpServer.connect(transport)
  process.stderr.write('BookmarkOps MCP: stdio transport connected, tools ready.\n')
} catch (err) {
  process.stderr.write(`BookmarkOps MCP: stdio transport failed: ${err.message}\n`)
  bridge.close()
  process.exit(1)
}
