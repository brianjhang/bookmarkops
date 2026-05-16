import './style.css'
import { createDashboardI18n } from './locales/dashboard.js'

const i18n = await createDashboardI18n()
const t = (key, vars) => i18n.t(key, vars)

document.querySelector('#app').innerHTML = `
<main class="popup-shell">
  <header class="popup-header">
    <span class="popup-product-name">BookmarkOps</span>
    <span id="bridgeDot" class="bridge-dot" data-state="unknown" title="${t('popupBridgeOff')}"></span>
  </header>

  <section class="popup-score-section">
    <span id="popupHealthScore" class="popup-health-score" data-tone="unknown">--</span>
    <div class="popup-score-labels">
      <span class="popup-health-label" data-i18n="popupHealthLabel">${t('popupHealthLabel')}</span>
      <small id="popupHealthContext" class="popup-health-context"></small>
    </div>
  </section>

  <hr class="popup-divider" />

  <section class="popup-metrics" aria-label="Bookmark stats">
    <div class="popup-metric">
      <strong data-metric="bookmarkCount">--</strong>
      <span data-i18n="popupBookmarks">${t('popupBookmarks')}</span>
    </div>
    <div class="popup-metric">
      <strong data-metric="dormantCount">--</strong>
      <span data-i18n="popupDormant">${t('popupDormant')}</span>
    </div>
    <div class="popup-metric">
      <strong data-metric="unknownCount">--</strong>
      <span data-i18n="popupUnknown">${t('popupUnknown')}</span>
    </div>
  </section>

  <hr class="popup-divider" />

  <div class="popup-status-bar">
    <span id="bridgeLabel" class="popup-bridge-label">${t('popupBridgeOff')}</span>
    <span id="pendingBadge" class="popup-pending-badge" hidden></span>
  </div>

  <p id="setupHint" class="popup-setup-hint" hidden>${t('popupSetupHint')}</p>

  <hr class="popup-divider" />

  <section class="popup-actions">
    <button id="dashboardButton" type="button" class="popup-cta-btn" data-i18n="popupOpenDashboard">${t('popupOpenDashboard')}</button>
  </section>

  <p class="popup-privacy" data-i18n="popupPrivacy">${t('popupPrivacy')}</p>
  <p id="message" class="popup-message" role="status" aria-live="polite"></p>
</main>
`

const MESSAGE_SOURCE = 'bookmarkops'
const MESSAGE_TYPES = {
  openDashboard: 'bookmarkops.dashboard.open',
}

const dashboardButton = document.querySelector('#dashboardButton')
const popupHealthScore = document.querySelector('#popupHealthScore')
const popupHealthContext = document.querySelector('#popupHealthContext')
const bridgeDot = document.querySelector('#bridgeDot')
const bridgeLabel = document.querySelector('#bridgeLabel')
const pendingBadge = document.querySelector('#pendingBadge')
const message = document.querySelector('#message')

dashboardButton.addEventListener('click', handleOpenDashboard)

if (!hasExtensionRuntime()) {
  setMessage(t('popupUnavailable'), 'error')
  dashboardButton.disabled = true
} else {
  loadCachedState()
  checkBridgeHealth()
}

async function loadCachedState() {
  // Health score
  chrome.storage.local.get([
    'bookmarkops.lastHealthScore',
    'bookmarkops.lastScanStats',
    'bookmarkops.pendingAgentApproval',
  ], (result) => {
    const healthScore = result?.['bookmarkops.lastHealthScore']
    if (healthScore != null) {
      renderHealthScore(healthScore)
    }

    const scanStats = result?.['bookmarkops.lastScanStats']
    if (scanStats?.stats) {
      renderMetrics(scanStats.stats)
    }

    const pending = result?.['bookmarkops.pendingAgentApproval']
    if (pending?.status === 'pending') {
      pendingBadge.textContent = t('popupPending', { count: 1 })
      pendingBadge.hidden = false
    } else {
      pendingBadge.hidden = true
    }
  })
}

async function checkBridgeHealth() {
  let on = false
  try {
    const res = await fetch('http://localhost:7842/health', { signal: AbortSignal.timeout(1000) })
    on = res.ok
  } catch { /* bridge not running */ }

  bridgeDot.dataset.state = on ? 'on' : 'off'
  bridgeDot.title = on ? t('popupBridgeOn') : t('popupBridgeOff')
  bridgeLabel.textContent = on ? t('popupBridgeOn') : t('popupBridgeOff')
  bridgeLabel.dataset.tone = on ? 'default' : 'muted'

  const setupHint = document.querySelector('#setupHint')
  if (setupHint) setupHint.hidden = on
}

function renderHealthScore(score) {
  const tone = score >= 80 ? 'good' : score >= 60 ? 'warning' : 'danger'
  popupHealthScore.textContent = String(score)
  popupHealthScore.dataset.tone = tone
}

function renderMetrics(stats) {
  setMetric('bookmarkCount', stats.bookmarkCount)
  setMetric('dormantCount', stats.usageBuckets?.dormant ?? 0)
  setMetric('unknownCount', stats.usageBuckets?.unknown ?? 0)
}

async function handleOpenDashboard() {
  try {
    await sendMessage({ type: MESSAGE_TYPES.openDashboard })
  } catch (error) {
    setMessage(error instanceof Error ? error.message : 'Dashboard failed to open.', 'error')
  }
}

function sendMessage(payload) {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(
        { source: MESSAGE_SOURCE, ...payload },
        (response) => {
          const runtimeError = chrome.runtime.lastError
          if (runtimeError) { reject(new Error(runtimeError.message)); return }
          if (!response?.ok) { reject(new Error(response?.error || 'BookmarkOps request failed.')); return }
          resolve(response.data)
        },
      )
    } catch (error) {
      reject(error)
    }
  })
}

function setMetric(name, value) {
  document.querySelector(`[data-metric="${name}"]`).textContent = formatNumber(value)
}

function setMessage(text, tone = 'default') {
  message.textContent = text
  message.dataset.tone = tone
}

function hasExtensionRuntime() {
  return Boolean(globalThis.chrome?.runtime?.sendMessage)
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(Number(value) || 0)
}
