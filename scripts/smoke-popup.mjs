/**
 * T4: Popup storage-read smoke test.
 * Writes chrome.storage.local keys → opens Popup → verifies rendered values.
 * Also verifies empty-storage → "--" defaults.
 */
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
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bookmarkops-popup-'))

if (!fs.existsSync(path.join(extensionDir, 'manifest.json'))) {
  throw new Error(`找不到擴充功能 manifest：${path.join(extensionDir, 'manifest.json')}`)
}

// Only filesystem-validate when an explicit path was supplied; bare specifiers
// are resolved by `import` against node_modules.
if ((playwrightModule.startsWith('/') || playwrightModule.startsWith('.')) && !fs.existsSync(playwrightModule)) {
  throw new Error(`找不到 Playwright 模組：${playwrightModule}`)
}

const { chromium } = await import(playwrightModule)
const context = await chromium.launchPersistentContext(userDataDir, {
  acceptDownloads: false,
  headless: false,
  viewport: { width: 390, height: 680 },
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
  const popupUrl = `chrome-extension://${extensionId}/index.html`
  const page = await context.newPage()

  // --- T4a: empty storage → all fields show "--", pending badge hidden ---
  await page.goto(popupUrl)
  await page.waitForSelector('#dashboardButton')

  const emptyState = await page.evaluate(() => ({
    healthScore: document.querySelector('#popupHealthScore')?.textContent,
    bookmarkCount: document.querySelector('[data-metric="bookmarkCount"]')?.textContent,
    folderCount: document.querySelector('[data-metric="folderCount"]')?.textContent,
    duplicateUrlCount: document.querySelector('[data-metric="duplicateUrlCount"]')?.textContent,
    pendingBadgeHidden: document.querySelector('#pendingBadge')?.hidden,
    dashboardButtonEnabled: !document.querySelector('#dashboardButton')?.disabled,
  }))

  assert.equal(emptyState.healthScore, '--', 'T4a: healthScore should be "--" with no storage data')
  assert.equal(emptyState.bookmarkCount, '--', 'T4a: bookmarkCount should be "--" with no storage data')
  assert.equal(emptyState.folderCount, '--', 'T4a: folderCount should be "--" with no storage data')
  assert.equal(emptyState.duplicateUrlCount, '--', 'T4a: duplicateUrlCount should be "--" with no storage data')
  assert.equal(emptyState.pendingBadgeHidden, true, 'T4a: pendingBadge should be hidden with no pending approval')
  assert.equal(emptyState.dashboardButtonEnabled, true, 'T4a: dashboard CTA button should be enabled')

  // --- T4b: write storage keys → reload popup → verify rendered values ---
  await page.evaluate(() => new Promise((resolve) => {
    chrome.storage.local.set({
      'bookmarkops.lastHealthScore': 82,
      'bookmarkops.lastScanStats': {
        stats: {
          bookmarkCount: 314,
          folderCount: 27,
          duplicateUrlCount: 5,
        },
      },
      'bookmarkops.pendingAgentApproval': {
        status: 'pending',
        type: 'applyPlan',
        requiredPhrase: 'APPLY',
      },
    }, resolve)
  }))

  await page.reload()
  await page.waitForSelector('#dashboardButton')

  const populatedState = await page.evaluate(() => ({
    healthScore: document.querySelector('#popupHealthScore')?.textContent,
    healthTone: document.querySelector('#popupHealthScore')?.dataset.tone,
    bookmarkCount: document.querySelector('[data-metric="bookmarkCount"]')?.textContent,
    folderCount: document.querySelector('[data-metric="folderCount"]')?.textContent,
    duplicateUrlCount: document.querySelector('[data-metric="duplicateUrlCount"]')?.textContent,
    pendingBadgeHidden: document.querySelector('#pendingBadge')?.hidden,
    pendingBadgeText: document.querySelector('#pendingBadge')?.textContent,
  }))

  assert.equal(populatedState.healthScore, '82', 'T4b: healthScore should render stored value')
  assert.equal(populatedState.healthTone, 'good', 'T4b: score 82 → tone "good"')
  assert.ok(populatedState.bookmarkCount.includes('314'), `T4b: bookmarkCount should include 314, got: ${populatedState.bookmarkCount}`)
  assert.ok(populatedState.folderCount.includes('27'), `T4b: folderCount should include 27, got: ${populatedState.folderCount}`)
  assert.ok(populatedState.duplicateUrlCount.includes('5'), `T4b: duplicateUrlCount should include 5, got: ${populatedState.duplicateUrlCount}`)
  assert.equal(populatedState.pendingBadgeHidden, false, 'T4b: pendingBadge should be visible when status is pending')
  assert.ok(populatedState.pendingBadgeText?.trim().length > 0, 'T4b: pendingBadge should have non-empty text')

  // --- T4c: danger tone threshold ---
  await page.evaluate(() => new Promise((resolve) => {
    chrome.storage.local.set({ 'bookmarkops.lastHealthScore': 45 }, resolve)
  }))
  await page.reload()
  await page.waitForSelector('#popupHealthScore')
  const dangerState = await page.evaluate(() => ({
    score: document.querySelector('#popupHealthScore')?.textContent,
    tone: document.querySelector('#popupHealthScore')?.dataset.tone,
  }))
  assert.equal(dangerState.score, '45', 'T4c: score 45 should render')
  assert.equal(dangerState.tone, 'danger', 'T4c: score 45 → tone "danger"')

  // --- T4d: warning tone threshold ---
  await page.evaluate(() => new Promise((resolve) => {
    chrome.storage.local.set({ 'bookmarkops.lastHealthScore': 65 }, resolve)
  }))
  await page.reload()
  await page.waitForSelector('#popupHealthScore')
  const warningState = await page.evaluate(() => ({
    tone: document.querySelector('#popupHealthScore')?.dataset.tone,
  }))
  assert.equal(warningState.tone, 'warning', 'T4d: score 65 → tone "warning"')

  console.log('T4 Popup smoke test passed: storage reads render correctly in Popup UI.')
  console.log(`隔離測試資料夾：${userDataDir}`)
  console.log(`擴充功能 ID：${extensionId}`)
} finally {
  await context.close()
}
