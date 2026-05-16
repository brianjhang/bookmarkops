export function createAgentSlice(ctx) {
  const { state, elements, t, sendMessage, setStatus, setStage, recordActivity, TYPES } = ctx
  let excludedOpIndices = new Set()

  async function loadAgentConfig() {
    const config = await sendMessage({ type: TYPES.agentConfigGet })
    state.agentSessionToken = ''
    state.agentTokenRevealed = false
    elements.agentEnabled.checked = config.enabled
    elements.agentToken.value = config.maskedSessionToken || ''
    renderAgentConfig(config)
    renderQuickSetup(config.maskedSessionToken || '')
    resetRevealPhrase()
    return config
  }

  // Gates the Reveal button on a typed REVEAL phrase to match the
  // APPLY / RESTORE / DELETE BACKUP pattern. When the token is already
  // revealed the button switches to Hide and is always enabled (going
  // back to masked is the safer direction and doesn't need a phrase).
  function refreshRevealControls() {
    if (state.agentTokenRevealed) {
      elements.agentRevealButton.disabled = false
      elements.agentRevealPhrase.hidden = true
    } else {
      elements.agentRevealPhrase.hidden = false
      elements.agentRevealButton.disabled = elements.agentRevealPhrase.value !== 'REVEAL'
    }
  }

  function resetRevealPhrase() {
    elements.agentRevealPhrase.value = ''
    refreshRevealControls()
  }

  async function handleAgentReveal() {
    if (state.agentTokenRevealed) {
      state.agentTokenRevealed = false
      const masked = elements.agentToken.dataset.masked || ''
      elements.agentToken.value = masked
      elements.agentRevealButton.textContent = t('reveal')
      renderQuickSetup(masked)
      resetRevealPhrase()
      return
    }
    if (elements.agentRevealPhrase.value !== 'REVEAL') {
      // Defense in depth — the button is disabled in this state, but if
      // a hotkey or programmatic click bypasses that, refuse here too.
      return
    }
    const config = await sendMessage({ type: TYPES.agentConfigReveal })
    state.agentSessionToken = config.sessionToken || ''
    state.agentTokenRevealed = true
    elements.agentToken.dataset.masked = config.maskedSessionToken || ''
    elements.agentToken.value = state.agentSessionToken || config.maskedSessionToken || ''
    elements.agentRevealButton.textContent = t('hide')
    renderAgentConfig(config)
    renderQuickSetup(state.agentSessionToken)
    resetRevealPhrase()
  }

  async function handleAgentCopy() {
    if (!state.agentSessionToken) {
      await handleAgentReveal()
    }
    if (!state.agentSessionToken) {
      // Reveal was gated by the phrase; tell the user instead of silently failing.
      setStatus(t('revealPhraseHint'))
      return
    }
    await navigator.clipboard.writeText(state.agentSessionToken)
    recordActivity(t('agentTokenCopied'))
    elements.agentCopyButton.textContent = t('copied')
    setTimeout(() => { elements.agentCopyButton.textContent = t('copy') }, 2000)
  }

  async function handleAgentRotate() {
    const config = await sendMessage({ type: TYPES.agentConfigRotate })
    state.agentSessionToken = ''
    state.agentTokenRevealed = false
    elements.agentToken.value = config.maskedSessionToken || ''
    elements.agentRevealButton.textContent = t('reveal')
    renderAgentConfig(config)
    renderQuickSetup(config.maskedSessionToken || '')
    resetRevealPhrase()
    recordActivity(t('agentTokenRotated'))
  }

  async function handleAgentSave() {
    const config = await sendMessage({
      type: TYPES.agentConfigSet,
      config: {
        enabled: elements.agentEnabled.checked,
        token: state.agentTokenRevealed ? state.agentSessionToken : '',
      },
    })
    state.agentSessionToken = ''
    state.agentTokenRevealed = false
    elements.agentToken.value = config.maskedSessionToken || ''
    elements.agentRevealButton.textContent = t('reveal')
    renderAgentConfig(config)
    renderQuickSetup(config.maskedSessionToken || '')
    resetRevealPhrase()

    if (!config.hasToken) {
      elements.agentStartButton.hidden = true
      elements.setupPrompt.hidden = false
    } else {
      elements.agentStartButton.hidden = false
      elements.setupPrompt.hidden = true
    }
  }

  async function loadPendingAgentApproval() {
    state.pendingAgentApproval = await sendMessage({ type: TYPES.agentPendingApprovalGet })
    renderPendingAgentApproval(state.pendingAgentApproval)
  }

  async function handleApproveAgentRequest() {
    const request = state.pendingAgentApproval
    if (!request || request.status !== 'pending') return

    const phrase = requiredPhraseForRequest(request)
    if (elements.pendingApprovalPhrase.value !== phrase) return

    elements.approveAgentRequestButton.disabled = true
    elements.approveAgentRequestButton.textContent = t('applying')
    setStatus(t('statusApproving'))
    setStage('pendingApproval', 'done', t('stageApproved'))
    setStage('execute', 'active', actionStageLabel(request))
    try {
      const response = await sendMessage({
        type: TYPES.agentPendingApprovalApprove,
        approval: { source: 'dashboard', phrase, excludedIndices: [...excludedOpIndices] },
      })
      excludedOpIndices = new Set()
      state.pendingAgentApproval = response.request
      elements.agentApprovalOutput.textContent = formatApprovalOutput(response, request)
      renderPendingAgentApproval(response.request)

      if (request.type === 'applyPlan') {
        await ctx.loadBackups()
        await ctx.handleScan()
        setStage('verified', response.result?.ok ? 'done' : 'blocked', response.result?.ok ? t('stagePassed') : t('stageNeedsReview'))
        setStatus(t(response.result?.ok ? 'statusVerified' : 'statusReview'), response.result?.ok ? 'default' : 'error')
      } else if (request.type === 'restoreBackup') {
        await ctx.handleScan()
        setStage('verified', response.result?.verify?.ok ? 'done' : 'blocked', response.result?.verify?.ok ? t('stagePassed') : t('stageNeedsReview'))
        setStatus(t(response.result?.verify?.ok ? 'statusRestored' : 'statusReview'), response.result?.verify?.ok ? 'default' : 'error')
      } else {
        await ctx.loadBackups()
        setStage('verified', 'done', t('stageBackupRemoved'))
        setStatus(t('ready'))
      }

      setStage('execute', 'done', t('done'))
      recordActivity(t('actApproved', { title: requestTitle(request) }))
    } catch (error) {
      setStage('execute', 'blocked', t('stageNeedsReview'))
      setStatus(t('stageNeedsReview'), 'error')
      recordActivity(error instanceof Error ? error.message : t('stageNeedsReview'), 'error')
      refreshAgentApprovalControls()
    } finally {
      elements.approveAgentRequestButton.textContent = t('approveSelected')
    }
  }

  async function handleRejectAgentRequest() {
    if (!state.pendingAgentApproval || state.pendingAgentApproval.status !== 'pending') return

    const rejected = await sendMessage({ type: TYPES.agentPendingApprovalReject })
    state.pendingAgentApproval = rejected
    renderPendingAgentApproval(rejected)
    setStage('pendingApproval', 'blocked', t('stageRejected'))
    recordActivity(t('actRejected', { title: requestTitle(rejected) }), 'error')
  }

  function renderAgentConfig(config) {
    elements.agentOutput.textContent = JSON.stringify({
      enabled: config.enabled,
      hasToken: config.hasToken,
      safety: 'agent can scan/report/submit plan/dryRun and request apply/restore/delete backup; dashboard approval is required before execution',
      updatedAt: config.updatedAt,
    }, null, 2)
  }

  function renderQuickSetup(token) {
    const displayToken = token || '…'
    const config = {
      mcpServers: {
        bookmarkops: {
          command: 'npx',
          args: ['-y', '@bookmarkops/mcp'],
          env: { BOOKMARKOPS_TOKEN: displayToken },
        },
      },
    }
    const json = JSON.stringify(config, null, 2)
    elements.quickSetupCode.textContent = json
  }

  function renderPendingAgentApproval(request) {
    state.pendingAgentApproval = request
    excludedOpIndices = new Set()
    elements.pendingApprovalPhrase.value = ''
    elements.pendingApprovalAcknowledgement.checked = false
    elements.pendingApprovalAcknowledgement.disabled = true

    if (!request) {
      elements.approvalSection.hidden = true
      elements.pendingApprovalEmpty.hidden = false
      elements.pendingApprovalCard.hidden = true
      setStage('pendingApproval', 'idle', t('waiting'))
      refreshAgentApprovalControls()
      return
    }

    elements.approvalSection.hidden = false

    // Completed state: show read-only card with follow-up copy button
    if (request.status === 'completed') {
      elements.pendingApprovalEmpty.hidden = true
      elements.pendingApprovalCard.hidden = false
      elements.pendingApprovalStatus.textContent = t('done')
      elements.pendingApprovalStatus.dataset.tone = 'default'
      elements.pendingApprovalTitle.textContent = requestTitle(request)
      elements.pendingApprovalMeta.textContent = request.requestedAt
        ? new Date(request.requestedAt).toLocaleString()
        : '--'
      elements.pendingApprovalPreview.innerHTML = ''
      const hint = document.createElement('p')
      hint.className = 'helper-text'
      hint.textContent = t('completedHint')
      const copyBtn = document.createElement('button')
      copyBtn.type = 'button'
      copyBtn.textContent = t('copyFollowUpPrompt')
      copyBtn.style.cssText = 'margin-top:10px;margin-right:8px;'
      copyBtn.addEventListener('click', async () => {
        await navigator.clipboard.writeText(t('followUpPromptTemplate'))
        copyBtn.textContent = t('copied')
        setTimeout(() => { copyBtn.textContent = t('copyFollowUpPrompt') }, 2000)
      })
      const clearBtn = document.createElement('button')
      clearBtn.type = 'button'
      clearBtn.textContent = t('clearRecord')
      clearBtn.style.cssText = 'margin-top:10px;background:var(--panel);color:var(--muted);border:1px solid var(--border);font-size:13px;'
      clearBtn.addEventListener('click', async () => {
        await chrome.storage.local.remove('bookmarkops.pendingAgentApproval')
        state.pendingAgentApproval = null
        renderPendingAgentApproval(null)
      })
      elements.pendingApprovalPreview.append(hint, copyBtn, clearBtn)
      setStage('pendingApproval', 'done', t('done'))
      refreshAgentApprovalControls()
      return
    }

    // Rejected state: show read-only card with rejected badge + clear button
    if (request.status === 'rejected') {
      elements.pendingApprovalEmpty.hidden = true
      elements.pendingApprovalCard.hidden = false
      elements.pendingApprovalStatus.textContent = t('approvalRejected')
      elements.pendingApprovalStatus.dataset.tone = 'error'
      elements.pendingApprovalTitle.textContent = requestTitle(request)
      elements.pendingApprovalMeta.textContent = request.requestedAt
        ? new Date(request.requestedAt).toLocaleString()
        : '--'
      elements.pendingApprovalPreview.innerHTML = ''
      const hint = document.createElement('p')
      hint.className = 'helper-text'
      hint.textContent = t('rejectedHint')
      const clearBtn = document.createElement('button')
      clearBtn.type = 'button'
      clearBtn.textContent = t('clearRecord')
      clearBtn.style.cssText = 'margin-top:10px;background:var(--panel);color:var(--muted);border:1px solid var(--border);font-size:13px;'
      clearBtn.addEventListener('click', async () => {
        await chrome.storage.local.remove('bookmarkops.pendingAgentApproval')
        state.pendingAgentApproval = null
        renderPendingAgentApproval(null)
      })
      elements.pendingApprovalPreview.append(hint, clearBtn)
      refreshAgentApprovalControls()
      return
    }

    elements.pendingApprovalEmpty.hidden = true
    elements.pendingApprovalCard.hidden = false
    elements.pendingApprovalStatus.textContent = localizeRequestStatus(request.status)
    elements.pendingApprovalStatus.dataset.tone = request.status === 'pending' ? 'warning' : request.status === 'completed' ? 'default' : 'error'
    elements.pendingApprovalTitle.textContent = requestTitle(request)
    elements.pendingApprovalMeta.textContent = requestMeta(request)
    elements.pendingApprovalPhrase.placeholder = requiredPhraseForRequest(request)
    renderPendingApprovalPreview(request)
    elements.pendingApprovalAcknowledgement.disabled = !(request.type === 'applyPlan' && request.status === 'pending' && requestCanBeApproved(request))

    const isCompleted = request.status === 'completed' || request.status === 'rejected'
    elements.pendingApprovalAcknowledgement.closest('.review-acknowledgement').hidden = isCompleted
    elements.pendingApprovalPhrase.hidden = isCompleted
    elements.pendingApprovalPhrase.nextElementSibling.hidden = isCompleted
    elements.approveAgentRequestButton.closest('.button-row').hidden = isCompleted

    if (request.status === 'pending') {
      setStage('pendingApproval', requestCanBeApproved(request) ? 'active' : 'blocked', requestCanBeApproved(request) ? t('stageWaitingApproval') : t('stageCannotApprove'))
    } else {
      setStage('pendingApproval', request.status === 'completed' ? 'done' : 'blocked', request.status === 'completed' ? t('done') : t('stageRejected'))
    }

    refreshAgentApprovalControls()
  }

  function renderPendingApprovalPreview(request) {
    elements.pendingApprovalPreview.innerHTML = ''

    if (request.type === 'applyPlan') {
      // Natural-language summary line first (E2)
      const ops = request.dryRun?.preview || request.plan?.operations || []
      const deleteCount = ops.filter((op) => op.type === 'deleteBookmark' || op.type === 'deleteEmptyFolder').length
      const moveCount = ops.filter((op) => op.type === 'moveBookmark').length
      const renameCount = ops.filter((op) => op.type === 'renameNode').length
      const summaryLine = document.createElement('p')
      summaryLine.className = 'approval-summary-line'
      summaryLine.textContent = t('approvalSummaryLine', { deleteCount, moveCount, renameCount })
      elements.pendingApprovalPreview.append(summaryLine)

      appendApprovalFact(t('riskFact'), request.summary?.riskLevel || 'unknown')
      appendApprovalFact(t('operationsFact'), request.summary?.operationCount || 0)
      appendApprovalFact(t('validationFact'), request.validation?.ok ? 'ok' : `blocked${request.validation?.error ? ` — ${request.validation.error}` : ''}`)
      appendApprovalFact(t('dryRunFact'), request.dryRun?.ok ? 'ok' : `blocked${request.dryRun?.error ? ` — ${request.dryRun.error}` : ''}`)
      if (request.status !== 'completed') {
        const previewOps = request.dryRun?.preview ||
          (request.plan?.operations || []).map((op, i) => {
            const isDelete = op.type === 'deleteBookmark' || op.type === 'deleteEmptyFolder'
            const before = op.expectedTitle ? { title: op.expectedTitle } : null
            const after = isDelete
              ? { removed: true }
              : op.type === 'renameNode'
                ? { title: op.newTitle }
                : op.type === 'moveBookmark'
                  ? { title: op.expectedTitle, parentId: op.newParentId }
                  : null
            return { ...op, index: i, status: request.validation?.ok === false ? 'error' : 'pending', risk: op.riskLevel || 'low', before, after }
          })
        ctx.renderOperationReviewCards(previewOps, elements.pendingApprovalPreview, { compact: true })
        excludedOpIndices = new Set()
        elements.pendingApprovalPreview.querySelectorAll('.operation-card').forEach((card) => {
          const opIndex = Number(card.dataset.opIndex)
          const toggle = document.createElement('button')
          toggle.className = 'exclude-toggle'
          toggle.type = 'button'
          toggle.textContent = t('excludeOp')
          toggle.dataset.excluded = 'false'
          toggle.addEventListener('click', () => {
            const isExcluded = toggle.dataset.excluded === 'true'
            if (isExcluded) {
              excludedOpIndices.delete(opIndex)
              toggle.dataset.excluded = 'false'
              toggle.textContent = t('excludeOp')
              card.dataset.excluded = 'false'
            } else {
              excludedOpIndices.add(opIndex)
              toggle.dataset.excluded = 'true'
              toggle.textContent = t('includeOperation')
              card.dataset.excluded = 'true'
            }
          })
          card.querySelector('.operation-card-header')?.append(toggle)
        })
      }
      return
    }

    appendApprovalFact(t('backupIdFact'), request.backupId)
    appendApprovalFact(t('createdFact'), request.backup?.createdAt || '--')
    appendApprovalFact(t('bookmarksFact'), request.backup?.stats?.bookmarkCount || 0)
    appendApprovalFact(t('foldersFact'), request.backup?.stats?.folderCount || 0)
  }

  function appendApprovalFact(label, value) {
    const item = document.createElement('div')
    item.className = 'approval-fact'
    const key = document.createElement('span')
    key.textContent = label
    const content = document.createElement('strong')
    content.textContent = String(value)
    item.append(key, content)
    elements.pendingApprovalPreview.append(item)
  }

  function refreshAgentApprovalControls() {
    const request = state.pendingAgentApproval
    const pending = request?.status === 'pending'
    const acknowledgementOk = request?.type !== 'applyPlan' || elements.pendingApprovalAcknowledgement.checked
    elements.approveAgentRequestButton.disabled = !(
      pending
      && requestCanBeApproved(request)
      && acknowledgementOk
      && elements.pendingApprovalPhrase.value === requiredPhraseForRequest(request)
    )
    elements.rejectAgentRequestButton.disabled = !pending
  }

  function requestTitle(request) {
    if (request.type === 'applyPlan') return t('agentRequestedApply')
    if (request.type === 'restoreBackup') return t('agentRequestedRestore')
    if (request.type === 'deleteBackup') return t('agentRequestedDeleteBackup')
    return t('agentRequest')
  }

  function requestMeta(request) {
    const requestedAt = request.requestedAt
      ? new Date(request.requestedAt).toLocaleString()
      : '--'
    const phrase = requiredPhraseForRequest(request)
    return `${requestedAt} · ${phrase}`
  }

  function localizeRequestStatus(status) {
    if (status === 'pending') return t('statusPending')
    if (status === 'completed') return t('done')
    if (status === 'rejected') return t('stageRejected')
    return status
  }

  function requiredPhraseForRequest(request) {
    return request?.requiredPhrase || t('statusPending')
  }

  function requestCanBeApproved(request) {
    if (!request) return false
    if (request.type === 'applyPlan') {
      return Boolean(request.validation?.ok && request.dryRun?.ok)
    }
    return Boolean(request.backupId)
  }

  function actionStageLabel(request) {
    if (request.type === 'restoreBackup') return t('stageRestoring')
    if (request.type === 'deleteBackup') return t('stageDeletingBackup')
    return t('stageExecuting')
  }

  function formatApprovalOutput(response, request) {
    if (request.type === 'applyPlan') {
      const ok = response.result?.ok
      const backupId = response.result?.backup?.id
      const applied = response.result?.applied?.length ?? response.result?.applied ?? 0
      const lines = [
        t(ok ? 'verifySummaryOk' : 'verifySummaryFail'),
        `${t('verifyApplied')}: ${applied}`,
      ]
      if (backupId) lines.push(`${t('verifyBackupLabel')}: ${backupId}`)
      lines.push(ok ? t('verifyAllClean') : t('verifyRestoreHint', { backupId: backupId || '?' }))
      return lines.join('\n')
    }
    if (request.type === 'restoreBackup') {
      return t(response.result?.verify?.ok ? 'restoreSummaryOk' : 'restoreSummaryFail')
    }
    return JSON.stringify(summarizeAgentApprovalResponse(response), null, 2)
  }

  function summarizeAgentApprovalResponse(response) {
    const request = response.request
    if (request.type === 'applyPlan') {
      return {
        requestStatus: request.status,
        ok: response.result?.ok,
        backupId: response.result?.backup?.id,
        applied: response.result?.applied?.length || 0,
        verify: response.result?.verify,
      }
    }

    if (request.type === 'restoreBackup') {
      return {
        requestStatus: request.status,
        backupId: response.result?.backup?.id,
        verify: response.result?.verify,
      }
    }

    return {
      requestStatus: request.status,
      deleted: response.result?.deleted,
      backupId: response.result?.backupId,
    }
  }

  return {
    loadAgentConfig,
    handleAgentReveal,
    refreshRevealControls,
    handleAgentCopy,
    handleAgentRotate,
    handleAgentSave,
    loadPendingAgentApproval,
    handleApproveAgentRequest,
    handleRejectAgentRequest,
    refreshAgentApprovalControls,
  }
}
