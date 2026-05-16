import { createServer } from 'node:http'

const REQUEST_TIMEOUT_MS = 120_000

/**
 * HTTP server at localhost:PORT that acts as a queue between the MCP server
 * (AI tool side) and the BookmarkOps Chrome Extension (bookmark side).
 *
 * GET  /pending        → Extension polls for the next request to execute
 * POST /result/:id     → Extension posts the execution result
 * POST /enqueue        → Secondary MCP clients submit tool requests (token required)
 * GET  /wait/:id       → Secondary MCP clients poll for their result
 * GET  /health         → Liveness check
 *
 * `expectedToken` gates POST /enqueue: requests must carry a matching
 * `agentToken` in the JSON body, otherwise the bridge returns 401 before
 * the request reaches the extension. In-process `bridge.enqueue()` calls
 * skip this check because they originate from the same Node process that
 * owns the token.
 */
export function createHttpBridge(port = 7842, expectedToken = '') {
  const pending = new Map() // id → { id, status, request, resolve, reject, timer }
  const results = new Map() // id → result (for HTTP-client polling via /wait/:id)
  let seq = 1

  const server = createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`)

    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
      res.writeHead(204)
      res.end()
      return
    }

    if (url.pathname === '/health') {
      res.setHeader('Access-Control-Allow-Origin', '*')
    }

    if (req.method === 'GET' && url.pathname === '/health') {
      json(res, 200, { ok: true })
      return
    }

    // Chrome extension: poll for next pending request.
    // The agentToken is intentionally stripped here — it was already validated
    // at /enqueue (B1) or supplied by the same-process MCP server. Leaking it
    // back over /pending would let any local process that races the extension
    // harvest the token.
    if (req.method === 'GET' && url.pathname === '/pending') {
      const entry = [...pending.values()].find(e => e.status === 'pending')
      if (!entry) { json(res, 200, null); return }
      entry.status = 'processing'
      const { agentToken: _omit, ...safeRequest } = entry.request || {}
      json(res, 200, { id: entry.id, ...safeRequest })
      return
    }

    // Chrome extension: post result for a completed request
    if (req.method === 'POST' && url.pathname.startsWith('/result/')) {
      const id = url.pathname.slice('/result/'.length)
      let body = ''
      req.on('data', chunk => { body += chunk })
      req.on('end', () => {
        const entry = pending.get(id)
        if (entry) {
          clearTimeout(entry.timer)
          pending.delete(id)
          let result
          try { result = JSON.parse(body) } catch { result = { ok: false, error: 'Invalid JSON from extension' } }
          if (entry.resolve) {
            // In-process client: resolve the Promise directly
            if (result.ok) entry.resolve(result.data)
            else entry.reject(new Error(result.error || 'Extension returned error'))
          } else {
            // HTTP client: store result for polling via /wait/:id
            results.set(id, result)
          }
        }
        res.writeHead(200)
        res.end()
      })
      return
    }

    // Secondary MCP client: submit a tool request
    if (req.method === 'POST' && url.pathname === '/enqueue') {
      let body = ''
      req.on('data', chunk => { body += chunk })
      req.on('end', () => {
        let request
        try { request = JSON.parse(body) } catch { json(res, 400, { error: 'Invalid JSON' }); return }
        // Bridge-level token check (defense in depth; extension also validates).
        // Reject early so unauthorized local processes never enter the queue.
        if (!expectedToken) {
          json(res, 503, { error: 'Bridge not configured with an agent token; /enqueue is disabled.' })
          return
        }
        if (!request || typeof request.agentToken !== 'string' || request.agentToken !== expectedToken) {
          json(res, 401, { error: 'Invalid or missing agent token.' })
          return
        }
        const id = String(seq++)
        const timer = setTimeout(() => {
          if (pending.has(id)) {
            pending.delete(id)
            results.set(id, { ok: false, error: 'Timed out waiting for BookmarkOps extension. Is Chrome open with the extension installed?' })
          }
        }, REQUEST_TIMEOUT_MS)
        pending.set(id, { id, status: 'pending', request, resolve: null, reject: null, timer })
        json(res, 200, { id })
      })
      return
    }

    // Secondary MCP client: poll for result
    if (req.method === 'GET' && url.pathname.startsWith('/wait/')) {
      const id = url.pathname.slice('/wait/'.length)
      const result = results.get(id)
      if (result) {
        results.delete(id)
        json(res, 200, result)
      } else if (pending.has(id)) {
        json(res, 200, null) // still processing, client should retry
      } else {
        json(res, 404, { error: 'Not found' })
      }
      return
    }

    res.writeHead(404)
    res.end()
  })

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      // Handled by caller — do not crash here
      server.emit('eaddrinuse')
    } else {
      throw err
    }
  })

  server.listen(port, '127.0.0.1')

  return {
    server,
    enqueue(tool, params, agentToken) {
      return new Promise((resolve, reject) => {
        const id = String(seq++)
        const timer = setTimeout(() => {
          if (pending.has(id)) {
            pending.delete(id)
            reject(new Error(
              'Timed out waiting for BookmarkOps extension. Is Chrome open with the extension installed?'
            ))
          }
        }, REQUEST_TIMEOUT_MS)

        pending.set(id, {
          id,
          status: 'pending',
          request: { tool, params, agentToken },
          resolve,
          reject,
          timer,
        })
      })
    },
    close() {
      server.close()
    },
  }
}

/**
 * HTTP client bridge — used when port is already occupied by another instance.
 * Submits requests via POST /enqueue and polls for results via GET /wait/:id.
 */
export function createHttpClientBridge(port = 7842) {
  const base = `http://127.0.0.1:${port}`

  return {
    async enqueue(tool, params, agentToken) {
      const enqRes = await fetch(`${base}/enqueue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool, params, agentToken }),
        signal: AbortSignal.timeout(10_000),
      })
      const { id } = await enqRes.json()

      const deadline = Date.now() + REQUEST_TIMEOUT_MS
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 500))
        const pollRes = await fetch(`${base}/wait/${id}`, { signal: AbortSignal.timeout(5_000) })
        if (pollRes.status === 404) throw new Error('Request not found in bridge queue.')
        const data = await pollRes.json()
        if (data !== null) {
          if (data.ok) return data.data
          throw new Error(data.error || 'Extension returned error')
        }
      }
      throw new Error('Timed out waiting for BookmarkOps extension.')
    },
    close() {},
  }
}

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}
