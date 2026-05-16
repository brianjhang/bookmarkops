import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const extensionDir = process.env.BOOKMARKOPS_EXTENSION_DIR
  || path.resolve(process.cwd(), 'dist')
// Default to the bare `playwright` specifier so node resolves it from node_modules.
// Override with PLAYWRIGHT_MODULE when playwright lives outside the package (e.g.
// a shared vendored install).
const playwrightModule = process.env.PLAYWRIGHT_MODULE || 'playwright'
const fixtureUrl = 'https://example.com/bookmarkops-runtime-probe'
const moveUrl = 'https://example.com/bookmarkops-move'
const oldUrl = 'https://example.com/bookmarkops-old'
const deleteUrl = 'https://example.com/bookmarkops-delete'
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bookmarkops-extension-runtime-'))

if (!fs.existsSync(path.join(extensionDir, 'manifest.json'))) {
  throw new Error(`找不到擴充功能 manifest：${path.join(extensionDir, 'manifest.json')}`)
}

// Only filesystem-validate when an explicit path was supplied; bare specifiers
// are resolved by `import` against node_modules.
if ((playwrightModule.startsWith('/') || playwrightModule.startsWith('.')) && !fs.existsSync(playwrightModule)) {
  throw new Error(`找不到 Playwright 模組：${playwrightModule}`)
}

const { chromium } = await import(playwrightModule)
const externalRequests = []
const context = await chromium.launchPersistentContext(userDataDir, {
  acceptDownloads: false,
  headless: false,
  viewport: {
    width: 390,
    height: 680,
  },
  args: [
    `--disable-extensions-except=${extensionDir}`,
    `--load-extension=${extensionDir}`,
    '--window-position=-9999,-9999',
    '--window-size=390,680',
  ],
})

try {
  let [worker] = context.serviceWorkers()
  if (!worker) {
    worker = await context.waitForEvent('serviceworker', { timeout: 15000 })
  }

  const extensionId = new URL(worker.url()).host

  // Grant clipboard permissions for T2 clipboard read verification
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin: `chrome-extension://${extensionId}`,
  })
  const page = await context.newPage()
  page.on('request', (request) => {
    const requestUrl = request.url()
    if (
      requestUrl.startsWith('chrome-extension://')
      || requestUrl.startsWith('blob:')
      || requestUrl.startsWith('data:')
    ) {
      return
    }

    externalRequests.push(requestUrl)
  })

  const popupUrl = `chrome-extension://${extensionId}/index.html`
  const dashboardUrl = `chrome-extension://${extensionId}/dashboard.html`

  // --- Popup: initial state check (no scan data in storage yet) ---
  await page.goto(popupUrl)
  await page.waitForSelector('#dashboardButton')

  await page.evaluate((url) => new Promise((resolve, reject) => {
    chrome.bookmarks.create(
      {
        title: 'BookmarkOps Runtime Probe',
        url,
      },
      (node) => {
        const error = chrome.runtime.lastError
        if (error) {
          reject(new Error(error.message))
          return
        }

        resolve(node)
      },
    )
  }), fixtureUrl)

  const initialPopupState = await page.evaluate(() => ({
    dashboardButtonEnabled: !document.querySelector('#dashboardButton')?.disabled,
    bookmarkCount: document.querySelector('[data-metric="bookmarkCount"]')?.textContent,
    healthScore: document.querySelector('#popupHealthScore')?.textContent,
  }))
  assert.equal(initialPopupState.dashboardButtonEnabled, true)
  assert.equal(initialPopupState.bookmarkCount, '--')
  assert.equal(initialPopupState.healthScore, '--')

  // --- Background message: JSON report ---
  const jsonResponse = await page.evaluate(() => new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        source: 'bookmarkops',
        type: 'bookmarkops.report',
        format: 'json',
      },
      (response) => {
        const error = chrome.runtime.lastError
        if (error) {
          reject(new Error(error.message))
          return
        }

        resolve(response)
      },
    )
  }))

  assert.equal(jsonResponse.ok, true)
  assert.equal(jsonResponse.data.mimeType, 'application/json')

  const jsonReport = JSON.parse(jsonResponse.data.body)
  assert.equal(jsonReport.privacy.externalTransmission, false)
  assert.equal(
    jsonReport.bookmarks.some((bookmark) => bookmark.url === fixtureUrl),
    true,
  )

  // --- Background message: Markdown report ---
  const markdownResponse = await page.evaluate(() => new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        source: 'bookmarkops',
        type: 'bookmarkops.report',
        format: 'markdown',
      },
      (response) => {
        const error = chrome.runtime.lastError
        if (error) {
          reject(new Error(error.message))
          return
        }

        resolve(response)
      },
    )
  }))

  assert.equal(markdownResponse.ok, true)
  assert.equal(markdownResponse.data.mimeType, 'text/markdown')
  assert.match(markdownResponse.data.body, /BookmarkOps Runtime Probe/)
  assert.match(markdownResponse.data.body, /https:\/\/example.com\/bookmarkops-runtime-probe/)

  // --- Create bookmarks for plan workflow ---
  const plan = await page.evaluate(async ({ moveUrl, oldUrl, deleteUrl }) => {
    const call = (method, ...args) => new Promise((resolve, reject) => {
      method(...args, (result) => {
        const error = chrome.runtime.lastError
        if (error) {
          reject(new Error(error.message))
          return
        }

        resolve(result)
      })
    })

    const tree = await call(chrome.bookmarks.getTree)
    const root = tree[0]
    const bar = root.children.find((child) => child.title === 'Bookmarks Bar') || root.children[0]
    const barPath = [bar.title]
    const currentFolder = await call(chrome.bookmarks.create, {
      parentId: bar.id,
      title: 'BookmarkOps Current',
    })
    const emptyFolder = await call(chrome.bookmarks.create, {
      parentId: bar.id,
      title: 'BookmarkOps Empty',
    })
    const oldBookmark = await call(chrome.bookmarks.create, {
      parentId: bar.id,
      title: 'BookmarkOps Old',
      url: oldUrl,
    })
    const deleteBookmark = await call(chrome.bookmarks.create, {
      parentId: bar.id,
      title: 'BookmarkOps Delete',
      url: deleteUrl,
    })
    const moveBookmark = await call(chrome.bookmarks.create, {
      parentId: currentFolder.id,
      title: 'BookmarkOps Move',
      url: moveUrl,
    })

    return {
      bookmarkopsVersion: '0.0.1',
      summary: 'Extension runtime full workflow',
      riskLevel: 'medium',
      createdBy: 'runtime-smoke',
      createdAt: '2026-05-08T00:00:00.000Z',
      operations: [
        {
          type: 'createFolder',
          path: [...barPath, 'BookmarkOps AI'],
        },
        {
          type: 'moveBookmark',
          id: moveBookmark.id,
          expectedTitle: 'BookmarkOps Move',
          expectedUrl: moveUrl,
          expectedParentPath: [...barPath, 'BookmarkOps Current'],
          destination: [...barPath, 'BookmarkOps AI'],
        },
        {
          type: 'renameNode',
          id: oldBookmark.id,
          expectedTitle: 'BookmarkOps Old',
          newTitle: 'BookmarkOps Renamed',
        },
        {
          type: 'deleteBookmark',
          id: deleteBookmark.id,
          expectedTitle: 'BookmarkOps Delete',
          expectedUrl: deleteUrl,
          expectedParentPath: barPath,
        },
        {
          type: 'deleteEmptyFolder',
          id: emptyFolder.id,
          expectedTitle: 'BookmarkOps Empty',
          expectedParentPath: barPath,
        },
      ],
    }
  }, { moveUrl, oldUrl, deleteUrl })

  const send = (payload) => page.evaluate((message) => new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        source: 'bookmarkops',
        ...message,
      },
      (response) => {
        const error = chrome.runtime.lastError
        if (error) {
          reject(new Error(error.message))
          return
        }
        resolve(response)
      },
    )
  }), payload)

  // --- Agent config: default state ---
  const defaultAgentConfig = await send({
    type: 'bookmarkops.agent.config.get',
  })
  assert.equal(defaultAgentConfig.ok, true)
  assert.equal(defaultAgentConfig.data.enabled, true)
  assert.equal(defaultAgentConfig.data.hasToken, true)
  assert.equal(defaultAgentConfig.data.manualMode, false)
  assert.equal(defaultAgentConfig.data.sessionToken, undefined)
  assert.equal(defaultAgentConfig.data.maskedSessionToken.includes('••••'), true)

  const popupRevealReject = await send({
    type: 'bookmarkops.agent.config.reveal',
  })
  assert.equal(popupRevealReject.ok, false)
  assert.match(popupRevealReject.error, /Dashboard context is required/)

  const popupApplyReject = await send({
    type: 'bookmarkops.plan.apply',
    plan,
    approval: {
      source: 'dashboard',
      phrase: 'APPLY',
    },
  })
  assert.equal(popupApplyReject.ok, false)
  assert.match(popupApplyReject.error, /Dashboard context is required/)

  // DX E3: empty token → background.js wraps error to actionable message
  const defaultAgentReject = await send({
    type: 'bookmarkops.agent.scan',
    agentToken: '',
  })
  assert.equal(defaultAgentReject.ok, false)
  assert.match(defaultAgentReject.error, /Rotate in Dashboard/)

  // --- Dashboard: agent start + T1 assertions ---
  await page.goto(dashboardUrl)
  await page.waitForSelector('#loadAgentRequestButton', { state: 'attached' })
  await page.click('#agentStartButton')
  await page.waitForFunction(() => {
    const bookmarkCount = document.querySelector('[data-stat="bookmarkCount"]')?.textContent
    return bookmarkCount && bookmarkCount !== '--'
  })
  const onboardingState = await page.evaluate(() => ({
    bookmarkCount: document.querySelector('[data-stat="bookmarkCount"]')?.textContent,
    findings: document.querySelector('#agentFindingsOutput')?.textContent,
    healthScore: document.querySelector('#agentHealthScore')?.textContent,
  }))
  assert.equal(Number(onboardingState.bookmarkCount.replaceAll(',', '')) >= 4, true)
  assert.match(onboardingState.findings, /recommendations|整理建議|整理建议|No urgent cleanup|目前沒有明顯/)
  assert.match(onboardingState.healthScore, /Health score|健康分數|健康分数/)

  // T1a: handleAgentStart saves lastHealthScore to chrome.storage.local
  const storedHealthScore = await page.evaluate(() => new Promise((resolve) => {
    chrome.storage.local.get(['bookmarkops.lastHealthScore'], (result) => {
      resolve(result['bookmarkops.lastHealthScore'])
    })
  }))
  assert.ok(storedHealthScore != null && typeof storedHealthScore === 'number', `T1a: lastHealthScore must be stored as number, got: ${JSON.stringify(storedHealthScore)}`)

  // T1b: pipeline stages transitioned in correct order (analyze→report→pendingApproval)
  const stageStates = await page.evaluate(() => {
    const stages = document.querySelectorAll('[data-stage]')
    return [...stages].map((s) => ({ stage: s.dataset.stage, state: s.dataset.state }))
  })
  const analyzeStage = stageStates.find((s) => s.stage === 'analyze')
  const reportStage = stageStates.find((s) => s.stage === 'report')
  const pendingApprovalStage = stageStates.find((s) => s.stage === 'pendingApproval')
  assert.equal(analyzeStage?.state, 'done', `T1b: analyze stage should be 'done', got: ${analyzeStage?.state}`)
  assert.equal(reportStage?.state, 'done', `T1b: report stage should be 'done', got: ${reportStage?.state}`)
  assert.ok(
    ['idle', 'active'].includes(pendingApprovalStage?.state || ''),
    `T1b: pendingApproval stage should be idle or active, got: ${pendingApprovalStage?.state}`,
  )

  // T1c: Popup reads lastHealthScore from storage and renders score + color
  const popupCheckPage = await context.newPage()
  await popupCheckPage.goto(popupUrl)
  await popupCheckPage.waitForSelector('#popupHealthScore')
  const popupHealthState = await popupCheckPage.evaluate(() => ({
    score: document.querySelector('#popupHealthScore')?.textContent,
    tone: document.querySelector('#popupHealthScore')?.dataset.tone,
  }))
  assert.ok(popupHealthState.score !== '--', `T1c: popup must show health score after scan, got: '${popupHealthState.score}'`)
  assert.ok(
    ['good', 'warning', 'danger'].includes(popupHealthState.tone || ''),
    `T1c: popup health score tone must be good/warning/danger, got: '${popupHealthState.tone}'`,
  )
  await popupCheckPage.close()

  // --- Agent config: reveal and rotate ---
  const revealedAgentConfig = await send({
    type: 'bookmarkops.agent.config.reveal',
  })
  assert.equal(revealedAgentConfig.ok, true)
  assert.equal(typeof revealedAgentConfig.data.sessionToken, 'string')
  assert.equal(revealedAgentConfig.data.sessionToken.length > 12, true)

  // T2: Quick-Setup JSON contains @bookmarkops/mcp; Copy Config copies JSON with token to clipboard
  const quickSetupJson = await page.evaluate(() => document.querySelector('#quickSetupCode')?.textContent)
  assert.ok(quickSetupJson?.includes('@bookmarkops/mcp'), `T2: quickSetupCode must contain '@bookmarkops/mcp', got: ${quickSetupJson?.substring(0, 120)}`)
  assert.ok(quickSetupJson?.includes('BOOKMARKOPS_TOKEN'), 'T2: quickSetupCode must contain BOOKMARKOPS_TOKEN env key')

  await page.click('#quickSetupCopyButton')
  const clipboardText = await page.evaluate(() => navigator.clipboard.readText())
  const clipboardParsed = JSON.parse(clipboardText)
  assert.ok(
    clipboardParsed?.mcpServers?.bookmarkops?.args?.includes('@bookmarkops/mcp'),
    `T2: clipboard JSON must reference @bookmarkops/mcp`,
  )
  assert.ok(
    typeof clipboardParsed?.mcpServers?.bookmarkops?.env?.BOOKMARKOPS_TOKEN === 'string'
    && clipboardParsed.mcpServers.bookmarkops.env.BOOKMARKOPS_TOKEN.length > 12,
    `T2: clipboard JSON must contain a real BOOKMARKOPS_TOKEN`,
  )

  const rotatedAgentConfig = await send({
    type: 'bookmarkops.agent.config.rotate',
  })
  assert.equal(rotatedAgentConfig.ok, true)
  assert.equal(rotatedAgentConfig.data.sessionToken, undefined)
  assert.equal(rotatedAgentConfig.data.maskedSessionToken.includes('••••'), true)

  const oldAgentReject = await send({
    type: 'bookmarkops.agent.scan',
    agentToken: revealedAgentConfig.data.sessionToken,
  })
  assert.equal(oldAgentReject.ok, false)

  const nextRevealedAgentConfig = await send({
    type: 'bookmarkops.agent.config.reveal',
  })
  const agentToken = nextRevealedAgentConfig.data.sessionToken

  // T3: with valid token, agentStartButton is visible and setupPrompt is hidden
  const t3State = await page.evaluate(() => ({
    startButtonHidden: document.querySelector('#agentStartButton')?.hidden,
    setupPromptHidden: document.querySelector('#setupPrompt')?.hidden,
  }))
  assert.equal(t3State.startButtonHidden, false, 'T3: agentStartButton should be visible when token is configured')
  assert.equal(t3State.setupPromptHidden, true, 'T3: setupPrompt should be hidden when token is configured')

  // --- Agent workflow: scan, report, dryRun, submitPlan, apply ---
  const agentScan = await send({
    type: 'bookmarkops.agent.scan',
    agentToken,
  })
  assert.equal(agentScan.ok, true)
  assert.equal(agentScan.data.stats.bookmarkCount >= 4, true)

  const agentReport = await send({
    type: 'bookmarkops.agent.report',
    agentToken,
    format: 'json',
  })
  assert.equal(agentReport.ok, true)
  assert.equal(agentReport.data.mimeType, 'application/json')

  const agentDryRun = await send({
    type: 'bookmarkops.agent.dryRun',
    agentToken,
    plan,
  })
  assert.equal(agentDryRun.ok, true)
  assert.equal(agentDryRun.data.ok, true)

  const agentSubmit = await send({
    type: 'bookmarkops.agent.submitPlan',
    agentToken,
    plan,
  })
  assert.equal(agentSubmit.ok, true)
  assert.equal(agentSubmit.data.validation.ok, true)
  assert.equal(agentSubmit.data.dryRun.ok, true, JSON.stringify(agentSubmit.data.dryRun, null, 2))

  const agentApplyRequest = await send({
    type: 'bookmarkops.agent.apply',
    agentToken,
    plan,
  })
  assert.equal(agentApplyRequest.ok, true)
  assert.equal(agentApplyRequest.data.type, 'applyPlan')
  assert.equal(agentApplyRequest.data.status, 'pending')
  assert.equal(agentApplyRequest.data.requiredPhrase, 'APPLY')
  assert.equal(agentApplyRequest.data.validation.ok, true)
  assert.equal(agentApplyRequest.data.dryRun.ok, true)

  // #loadAgentRequestButton is inside #approvalSection which may be hidden; force click
  await page.click('#loadAgentRequestButton', { force: true })
  await page.waitForFunction(() => !document.querySelector('#pendingApprovalCard')?.hidden)
  const agentUiState = await page.evaluate(() => ({
    enabled: document.querySelector('#agentEnabled')?.checked,
    tokenValue: document.querySelector('#agentToken')?.value,
    agentOutput: document.querySelector('#agentOutput')?.textContent,
    pendingTitle: document.querySelector('#pendingApprovalTitle')?.textContent,
    approveDisabled: document.querySelector('#approveAgentRequestButton')?.disabled,
  }))
  assert.equal(agentUiState.enabled, true)
  assert.equal(agentUiState.tokenValue.includes('••••'), true)
  assert.match(agentUiState.agentOutput, /dashboard approval is required/)
  assert.match(agentUiState.pendingTitle, /Agent requested Apply|Agent 請求套用/)
  assert.equal(agentUiState.approveDisabled, true)

  await page.check('#pendingApprovalAcknowledgement')
  await page.fill('#pendingApprovalPhrase', 'APPLY')
  await page.waitForFunction(() => !document.querySelector('#approveAgentRequestButton').disabled)
  await page.click('#approveAgentRequestButton')
  await page.waitForFunction(() => document.querySelector('#agentApprovalOutput')?.textContent.includes('backupId'))

  const applyState = await page.evaluate(() => JSON.parse(document.querySelector('#agentApprovalOutput').textContent))
  assert.equal(applyState.ok, true)
  assert.equal(applyState.verify.failed.length, 0)
  assert.equal(Boolean(applyState.backupId), true)

  const afterApplyState = await page.evaluate(({ moveUrl, oldUrl, deleteUrl }) => new Promise((resolve, reject) => {
    chrome.bookmarks.getTree((tree) => {
      const error = chrome.runtime.lastError
      if (error) {
        reject(new Error(error.message))
        return
      }

      const nodes = []
      const walk = (node, parentTitle = '') => {
        nodes.push({
          id: node.id,
          title: node.title,
          url: node.url || '',
          parentId: node.parentId || '',
          parentTitle,
        })
        for (const child of node.children || []) walk(child, node.title)
      }
      tree.forEach((node) => walk(node))
      resolve({
        moved: nodes.find((node) => node.url === moveUrl),
        renamed: nodes.find((node) => node.url === oldUrl),
        deleted: nodes.find((node) => node.url === deleteUrl) || null,
      })
    })
  }), { moveUrl, oldUrl, deleteUrl })

  assert.equal(afterApplyState.moved.parentTitle, 'BookmarkOps AI')
  assert.equal(afterApplyState.renamed.title, 'BookmarkOps Renamed')
  assert.equal(afterApplyState.deleted, null)

  // --- Restore backup ---
  const agentRestoreRequest = await send({
    type: 'bookmarkops.agent.restore',
    agentToken,
    backupId: applyState.backupId,
  })
  assert.equal(agentRestoreRequest.ok, true)
  assert.equal(agentRestoreRequest.data.type, 'restoreBackup')
  assert.equal(agentRestoreRequest.data.requiredPhrase, 'RESTORE')

  await page.click('#loadAgentRequestButton', { force: true })
  await page.waitForFunction(() => /Agent requested Restore|Agent 請求還原/.test(document.querySelector('#pendingApprovalTitle')?.textContent || ''))
  await page.fill('#pendingApprovalPhrase', 'RESTORE')
  await page.waitForFunction(() => !document.querySelector('#approveAgentRequestButton').disabled)
  await page.click('#approveAgentRequestButton')
  await page.waitForFunction(() => document.querySelector('#agentApprovalOutput')?.textContent.includes('"verify"'))

  const restoreState = await page.evaluate(() => JSON.parse(document.querySelector('#agentApprovalOutput').textContent))
  assert.equal(restoreState.verify.ok, true)

  const afterRestoreState = await page.evaluate(({ moveUrl, oldUrl, deleteUrl }) => new Promise((resolve, reject) => {
    chrome.bookmarks.getTree((tree) => {
      const error = chrome.runtime.lastError
      if (error) {
        reject(new Error(error.message))
        return
      }

      const nodes = []
      const walk = (node, parentTitle = '') => {
        nodes.push({
          title: node.title,
          url: node.url || '',
          parentTitle,
        })
        for (const child of node.children || []) walk(child, node.title)
      }
      tree.forEach((node) => walk(node))
      resolve({
        moved: nodes.find((node) => node.url === moveUrl),
        old: nodes.find((node) => node.url === oldUrl),
        deleted: nodes.find((node) => node.url === deleteUrl),
        aiFolder: nodes.find((node) => node.title === 'BookmarkOps AI') || null,
      })
    })
  }), { moveUrl, oldUrl, deleteUrl })

  assert.equal(afterRestoreState.moved.parentTitle, 'BookmarkOps Current')
  assert.equal(afterRestoreState.old.title, 'BookmarkOps Old')
  assert.equal(afterRestoreState.deleted.title, 'BookmarkOps Delete')
  assert.equal(afterRestoreState.aiFolder, null)

  // --- Delete backup ---
  const agentDeleteBackupRequest = await send({
    type: 'bookmarkops.agent.deleteBackup',
    agentToken,
    backupId: applyState.backupId,
  })
  assert.equal(agentDeleteBackupRequest.ok, true)
  assert.equal(agentDeleteBackupRequest.data.type, 'deleteBackup')
  assert.equal(agentDeleteBackupRequest.data.requiredPhrase, 'DELETE BACKUP')

  await page.click('#loadAgentRequestButton', { force: true })
  await page.waitForFunction(() => /Agent requested Delete Backup|Agent 請求刪除備份/.test(document.querySelector('#pendingApprovalTitle')?.textContent || ''))
  await page.fill('#pendingApprovalPhrase', 'DELETE BACKUP')
  await page.waitForFunction(() => !document.querySelector('#approveAgentRequestButton').disabled)
  await page.click('#approveAgentRequestButton')
  await page.waitForFunction(() => document.querySelector('#agentApprovalOutput')?.textContent.includes('"deleted": true'))

  const backupsAfterDelete = await send({
    type: 'bookmarkops.backups.list',
  })
  assert.equal(backupsAfterDelete.ok, true)
  assert.equal(backupsAfterDelete.data.some((backup) => backup.id === applyState.backupId), false)
  assert.deepEqual(externalRequests, [])

  console.log('真實擴充功能 runtime 測試通過')
  console.log(`隔離測試資料夾：${userDataDir}`)
  console.log(`擴充功能 ID：${extensionId}`)
  console.log(`套用備份 ID：${applyState.backupId}`)
  console.log('安全結論：隔離 profile 完成 scan/report/validate/dryRun/apply/verify/restore/agent gate；未偵測到外部網路請求。')
} finally {
  await context.close()
}
