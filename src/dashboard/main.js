import './style.css'
import { createDashboardI18n, storeDashboardLocale } from '../locales/dashboard.js'
import { storageGet } from '../core/chrome-api.js'
import { createScanSlice } from './scan-slice.js'
import { createPlanSlice } from './plan-slice.js'
import { createAgentSlice } from './agent-slice.js'

const MESSAGE_SOURCE = 'bookmarkops'
const TYPES = {
  scan: 'bookmarkops.scan',
  mcpBridgePoll: 'bookmarkops.mcp.bridgePoll',
  report: 'bookmarkops.report',
  applyPlan: 'bookmarkops.plan.apply',
  listBackups: 'bookmarkops.backups.list',
  restoreBackup: 'bookmarkops.backup.restore',
  deleteBackup: 'bookmarkops.backup.delete',
  agentConfigGet: 'bookmarkops.agent.config.get',
  agentConfigReveal: 'bookmarkops.agent.config.reveal',
  agentConfigRotate: 'bookmarkops.agent.config.rotate',
  agentConfigSet: 'bookmarkops.agent.config.set',
  agentPendingApprovalGet: 'bookmarkops.agent.pendingApproval.get',
  agentPendingApprovalApprove: 'bookmarkops.agent.pendingApproval.approve',
  agentPendingApprovalReject: 'bookmarkops.agent.pendingApproval.reject',
}

const state = {
  scanResult: null,
  backups: [],
  selectedBackupId: '',
  pendingAgentApproval: null,
  agentSessionToken: '',
  agentTokenRevealed: false,
  agentInsights: null,
}

// S1: read locale from chrome.storage.local before first render
const i18n = await createDashboardI18n()
const t = (key, vars) => i18n.t(key, vars)

// S2: apply stored color theme before first render to prevent flash
const storedThemeData = await storageGet(chrome.storage.local, 'bookmarkops.colorTheme').catch(() => null)
const initialTheme = storedThemeData?.['bookmarkops.colorTheme'] || 'auto'
applyThemeClass(initialTheme)

document.querySelector('#dashboard').innerHTML = `
<main class="dashboard-shell">
  <header class="topbar">
    <div>
      <p class="product-name" data-i18n="productName">${t('productName')}</p>
      <h1 data-i18n="dashboard">${t('dashboard')}</h1>
    </div>
    <div class="topbar-actions">
      <label class="locale-picker">
        <span data-i18n="language">${t('language')}</span>
        <select id="localeSelect">
          <option value="en">English</option>
          <option value="zh_TW">繁體中文</option>
          <option value="zh_CN">简体中文</option>
        </select>
      </label>
      <div class="appearance-picker">
        <span data-i18n="appearance">${t('appearance')}</span>
        <button id="themeToggle" class="theme-toggle-btn" type="button" aria-label="Toggle color theme">⚙ Auto</button>
      </div>
      <div class="status-picker">
        <span data-i18n="status">${t('status')}</span>
        <span id="statusPill" class="status-pill" aria-live="polite" aria-atomic="true">${t('ready')}</span>
      </div>
    </div>
  </header>

  <div id="bridgeBanner" class="bridge-banner" hidden>
    <span data-i18n="bridgeBannerText">${t('bridgeBannerText')}</span>
    <button id="bridgeSetupButton" type="button" class="bridge-banner-btn" data-i18n="bridgeBannerBtn">${t('bridgeBannerBtn')}</button>
  </div>

  <section class="workbench">
    <div class="health-score-row">
      <div>
        <span id="healthScore" class="health-score-hero" data-tone="unknown" aria-label="${t('healthScoreLabel')}: --">--</span>
        <span class="health-score-label" data-i18n="healthScoreLabel">${t('healthScoreLabel')}</span>
        <small id="healthScoreContext" class="health-score-context"></small>
      </div>
      <div class="hero-cta-area">
        <button id="agentStartButton" class="btn btn-primary" type="button" data-i18n="analyzeMyBookmarks">${t('analyzeMyBookmarks')}</button>
        <small class="cta-hint" data-i18n="analyzeHint">${t('analyzeHint')}</small>
        <span id="setupPrompt" class="setup-prompt-text" hidden data-i18n="setupPrompt">${t('setupPrompt')}</span>
      </div>
    </div>

    <div id="stageList" class="stage-list" aria-label="BookmarkOps workflow status">
      <div class="stage" data-stage="analyze" data-state="idle" data-scroll-to="agentFindingsPanel" role="button" tabindex="0"><span>1</span><strong data-i18n="stageAnalyze">${t('stageAnalyze')}</strong><em>${t('idle')}</em></div>
      <div class="stage" data-stage="report" data-state="idle" data-scroll-to="agentFindingsPanel" role="button" tabindex="0"><span>2</span><strong data-i18n="stageReport">${t('stageReport')}</strong><em>${t('idle')}</em></div>
      <div class="stage" data-stage="pendingApproval" data-state="idle" data-scroll-to="approvalSection" role="button" tabindex="0"><span>3</span><strong data-i18n="stagePendingApproval">${t('stagePendingApproval')}</strong><em>${t('waiting')}</em></div>
      <div class="stage" data-stage="execute" data-state="idle" data-scroll-to="approvalSection" role="button" tabindex="0"><span>4</span><strong data-i18n="stageExecute">${t('stageExecute')}</strong><em>${t('locked')}</em></div>
      <div class="stage" data-stage="verified" data-state="idle" data-scroll-to="approvalSection" role="button" tabindex="0"><span>5</span><strong data-i18n="stageVerified">${t('stageVerified')}</strong><em>${t('idle')}</em></div>
    </div>

    <ol id="activityLog" class="activity-log">
      <li><time>--:--</time><span>${t('actReady')}</span></li>
    </ol>
  </section>

  <section class="summary-grid">
    <article class="metric stat-primary">
      <span data-i18n="bookmarks">${t('bookmarks')}</span>
      <strong data-stat="bookmarkCount">--</strong>
    </article>
    <article class="metric stat-primary">
      <span data-i18n="folders">${t('folders')}</span>
      <strong data-stat="folderCount">--</strong>
    </article>
    <article class="metric stat-secondary">
      <span data-i18n="operations">${t('operations')}</span>
      <strong data-stat="operationCount">--</strong>
    </article>
    <article class="metric stat-secondary">
      <span data-i18n="backups">${t('backups')}</span>
      <strong data-stat="backupCount">--</strong>
    </article>
  </section>

  <section class="panel agent-findings-panel" id="agentFindingsPanel">
    <div class="panel-heading">
      <div>
        <h2 data-i18n="agentFindings">${t('agentFindings')}</h2>
        <p class="helper-text" data-i18n="agentFindingsDescription">${t('agentFindingsDescription')}</p>
      </div>
      <div class="panel-heading-actions">
        <span id="agentHealthScore" class="small-badge">${t('waiting')}</span>
        <button id="reanalyzeButton" type="button" data-i18n="reanalyze">${t('reanalyze')}</button>
      </div>
    </div>
    <div id="agentFindingsOutput" class="agent-findings empty-state">${t('agentFindingsEmpty')}</div>
  </section>

  <section class="insight-grid" id="insightGrid">
    <article class="panel health-panel">
      <div class="panel-heading">
        <h2 data-i18n="usageHealth">${t('usageHealth')}</h2>
      </div>
      <div id="usageHealth" class="usage-health"></div>
    </article>

    <article class="panel map-panel">
      <div class="panel-heading">
        <h2 data-i18n="bookmarkMap">${t('bookmarkMap')}</h2>
      </div>
      <p class="helper-text" data-i18n="bookmarkMapDescription">${t('bookmarkMapDescription')}</p>
      <p class="helper-text map-ai-hint" data-i18n="bookmarkMapAIHint" hidden>${t('bookmarkMapAIHint')}</p>
      <div id="bookmarkMapOutput" class="bookmark-map empty-state">${t('mapEmpty')}</div>
    </article>
  </section>

  <hr class="section-divider" />

  <section class="panel pending-approval-panel" id="approvalSection" hidden>
    <div class="panel-heading">
      <h2 data-i18n="pendingApproval">${t('pendingApproval')}</h2>
      <button id="loadAgentRequestButton" type="button" data-i18n="refresh">${t('refresh')}</button>
    </div>
    <p class="helper-text" data-i18n="pendingDescription">${t('pendingDescription')}</p>
    <p id="pendingApprovalEmpty" data-i18n="noPending">${t('noPending')}</p>
    <div id="pendingApprovalCard" hidden>
      <div class="approval-card-header">
        <span id="pendingApprovalStatus" class="small-badge"></span>
        <strong id="pendingApprovalTitle"></strong>
        <span id="pendingApprovalMeta" class="helper-text"></span>
      </div>
      <div id="pendingApprovalPreview"></div>
      <div class="review-acknowledgement">
        <label>
          <input id="pendingApprovalAcknowledgement" type="checkbox" disabled />
          <span data-i18n="reviewAcknowledgement">${t('reviewAcknowledgement')}</span>
        </label>
      </div>
      <input id="pendingApprovalPhrase" class="phrase-input" type="text"
        aria-describedby="applyPhraseHint" />
      <span id="applyPhraseHint" class="hint-text" data-i18n="applyPhraseHint">${t('applyPhraseHint')}</span>
      <div class="button-row">
        <button id="approveAgentRequestButton" type="button" disabled data-i18n="approveSelected">${t('approveSelected')}</button>
        <button id="rejectAgentRequestButton" type="button" disabled data-i18n="rejectAll">${t('rejectAll')}</button>
      </div>
    </div>
    <pre id="agentApprovalOutput" class="output"></pre>
  </section>

  <div class="settings-row">
    <section class="panel backup-panel">
      <details>
        <summary class="settings-summary">
          <h2 data-i18n="backupPanel">${t('backupPanel')}</h2>
        </summary>
        <div class="panel-heading" style="margin-top:14px">
          <span></span>
          <button id="restoreButton" type="button" disabled data-i18n="restoreTitle">${t('restoreTitle')}</button>
        </div>
        <select id="backupSelect"></select>
        <input id="restorePhrase" class="phrase-input" type="text" placeholder="RESTORE" />
        <div class="button-row danger-actions">
          <button id="deleteBackupButton" class="danger-button" type="button" disabled data-i18n="deleteBackup">${t('deleteBackup')}</button>
        </div>
        <input id="deleteBackupPhrase" class="phrase-input" type="text" placeholder="DELETE BACKUP" />
        <pre id="restoreOutput" class="output">${t('noBackup')}</pre>
      </details>
    </section>

    <section class="panel agent-operator-panel">
      <details>
        <summary class="settings-summary">
          <h2 data-i18n="operatorPanel">${t('operatorPanel')}</h2>
          <span id="bridgeStatusBadge" class="small-badge" data-tone="default">${t('bridgeChecking')}</span>
        </summary>
        <p class="helper-text" data-i18n="agentDescription">${t('agentDescription')}</p>
        <div class="agent-config">
          <label>
            <input id="agentEnabled" type="checkbox" checked />
            <span data-i18n="agentEnabled">${t('agentEnabled')}</span>
          </label>
        </div>
        <label class="bridge-monitor-label">
          <input id="bridgeMonitorEnabled" type="checkbox" checked />
          <span data-i18n="bridgeMonitor">${t('bridgeMonitor')}</span>
        </label>
        <div class="token-row">
          <span data-i18n="sessionToken">${t('sessionToken')}</span>
          <input id="agentToken" type="text" readonly />
          <button id="agentRevealButton" type="button" disabled data-i18n="reveal">${t('reveal')}</button>
          <button id="agentCopyButton" type="button" data-i18n="copy">${t('copy')}</button>
          <button id="agentGenerateButton" type="button" data-i18n="rotate">${t('rotate')}</button>
        </div>
        <input id="agentRevealPhrase" class="phrase-input" type="text" placeholder="REVEAL" />
        <p class="helper-text" data-i18n="revealPhraseHint">${t('revealPhraseHint')}</p>
        <pre id="agentOutput" class="output"></pre>

        <details open class="quick-setup-details">
          <summary>
            <strong data-i18n="quickSetup">${t('quickSetup')}</strong>
          </summary>
          <p class="helper-text" data-i18n="quickSetupHelp">${t('quickSetupHelp')}</p>
          <pre id="quickSetupCode" class="setup-code"></pre>
          <div class="button-row">
            <button id="quickSetupCopyButton" type="button" data-i18n="copyConfig">${t('copyConfig')}</button>
            <button id="quickSetupUsageButton" type="button" class="btn-secondary" data-i18n="copyUsagePrompt">${t('copyUsagePrompt')}</button>
          </div>
        </details>

        <fieldset class="ai-tool-fieldset" hidden>
          <legend data-i18n="preferredAISettings">${t('preferredAISettings')}</legend>
          <p class="helper-text" data-i18n="preferredAILabel">${t('preferredAILabel')}</p>
          <div class="ai-tool-options">
            <label class="ai-tool-option">
              <input type="radio" name="preferredAITool" value="chatgpt" />
              <span>ChatGPT</span>
            </label>
            <label class="ai-tool-option">
              <input type="radio" name="preferredAITool" value="claude" />
              <span>Claude</span>
            </label>
            <label class="ai-tool-option">
              <input type="radio" name="preferredAITool" value="gemini" />
              <span>Gemini</span>
            </label>
            <label class="ai-tool-option">
              <input type="radio" name="preferredAITool" value="custom" />
              <span data-i18n="preferredAICustomURL">${t('preferredAICustomURL')}</span>
            </label>
          </div>
          <input id="customAIURL" type="url" class="phrase-input"
            placeholder="${t('preferredAICustomURLPlaceholder')}"
            style="display:none" />
          <p id="customAIURLError" class="field-error" hidden data-i18n="preferredAICustomURLError">${t('preferredAICustomURLError')}</p>
        </fieldset>
      </details>
    </section>
  </div>

  <div id="onboardingModal" class="onboarding-modal-backdrop" hidden>
    <div class="onboarding-modal">
      <div class="onboarding-header">
        <strong data-i18n="onboardingTitle">${t('onboardingTitle')}</strong>
        <button id="onboardingDismiss" type="button" class="onboarding-dismiss">✕</button>
      </div>
      <ol class="onboarding-steps">
        <li class="onboarding-step">
          <span class="step-check">✅</span>
          <div class="onboarding-step-body">
            <strong data-i18n="onboardingStep1">${t('onboardingStep1')}</strong>
            <p class="helper-text" data-i18n="onboardingStep1Help">${t('onboardingStep1Help')}</p>
          </div>
        </li>
        <li class="onboarding-step">
          <span class="step-number">2</span>
          <div class="onboarding-step-body">
            <strong data-i18n="onboardingStep2">${t('onboardingStep2')}</strong>
            <p class="helper-text" data-i18n="onboardingStep2Help">${t('onboardingStep2Help')}</p>
          </div>
        </li>
        <li class="onboarding-step">
          <span class="step-number">3</span>
          <div class="onboarding-step-body">
            <strong data-i18n="onboardingStep3">${t('onboardingStep3')}</strong>
            <p class="helper-text" data-i18n="onboardingStep3Help">${t('onboardingStep3Help')}</p>
            <textarea id="onboardingPromptText" class="onboarding-prompt-textarea" readonly rows="6" placeholder="${t('onboardingPromptPlaceholder')}"></textarea>
            <div class="button-row" style="margin-top:8px">
              <button id="onboardingCopyPromptButton" type="button" data-i18n="onboardingCopyPrompt">${t('onboardingCopyPrompt')}</button>
            </div>
          </div>
        </li>
      </ol>
    </div>
  </div>
</main>
`

const elements = {
  localeSelect: document.querySelector('#localeSelect'),
  themeToggle: document.querySelector('#themeToggle'),
  statusPill: document.querySelector('#statusPill'),
  stageList: document.querySelector('#stageList'),
  activityLog: document.querySelector('#activityLog'),
  healthScore: document.querySelector('#healthScore'),
  healthScoreContext: document.querySelector('#healthScoreContext'),
  agentStartButton: document.querySelector('#agentStartButton'),
  setupPrompt: document.querySelector('#setupPrompt'),
  reanalyzeButton: document.querySelector('#reanalyzeButton'),
  agentHealthScore: document.querySelector('#agentHealthScore'),
  agentFindingsOutput: document.querySelector('#agentFindingsOutput'),
  usageHealth: document.querySelector('#usageHealth'),
  bookmarkMapOutput: document.querySelector('#bookmarkMapOutput'),
  approvalSection: document.querySelector('#approvalSection'),
  loadAgentRequestButton: document.querySelector('#loadAgentRequestButton'),
  pendingApprovalEmpty: document.querySelector('#pendingApprovalEmpty'),
  pendingApprovalCard: document.querySelector('#pendingApprovalCard'),
  pendingApprovalStatus: document.querySelector('#pendingApprovalStatus'),
  pendingApprovalTitle: document.querySelector('#pendingApprovalTitle'),
  pendingApprovalMeta: document.querySelector('#pendingApprovalMeta'),
  pendingApprovalPreview: document.querySelector('#pendingApprovalPreview'),
  pendingApprovalAcknowledgement: document.querySelector('#pendingApprovalAcknowledgement'),
  pendingApprovalPhrase: document.querySelector('#pendingApprovalPhrase'),
  approveAgentRequestButton: document.querySelector('#approveAgentRequestButton'),
  rejectAgentRequestButton: document.querySelector('#rejectAgentRequestButton'),
  agentApprovalOutput: document.querySelector('#agentApprovalOutput'),
  backupSelect: document.querySelector('#backupSelect'),
  restoreButton: document.querySelector('#restoreButton'),
  restorePhrase: document.querySelector('#restorePhrase'),
  deleteBackupButton: document.querySelector('#deleteBackupButton'),
  deleteBackupPhrase: document.querySelector('#deleteBackupPhrase'),
  restoreOutput: document.querySelector('#restoreOutput'),
  agentEnabled: document.querySelector('#agentEnabled'),
  agentToken: document.querySelector('#agentToken'),
  agentRevealButton: document.querySelector('#agentRevealButton'),
  agentRevealPhrase: document.querySelector('#agentRevealPhrase'),
  agentCopyButton: document.querySelector('#agentCopyButton'),
  agentGenerateButton: document.querySelector('#agentGenerateButton'),
  agentOutput: document.querySelector('#agentOutput'),
  quickSetupCode: document.querySelector('#quickSetupCode'),
  quickSetupCopyButton: document.querySelector('#quickSetupCopyButton'),
  quickSetupUsageButton: document.querySelector('#quickSetupUsageButton'),
  onboardingModal: document.querySelector('#onboardingModal'),
  onboardingDismiss: document.querySelector('#onboardingDismiss'),
  onboardingCopyPromptButton: document.querySelector('#onboardingCopyPromptButton'),
  onboardingPromptText: document.querySelector('#onboardingPromptText'),
  bridgeStatusBadge: document.querySelector('#bridgeStatusBadge'),
  bridgeMonitorEnabled: document.querySelector('#bridgeMonitorEnabled'),
  bridgeBanner: document.querySelector('#bridgeBanner'),
  bridgeSetupButton: document.querySelector('#bridgeSetupButton'),
  customAIURL: document.querySelector('#customAIURL'),
  customAIURLError: document.querySelector('#customAIURLError'),
}

// Shared context passed into each slice
const ctx = {
  state,
  elements,
  t,
  TYPES,
  sendMessage,
  setStatus,
  setStage,
  recordActivity,
  setStat,
  formatNumber,
  groupBy,
  hasExtensionRuntime,
  // cross-slice deps wired below
  handleScan: null,
  loadBackups: null,
  renderOperationReviewCards: null,
}

const scan = createScanSlice(ctx)
const plan = createPlanSlice(ctx)
const agent = createAgentSlice(ctx)

// Wire cross-slice dependencies
ctx.handleScan = scan.handleScan
ctx.loadBackups = plan.loadBackups
ctx.renderOperationReviewCards = plan.renderOperationReviewCards

bindEvents()
renderEmptyStates()
scan.renderUsageHealth({})
bootstrap()

function bindEvents() {
  elements.localeSelect.value = i18n.locale
  elements.localeSelect.addEventListener('change', handleLocaleChange)

  updateThemeButton(document.documentElement.dataset.theme || 'auto')
  elements.themeToggle.addEventListener('click', handleThemeToggle)

  elements.stageList.addEventListener('click', handleStageClick)
  elements.stageList.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleStageClick(e)
    }
  })

  elements.agentStartButton.addEventListener('click', scan.handleAgentStart)
  elements.reanalyzeButton.addEventListener('click', scan.handleAgentStart)

  elements.restoreButton.addEventListener('click', plan.handleRestore)
  elements.deleteBackupButton.addEventListener('click', plan.handleDeleteBackup)
  elements.backupSelect.addEventListener('change', plan.handleBackupSelection)
  elements.restorePhrase.addEventListener('input', plan.refreshActionControls)
  elements.deleteBackupPhrase.addEventListener('input', plan.refreshActionControls)

  elements.agentRevealButton.addEventListener('click', agent.handleAgentReveal)
  elements.agentRevealPhrase.addEventListener('input', agent.refreshRevealControls)
  elements.agentCopyButton.addEventListener('click', agent.handleAgentCopy)
  elements.agentGenerateButton.addEventListener('click', agent.handleAgentRotate)
  elements.agentEnabled.addEventListener('change', agent.handleAgentSave)
  elements.quickSetupCopyButton.addEventListener('click', handleQuickSetupCopy)
  elements.quickSetupUsageButton.addEventListener('click', handleCopyUsagePrompt)
  elements.onboardingDismiss.addEventListener('click', dismissOnboarding)
  elements.onboardingCopyPromptButton.addEventListener('click', handleCopyOnboardingPrompt)
  elements.bridgeMonitorEnabled.addEventListener('change', handleBridgeMonitorToggle)
  elements.bridgeSetupButton.addEventListener('click', handleShowOnboarding)

  elements.loadAgentRequestButton.addEventListener('click', agent.loadPendingAgentApproval)

  // Preferred AI tool setting
  document.querySelectorAll('input[name="preferredAITool"]').forEach((radio) => {
    radio.addEventListener('change', handlePreferredAIChange)
  })
  elements.customAIURL.addEventListener('input', handleCustomAIURLInput)
  elements.customAIURL.addEventListener('change', savePreferredAITool)
  elements.pendingApprovalAcknowledgement.addEventListener('change', agent.refreshAgentApprovalControls)
  elements.pendingApprovalPhrase.addEventListener('input', agent.refreshAgentApprovalControls)
  elements.approveAgentRequestButton.addEventListener('click', agent.handleApproveAgentRequest)
  elements.rejectAgentRequestButton.addEventListener('click', agent.handleRejectAgentRequest)
}

function renderEmptyStates() {
  elements.agentFindingsOutput.classList.add('empty-state')
  elements.agentFindingsOutput.textContent = t('agentFindingsEmpty')
  elements.bookmarkMapOutput.classList.add('empty-state')
  elements.bookmarkMapOutput.textContent = t('mapEmpty')
}

async function checkBridgeHealth() {
  let ok = false
  try {
    const res = await fetch('http://localhost:7842/health', { signal: AbortSignal.timeout(1000) })
    ok = res.ok
  } catch { /* bridge not running */ }

  elements.bridgeStatusBadge.textContent = ok ? t('bridgeConnected') : t('bridgeDisconnected')
  elements.bridgeStatusBadge.dataset.tone = ok ? 'default' : 'error'
  elements.bridgeBanner.hidden = ok

  if (ok) {
    const modal = document.getElementById('onboardingModal')
    if (modal && !modal.hidden) dismissOnboarding()
  }

  return ok
}

let bridgeHealthIntervalId = null

function startBridgeMonitor() {
  if (bridgeHealthIntervalId) return
  checkBridgeHealth()
  bridgeHealthIntervalId = setInterval(checkBridgeHealth, 5000)
}

function stopBridgeMonitor() {
  clearInterval(bridgeHealthIntervalId)
  bridgeHealthIntervalId = null
  elements.bridgeStatusBadge.textContent = t('bridgeMonitorOff')
  elements.bridgeStatusBadge.dataset.tone = 'muted'
}

async function handleBridgeMonitorToggle() {
  const enabled = elements.bridgeMonitorEnabled.checked
  chrome.storage.local.set({ 'bookmarkops.bridgeMonitorEnabled': enabled }).catch(() => {})
  if (enabled) {
    startBridgeMonitor()
  } else {
    stopBridgeMonitor()
  }
}

async function handleQuickSetupCopy() {
  if (!state.agentSessionToken) {
    await agent.handleAgentReveal()
  }
  if (!state.agentSessionToken) return
  await navigator.clipboard.writeText(elements.quickSetupCode.textContent)
  elements.quickSetupCopyButton.textContent = t('copied')
  setTimeout(() => { elements.quickSetupCopyButton.textContent = t('copyConfig') }, 2000)
  recordActivity(t('mcpConfigCopied'))
}

async function handleCopyUsagePrompt() {
  const prompt = t('usagePromptTemplate')
  await navigator.clipboard.writeText(prompt)
  elements.quickSetupUsageButton.textContent = t('copied')
  setTimeout(() => { elements.quickSetupUsageButton.textContent = t('copyUsagePrompt') }, 2000)
}

function showOnboarding() {
  const modal = document.getElementById('onboardingModal')
  if (!modal) return
  modal.hidden = false
  modal.addEventListener('click', (e) => {
    if (e.target.id === 'onboardingDismiss' || e.target.closest('#onboardingDismiss')) {
      dismissOnboarding()
    }
  }, { capture: true })
}

function dismissOnboarding() {
  const modal = document.getElementById('onboardingModal')
  if (modal) modal.hidden = true
  chrome.storage.local.set({ 'bookmarkops.onboardingDismissed': true }).catch(() => {})
}

function handleShowOnboarding() {
  chrome.storage.local.remove('bookmarkops.onboardingDismissed').catch(() => {})
  showOnboarding()
}

function renderOnboardingPrompt() {
  const mcpJson = elements.quickSetupCode.textContent || ''
  const template = t('onboardingPromptTemplate')
  elements.onboardingPromptText.value = template.replace('{MCP_CONFIG_JSON}', mcpJson)
}

async function handleCopyOnboardingPrompt() {
  if (!state.agentSessionToken) {
    await agent.handleAgentReveal()
  }
  renderOnboardingPrompt()
  await navigator.clipboard.writeText(elements.onboardingPromptText.value)
  elements.onboardingCopyPromptButton.textContent = t('copied')
  setTimeout(() => { elements.onboardingCopyPromptButton.textContent = t('onboardingCopyPrompt') }, 2000)
}

async function handleLocaleChange(event) {
  const newLocale = event.target.value
  await storeDashboardLocale(newLocale)
  i18n.setLocale(newLocale)
  applyI18n()
}

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n)
  })
}

function handleStageClick(event) {
  const stage = event.target.closest('[data-scroll-to]')
  if (!stage) return
  const target = document.getElementById(stage.dataset.scrollTo)
  if (!target) return
  if (target.hidden) {
    // Visual feedback so the click doesn't look like a no-op: pulse the stage
    // for 1s, then restore its prior state. Pairs with the status pill message.
    const prevState = stage.dataset.state || 'idle'
    if (prevState !== 'waiting') {
      stage.dataset.state = 'waiting'
      setTimeout(() => {
        if (stage.dataset.state === 'waiting') stage.dataset.state = prevState
      }, 1000)
    }
    setStatus(t('stageWaiting'), null)
    setTimeout(() => setStatus(t('ready')), 2000)
    return
  }
  target.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function applyThemeClass(pref) {
  const html = document.documentElement
  html.classList.remove('light-theme', 'dark-theme')
  if (pref === 'light') html.classList.add('light-theme')
  else if (pref === 'dark') html.classList.add('dark-theme')
  html.dataset.theme = pref
}

function updateThemeButton(pref) {
  const labels = { auto: '⚙ Auto', light: '☀ Light', dark: '🌙 Dark' }
  elements.themeToggle.textContent = labels[pref] || labels.auto
  elements.themeToggle.title = { auto: 'Following system (click for Light)', light: 'Light mode (click for Dark)', dark: 'Dark mode (click for Auto)' }[pref] || ''
}

function handlePreferredAIChange() {
  const tool = document.querySelector('input[name="preferredAITool"]:checked')?.value
  elements.customAIURL.style.display = tool === 'custom' ? '' : 'none'
  elements.customAIURLError.hidden = true
  savePreferredAITool()
  document.dispatchEvent(new CustomEvent('preferredAIToolChanged'))
}

function handleCustomAIURLInput() {
  const url = elements.customAIURL.value.trim()
  const invalid = url && (!url.startsWith('https://') || url.startsWith('chrome-extension://'))
  elements.customAIURLError.hidden = !invalid
}

async function savePreferredAITool() {
  const tool = document.querySelector('input[name="preferredAITool"]:checked')?.value || 'claude'
  const customURL = elements.customAIURL.value.trim()
  if (tool === 'custom' && customURL && (!customURL.startsWith('https://') || customURL.startsWith('chrome-extension://'))) return
  await chrome.storage.local.set({ 'bookmarkops.preferredAITool': tool, 'bookmarkops.customAIURL': customURL })
}

async function loadPreferredAITool() {
  const result = await storageGet(chrome.storage.local, 'bookmarkops.preferredAITool').catch(() => null)
  const tool = result?.['bookmarkops.preferredAITool'] || 'chatgpt'
  const urlResult = await storageGet(chrome.storage.local, 'bookmarkops.customAIURL').catch(() => null)
  const customURL = urlResult?.['bookmarkops.customAIURL'] || ''
  const radio = document.querySelector(`input[name="preferredAITool"][value="${tool}"]`)
  if (radio) radio.checked = true
  elements.customAIURL.value = customURL
  elements.customAIURL.style.display = tool === 'custom' ? '' : 'none'
  document.dispatchEvent(new CustomEvent('preferredAIToolChanged'))
}

async function handleThemeToggle() {
  const current = document.documentElement.dataset.theme || 'auto'
  const next = current === 'auto' ? 'light' : current === 'light' ? 'dark' : 'auto'
  applyThemeClass(next)
  updateThemeButton(next)
  await chrome.storage.local.set({ 'bookmarkops.colorTheme': next })
}

async function bootstrap() {
  if (!hasExtensionRuntime()) {
    setStatus(t('unavailable'), 'error')
    return
  }

  try {
    const [bridgeOk] = await Promise.all([checkBridgeHealth(), plan.loadBackups(), agent.loadAgentConfig(), agent.loadPendingAgentApproval(), loadPreferredAITool()])
    const dismissedResult = await storageGet(chrome.storage.local, 'bookmarkops.onboardingDismissed').catch(() => null)
    const dismissed = dismissedResult?.['bookmarkops.onboardingDismissed']
    if (!bridgeOk && !dismissed) {
      showOnboarding()
    }
  } catch (err) {
    recordActivity(err instanceof Error ? err.message : t('stageNeedsReview'), 'error')
  }

  // Show cached stats immediately
  const cachedResult = await storageGet(chrome.storage.local, 'bookmarkops.lastScanStats').catch(() => null)
  const cachedScan = cachedResult?.['bookmarkops.lastScanStats'] || null
  if (cachedScan?.stats) {
    scan.renderStats(cachedScan.stats)
  }

  // Show cached health score immediately
  const cachedHealthResult = await storageGet(chrome.storage.local, 'bookmarkops.lastHealthScore').catch(() => null)
  const cachedHealthScore = cachedHealthResult?.['bookmarkops.lastHealthScore']
  if (cachedHealthScore != null) {
    scan.updateHealthScoreDisplay({ summary: { healthScore: cachedHealthScore } })
  }

  // Auto-scan on open, skip if a scan ran within the last 5 minutes
  const scannedAt = cachedScan?.scannedAt
  const recentScan = scannedAt && (Date.now() - new Date(scannedAt).getTime()) < 5 * 60 * 1000
  if (!recentScan) {
    scan.handleAgentStart()
  }

  // Fast MCP bridge poll while dashboard is open (wakes service worker every 2s)
  setInterval(() => sendMessage({ type: TYPES.mcpBridgePoll }).catch(() => {}), 2000)

  const monitorResult = await storageGet(chrome.storage.local, 'bookmarkops.bridgeMonitorEnabled').catch(() => null)
  const monitorEnabled = monitorResult?.['bookmarkops.bridgeMonitorEnabled'] ?? true
  elements.bridgeMonitorEnabled.checked = monitorEnabled
  if (monitorEnabled) {
    startBridgeMonitor()
  } else {
    stopBridgeMonitor()
  }
}

function sendMessage(payload) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { source: MESSAGE_SOURCE, ...payload },
      (response) => {
        const runtimeError = chrome.runtime.lastError
        if (runtimeError) { reject(new Error(runtimeError.message)); return }
        if (!response?.ok) { reject(new Error(response?.error || 'BookmarkOps request failed.')); return }
        resolve(response.data)
      },
    )
  })
}

function setStat(name, value) {
  document.querySelector(`[data-stat="${name}"]`).textContent = formatNumber(value)
}

function setStatus(text, tone = 'default') {
  elements.statusPill.textContent = text
  elements.statusPill.dataset.tone = tone
}

function setStage(name, stateName, label) {
  const stage = elements.stageList.querySelector(`[data-stage="${name}"]`)
  if (!stage) return
  stage.dataset.state = stateName
  stage.querySelector('em').textContent = label
}

function recordActivity(message, tone = 'default') {
  const item = document.createElement('li')
  if (tone !== 'default') item.dataset.tone = tone
  const time = document.createElement('time')
  time.textContent = new Intl.DateTimeFormat(i18n.locale.replace('_', '-'), {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date())
  const text = document.createElement('span')
  text.textContent = message
  item.append(time, text)
  elements.activityLog.prepend(item)

  while (elements.activityLog.children.length > 8) {
    elements.activityLog.lastElementChild.remove()
  }
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(value || 0)
}

function groupBy(items, keyFn) {
  return items.reduce((groups, item) => {
    const key = keyFn(item)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(item)
    return groups
  }, new Map())
}

function hasExtensionRuntime() {
  return Boolean(globalThis.chrome?.runtime?.sendMessage)
}
