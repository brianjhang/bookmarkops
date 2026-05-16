import { applyBookmarkPlan, assertDashboardApproval } from './core/apply-engine.js'
import { deleteBackup, getBackupById, listBackups, restoreBackup } from './core/backup-manager.js'
import { getBookmarkTree, storageGet, storageSet } from './core/chrome-api.js'
import { dryRunBookmarkPlan } from './core/dry-runner.js'
import { createReportFile } from './core/report-generator.js'
import { getAgentConfig, maskAgentConfig, requireAgentEnabled, requireAgentSession, rotateAgentToken, setAgentConfig } from './core/agent-operator.js'
import { scanBookmarks } from './core/scanner.js'
import { validateBookmarkPlan } from './core/plan-validator.js'

const MESSAGE_SOURCE = 'bookmarkops'
const PENDING_AGENT_PLAN_KEY = 'bookmarkops.pendingAgentPlan'
const PENDING_AGENT_APPROVAL_KEY = 'bookmarkops.pendingAgentApproval'
const LAST_SCAN_STATS_KEY = 'bookmarkops.lastScanStats'
const MCP_BRIDGE_URL = 'http://localhost:7842'
const MESSAGE_TYPES = {
  scan: 'bookmarkops.scan',
  report: 'bookmarkops.report',
  openDashboard: 'bookmarkops.dashboard.open',
  validatePlan: 'bookmarkops.plan.validate',
  dryRunPlan: 'bookmarkops.plan.dryRun',
  applyPlan: 'bookmarkops.plan.apply',
  listBackups: 'bookmarkops.backups.list',
  restoreBackup: 'bookmarkops.backup.restore',
  deleteBackup: 'bookmarkops.backup.delete',
  agentConfigGet: 'bookmarkops.agent.config.get',
  agentConfigReveal: 'bookmarkops.agent.config.reveal',
  agentConfigRotate: 'bookmarkops.agent.config.rotate',
  agentConfigSet: 'bookmarkops.agent.config.set',
  agentPendingPlanGet: 'bookmarkops.agent.pendingPlan.get',
  agentPendingApprovalGet: 'bookmarkops.agent.pendingApproval.get',
  agentPendingApprovalApprove: 'bookmarkops.agent.pendingApproval.approve',
  agentPendingApprovalReject: 'bookmarkops.agent.pendingApproval.reject',
  agentScan: 'bookmarkops.agent.scan',
  agentReport: 'bookmarkops.agent.report',
  agentSubmitPlan: 'bookmarkops.agent.submitPlan',
  agentDryRun: 'bookmarkops.agent.dryRun',
  agentApply: 'bookmarkops.agent.apply',
  agentRestore: 'bookmarkops.agent.restore',
  agentDeleteBackup: 'bookmarkops.agent.deleteBackup',
  mcpBridgePoll: 'bookmarkops.mcp.bridgePoll',
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!isBookmarkOpsMessage(message)) return false

  handleMessage(message, sender)
    .then((data) => sendResponse({ ok: true, data }))
    .catch((error) => {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown BookmarkOps error.',
      })
    })

  return true
})

const DASHBOARD_HANDLERS = {
  [MESSAGE_TYPES.scan]: () => scanAndCache(),
  [MESSAGE_TYPES.report]: (msg) => createFreshReport(msg.format),
  [MESSAGE_TYPES.openDashboard]: async () => { await chrome.runtime.openOptionsPage(); return { opened: true } },
  [MESSAGE_TYPES.validatePlan]: async (msg) => {
    const tree = await getBookmarkTree(chrome.bookmarks)
    return validateBookmarkPlan(msg.plan, { bookmarkTree: tree })
  },
  [MESSAGE_TYPES.dryRunPlan]: async (msg) => {
    const tree = await getBookmarkTree(chrome.bookmarks)
    return dryRunBookmarkPlan(msg.plan, tree)
  },
  [MESSAGE_TYPES.applyPlan]: async (msg, sender) => {
    assertDashboardSender(sender)
    return applyBookmarkPlan({ plan: msg.plan, bookmarksApi: chrome.bookmarks, storageApi: chrome.storage.local, approval: msg.approval })
  },
  [MESSAGE_TYPES.listBackups]: () => listBackups({ storageApi: chrome.storage.local }),
  [MESSAGE_TYPES.restoreBackup]: async (msg, sender) => {
    assertDashboardSender(sender)
    assertDashboardApproval(msg.approval, 'RESTORE')
    const verify = await restoreBackup({ bookmarksApi: chrome.bookmarks, storageApi: chrome.storage.local, backupId: msg.backupId })
    const backup = await getBackupById({ storageApi: chrome.storage.local, backupId: msg.backupId })
    return { backup, verify }
  },
  [MESSAGE_TYPES.deleteBackup]: async (msg, sender) => {
    assertDashboardSender(sender)
    assertDashboardApproval(msg.approval, 'DELETE BACKUP')
    return deleteBackup({ storageApi: chrome.storage.local, backupId: msg.backupId })
  },
  [MESSAGE_TYPES.agentConfigGet]: async () => maskAgentConfig(await getAgentConfig(chrome.storage.local)),
  [MESSAGE_TYPES.agentConfigReveal]: async (msg, sender) => { assertDashboardSender(sender); return maskAgentConfig(await getAgentConfig(chrome.storage.local), { includeToken: true }) },
  [MESSAGE_TYPES.agentConfigRotate]: async (msg, sender) => { assertDashboardSender(sender); return rotateAgentToken(chrome.storage.local) },
  [MESSAGE_TYPES.agentConfigSet]: async (msg, sender) => { assertDashboardSender(sender); return setAgentConfig(chrome.storage.local, msg.config || {}) },
  [MESSAGE_TYPES.agentPendingPlanGet]: async () => {
    const result = await storageGet(chrome.storage.local, PENDING_AGENT_PLAN_KEY)
    return result?.[PENDING_AGENT_PLAN_KEY] || null
  },
  [MESSAGE_TYPES.agentPendingApprovalGet]: () => getPendingAgentApproval(),
  [MESSAGE_TYPES.agentPendingApprovalApprove]: async (msg, sender) => { assertDashboardSender(sender); return approvePendingAgentApproval(msg.approval) },
  [MESSAGE_TYPES.agentPendingApprovalReject]: async (msg, sender) => { assertDashboardSender(sender); return rejectPendingAgentApproval() },
  [MESSAGE_TYPES.mcpBridgePoll]: () => pollMcpBridge(),
}

const AGENT_HANDLERS = {
  [MESSAGE_TYPES.agentScan]: () => scanAndCache(),
  [MESSAGE_TYPES.agentReport]: (msg) => createFreshReport(msg.format || 'json'),
  [MESSAGE_TYPES.agentSubmitPlan]: async (msg) => {
    const tree = await getBookmarkTree(chrome.bookmarks)
    const validation = validateBookmarkPlan(msg.plan, { bookmarkTree: tree })
    const dryRun = validation.ok ? dryRunBookmarkPlan(msg.plan, tree) : null
    const pendingPlan = { submittedAt: new Date().toISOString(), plan: msg.plan, validation, dryRun }
    await storageSet(chrome.storage.local, { [PENDING_AGENT_PLAN_KEY]: pendingPlan })
    return pendingPlan
  },
  [MESSAGE_TYPES.agentDryRun]: async (msg) => {
    const tree = await getBookmarkTree(chrome.bookmarks)
    return dryRunBookmarkPlan(msg.plan, tree)
  },
  [MESSAGE_TYPES.agentApply]: (msg) => queueAgentApplyRequest(msg.plan),
  [MESSAGE_TYPES.agentRestore]: (msg) => queueAgentBackupRequest('restoreBackup', msg.backupId),
  [MESSAGE_TYPES.agentDeleteBackup]: (msg) => queueAgentBackupRequest('deleteBackup', msg.backupId),
}

async function handleMessage(message, sender) {
  const handler = DASHBOARD_HANDLERS[message.type]
  if (handler) return handler(message, sender)
  if (isAgentMessage(message)) return handleAgentMessage(message)
  throw new Error(`Unsupported BookmarkOps message: ${message.type}`)
}

async function handleAgentMessage(message) {
  try {
    await requireAgentSession(chrome.storage.local, message.agentToken)
  } catch {
    throw new Error('Agent token invalid. Rotate in Dashboard → Agent Settings.')
  }
  const handler = AGENT_HANDLERS[message.type]
  if (handler) return handler(message)
  throw new Error(`Unsupported agent message: ${message.type}`)
}

async function queueAgentApplyRequest(plan) {
  if (!plan || typeof plan !== 'object') {
    throw new Error('Agent apply request requires a bookmark plan.')
  }

  const tree = await getBookmarkTree(chrome.bookmarks)
  const validation = validateBookmarkPlan(plan, { bookmarkTree: tree })
  const dryRun = validation.ok ? dryRunBookmarkPlan(plan, tree) : null
  const request = {
    id: createRequestId('agent-apply'),
    type: 'applyPlan',
    status: 'pending',
    requestedAt: new Date().toISOString(),
    requiredPhrase: 'APPLY',
    plan,
    validation,
    dryRun,
    summary: {
      riskLevel: plan.riskLevel || 'unknown',
      operationCount: Array.isArray(plan.operations) ? plan.operations.length : 0,
      validationOk: validation.ok,
      dryRunOk: Boolean(dryRun?.ok),
    },
  }

  await setPendingAgentApproval(request)
  return request
}

async function queueAgentBackupRequest(type, backupId) {
  if (!backupId) throw new Error('backupId is required.')

  const backup = await getBackupById({
    storageApi: chrome.storage.local,
    backupId,
  })
  if (!backup) {
    throw new Error(`Backup not found: ${backupId}`)
  }

  const request = {
    id: createRequestId(`agent-${type}`),
    type,
    status: 'pending',
    requestedAt: new Date().toISOString(),
    requiredPhrase: type === 'restoreBackup' ? 'RESTORE' : 'DELETE BACKUP',
    backupId,
    backup: summarizeBackup(backup),
  }

  await setPendingAgentApproval(request)
  return request
}

async function approvePendingAgentApproval(approval) {
  const request = await getPendingAgentApproval()
  if (!request || request.status !== 'pending') {
    throw new Error('No pending agent request requires approval.')
  }

  assertDashboardApproval(approval, request.requiredPhrase)

  let result
  if (request.type === 'applyPlan') {
    if (!request.validation?.ok || !request.dryRun?.ok) {
      throw new Error('Pending agent plan is not valid for apply.')
    }

    const excluded = new Set(approval.excludedIndices || [])
    const planToApply = excluded.size > 0
      ? { ...request.plan, operations: request.plan.operations.filter((_, i) => !excluded.has(i)) }
      : request.plan
    result = await applyBookmarkPlan({
      plan: planToApply,
      bookmarksApi: chrome.bookmarks,
      storageApi: chrome.storage.local,
      approval,
    })
  } else if (request.type === 'restoreBackup') {
    const verify = await restoreBackup({
      bookmarksApi: chrome.bookmarks,
      storageApi: chrome.storage.local,
      backupId: request.backupId,
    })
    const backup = await getBackupById({
      storageApi: chrome.storage.local,
      backupId: request.backupId,
    })
    result = {
      backup,
      verify,
    }
  } else if (request.type === 'deleteBackup') {
    result = await deleteBackup({
      storageApi: chrome.storage.local,
      backupId: request.backupId,
    })
  } else {
    throw new Error(`Unsupported pending agent request: ${request.type}`)
  }

  const completedRequest = {
    ...request,
    status: 'completed',
    completedAt: new Date().toISOString(),
    result: summarizeApprovalResult(request.type, result),
  }
  await setPendingAgentApproval(completedRequest)

  return {
    request: completedRequest,
    result,
  }
}

async function rejectPendingAgentApproval() {
  const request = await getPendingAgentApproval()
  if (!request || request.status !== 'pending') {
    throw new Error('No pending agent request can be rejected.')
  }

  const rejectedRequest = {
    ...request,
    status: 'rejected',
    rejectedAt: new Date().toISOString(),
  }
  await setPendingAgentApproval(rejectedRequest)
  return rejectedRequest
}

async function getPendingAgentApproval() {
  const result = await storageGet(chrome.storage.local, PENDING_AGENT_APPROVAL_KEY)
  return result?.[PENDING_AGENT_APPROVAL_KEY] || null
}

async function setPendingAgentApproval(request) {
  await storageSet(chrome.storage.local, { [PENDING_AGENT_APPROVAL_KEY]: request })
}

async function createFreshReport(format) {
  const scanResult = await scanBookmarks()
  const reportFile = createReportFile(scanResult, format)

  return {
    ...reportFile,
    generatedAt: scanResult.generatedAt,
    stats: scanResult.stats,
  }
}

function summarizeBackup(backup) {
  return {
    id: backup.id,
    createdAt: backup.createdAt,
    reason: backup.reason,
    stats: backup.stats,
    metadata: backup.metadata || null,
  }
}

function summarizeApprovalResult(type, result) {
  if (type === 'applyPlan') {
    return {
      ok: result.ok,
      backupId: result.backup?.id || null,
      appliedCount: Array.isArray(result.applied) ? result.applied.length : 0,
      failedCount: result.verify?.failed?.length || 0,
    }
  }

  if (type === 'restoreBackup') {
    return {
      ok: result.verify?.ok,
      backupId: result.backup?.id || null,
      failedCount: result.verify?.failed?.length || 0,
      unexpectedCount: result.verify?.unexpected?.length || 0,
    }
  }

  if (type === 'deleteBackup') {
    return {
      deleted: result.deleted,
      backupId: result.backupId,
    }
  }

  return null
}

function createRequestId(prefix) {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}`
}

function isAgentMessage(message) {
  return String(message.type || '').startsWith('bookmarkops.agent.')
}

function isBookmarkOpsMessage(message) {
  return (
    message
    && message.source === MESSAGE_SOURCE
    && typeof message.type === 'string'
  )
}

function assertDashboardSender(sender) {
  const senderUrl = sender?.url || ''
  try {
    const url = new URL(senderUrl)
    if (url.protocol === 'chrome-extension:' && url.pathname.endsWith('/dashboard.html')) {
      return
    }
  } catch {
    // Fall through to the consistent error below.
  }

  throw new Error('Dashboard context is required for privileged BookmarkOps actions.')
}

async function scanAndCache() {
  const result = await scanBookmarks()
  await storageSet(chrome.storage.local, {
    [LAST_SCAN_STATS_KEY]: { stats: result.stats, scannedAt: result.generatedAt },
  })
  return result
}

// MCP Bridge — polls localhost:7842 for pending AI agent requests
chrome.alarms.create('bookmarkops.mcpPoll', { periodInMinutes: 1 })
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'bookmarkops.mcpPoll') pollMcpBridge()
})

async function pollMcpBridge() {
  let response
  try {
    response = await fetch(`${MCP_BRIDGE_URL}/pending`)
    if (!response.ok) return
  } catch {
    return // bridge not running, that's fine
  }

  const request = await response.json()
  if (!request?.id) return

  const { id, tool, params } = request
  let result

  try {
    // /pending no longer carries agentToken (B2). The bridge has already
    // validated the requester's token at /enqueue, so we only confirm here
    // that agent mode is enabled and a token is configured in storage.
    await requireAgentEnabled(chrome.storage.local)
    result = { ok: true, data: await executeMcpTool(tool, params) }
  } catch (error) {
    result = { ok: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }

  try {
    await fetch(`${MCP_BRIDGE_URL}/result/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result),
    })
  } catch {
    // bridge went away before we could respond
  }
}

async function executeMcpTool(tool, params = {}) {
  switch (tool) {
    case 'scan_bookmarks':
      return scanAndCache()
    case 'get_report':
      return createFreshReport(params.format || 'json')
    case 'submit_plan':
      return AGENT_HANDLERS[MESSAGE_TYPES.agentApply]({ plan: params.plan })
    case 'get_status': {
      const lastScanData = await storageGet(chrome.storage.local, LAST_SCAN_STATS_KEY)
      return {
        pendingApproval: await getPendingAgentApproval(),
        lastScan: lastScanData?.[LAST_SCAN_STATS_KEY] || null,
      }
    }
    case 'list_backups':
      return listBackups({ storageApi: chrome.storage.local })
    default:
      throw new Error(`Unknown MCP tool: ${tool}`)
  }
}
