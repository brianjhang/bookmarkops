export function createPlanSlice(ctx) {
  const { state, elements, t, sendMessage, setStatus, recordActivity, setStat, TYPES } = ctx

  async function handleRestore() {
    if (!state.selectedBackupId || elements.restorePhrase.value !== 'RESTORE') return

    elements.restoreButton.disabled = true
    setStatus(t('stageRestoring'))
    try {
      const result = await sendMessage({
        type: TYPES.restoreBackup,
        backupId: state.selectedBackupId,
        approval: { source: 'dashboard', phrase: 'RESTORE' },
      })
      elements.restorePhrase.value = ''
      renderVerifySummary(elements.restoreOutput, { ok: result.verify.ok, type: 'restore', backupId: state.selectedBackupId })
      await ctx.handleScan()
      recordActivity(t('actRestoreDone', { verifyStatus: t(result.verify.ok ? 'actApplyVerifyOk' : 'actApplyVerifyFail') }), result.verify.ok ? 'default' : 'error')
      setStatus(t(result.verify.ok ? 'statusRestored' : 'statusReview'), result.verify.ok ? 'default' : 'error')
    } catch (error) {
      setStatus(t('stageNeedsReview'), 'error')
      recordActivity(error instanceof Error ? error.message : t('stageNeedsReview'), 'error')
    } finally {
      refreshActionControls()
    }
  }

  async function handleDeleteBackup() {
    if (!state.selectedBackupId || elements.deleteBackupPhrase.value !== 'DELETE BACKUP') return

    elements.deleteBackupButton.disabled = true
    setStatus(t('stageDeletingBackup'))
    try {
      const result = await sendMessage({
        type: TYPES.deleteBackup,
        backupId: state.selectedBackupId,
        approval: { source: 'dashboard', phrase: 'DELETE BACKUP' },
      })
      elements.restoreOutput.textContent = JSON.stringify(result, null, 2)
      state.selectedBackupId = ''
      elements.restorePhrase.value = ''
      elements.deleteBackupPhrase.value = ''
      await loadBackups()
      recordActivity(t('actBackupDeleted', { backupId: result.backupId }))
      setStatus(t('ready'))
    } catch (error) {
      setStatus(t('stageNeedsReview'), 'error')
      recordActivity(error instanceof Error ? error.message : t('stageNeedsReview'), 'error')
    } finally {
      refreshActionControls()
    }
  }

  function handleBackupSelection(event) {
    state.selectedBackupId = event.target.value
    const backup = state.backups.find((item) => item.id === state.selectedBackupId)
    elements.restoreOutput.textContent = backup ? JSON.stringify(backup.stats, null, 2) : t('noBackup')
    refreshActionControls()
  }

  async function loadBackups() {
    state.backups = await sendMessage({ type: TYPES.listBackups })
    setStat('backupCount', state.backups.length)
    renderBackups()
    refreshActionControls()
  }

  function renderOperationReviewCards(preview, container, { compact = false } = {}) {
    const groups = [
      {
        id: 'destructive',
        title: t('destructiveOperations'),
        description: t('destructiveOperationsHelp'),
        risk: 'high',
        items: preview.filter((item) => item.type === 'deleteBookmark' || item.type === 'deleteEmptyFolder'),
      },
      {
        id: 'organize',
        title: t('organizeOperations'),
        description: t('organizeOperationsHelp'),
        risk: 'medium',
        items: preview.filter((item) => item.type !== 'deleteBookmark' && item.type !== 'deleteEmptyFolder'),
      },
    ].filter((group) => group.items.length > 0)

    const list = document.createElement('div')
    list.className = compact ? 'review-card-list compact' : 'review-card-list'

    for (const group of groups) {
      const section = document.createElement('section')
      section.className = 'operation-group'
      section.dataset.risk = group.risk

      const header = document.createElement('header')
      header.className = 'operation-group-header'
      const title = document.createElement('h3')
      title.textContent = `${group.title} (${group.items.length})`
      const description = document.createElement('p')
      description.textContent = group.description
      header.append(title, description)
      section.append(header)

      for (const item of group.items) {
        section.append(renderOperationCard(item))
      }

      list.append(section)
    }

    container.append(list)
  }

  function renderOperationCard(item) {
    const card = document.createElement('article')
    card.className = `operation-card ${item.status}`
    card.dataset.risk = item.risk || 'low'
    card.dataset.opIndex = String(item.index)

    const header = document.createElement('div')
    header.className = 'operation-card-header'
    const title = document.createElement('strong')
    title.textContent = `#${item.index + 1} ${item.type}`
    const badges = document.createElement('span')
    badges.className = 'operation-card-badges'
    badges.append(renderBadge(item.status, 'review-status'), renderBadge(item.risk || 'low', `risk-badge ${item.risk || 'low'}`))
    header.append(title, badges)

    const before = renderReviewField(t('before'), renderNodeReview(item.before))
    const after = renderReviewField(t('after'), renderNodeReview(item.after, { after: true }))
    const reason = renderReviewField(t('reason'), item.description || item.message || '--')
    const checks = renderReviewField(t('checks'), renderChecks(item.checks || []))
    const related = renderReviewField(t('related'), renderRelatedBookmarks(item.relatedBookmarks || [], item.targetId))

    card.append(header, before, after, reason, checks, related)
    return card
  }

  function renderReviewField(labelText, content) {
    const field = document.createElement('div')
    field.className = 'operation-field'
    const label = document.createElement('span')
    label.className = 'operation-field-label'
    label.textContent = labelText
    const value = document.createElement('div')
    value.className = 'operation-field-value'
    if (content instanceof Node) {
      value.append(content)
    } else {
      value.textContent = String(content ?? '--')
    }
    field.append(label, value)
    return field
  }

  function renderBadge(text, className) {
    const badge = document.createElement('span')
    badge.className = className
    badge.textContent = text
    return badge
  }

  function renderVerifySummary(container, { ok, backupId, applied, type = 'apply' }) {
    const lines = []
    if (type === 'restore') {
      lines.push(t(ok ? 'restoreSummaryOk' : 'restoreSummaryFail'))
    } else {
      lines.push(t(ok ? 'verifySummaryOk' : 'verifySummaryFail'))
      if (applied !== undefined) lines.push(`${t('verifyApplied')}: ${applied}`)
      if (backupId) lines.push(`${t('verifyBackupLabel')}: ${backupId}`)
      lines.push(ok ? t('verifyAllClean') : t('verifyRestoreHint', { backupId: backupId || '?' }))
    }
    container.textContent = lines.join('\n')
  }

  function renderNodeReview(node, { after = false } = {}) {
    const wrapper = document.createElement('div')
    wrapper.className = 'node-review'

    if (!node) {
      wrapper.textContent = after ? '--' : t('nodeMissing')
      return wrapper
    }

    const title = document.createElement('strong')
    title.textContent = node.removed ? t('nodeDeleted') : node.title
    const path = document.createElement('span')
    path.textContent = node.path || node.parentPath || '--'
    wrapper.append(title, path)

    if (node.url) {
      const url = document.createElement('small')
      url.textContent = node.url
      wrapper.append(url)
    }

    return wrapper
  }

  function renderChecks(checks) {
    const list = document.createElement('div')
    list.className = 'check-list'
    if (!checks.length) {
      list.textContent = t('checksOk')
      return list
    }

    for (const check of checks) {
      const item = document.createElement('span')
      item.className = check.ok ? 'check-ok' : 'check-failed'
      item.textContent = `${check.ok ? '✓' : '×'} ${check.name}`
      list.append(item)
    }

    return list
  }

  function renderRelatedBookmarks(bookmarks, targetId) {
    const wrapper = document.createElement('div')
    wrapper.className = 'related-list'
    const related = bookmarks.filter((bookmark) => String(bookmark.id) !== String(targetId))
    if (!related.length) {
      wrapper.textContent = '--'
      return wrapper
    }

    for (const bookmark of related) {
      const item = document.createElement('span')
      item.textContent = `${bookmark.title} | ${bookmark.parentPath}`
      wrapper.append(item)
    }

    return wrapper
  }

  function renderBackups() {
    const previousSelectedId = state.selectedBackupId
    elements.backupSelect.innerHTML = ''
    const placeholder = document.createElement('option')
    placeholder.value = ''
    placeholder.textContent = t('selectBackup')
    elements.backupSelect.append(placeholder)

    if (!state.backups.length) {
      const empty = document.createElement('option')
      empty.disabled = true
      empty.textContent = t('noBackup')
      elements.backupSelect.append(empty)
    }

    for (const backup of state.backups) {
      const option = document.createElement('option')
      option.value = backup.id
      option.textContent = `${backup.createdAt} - ${backup.stats.bookmarkCount} ${t('bookmarks')}`
      elements.backupSelect.append(option)
    }

    if (state.backups.some((backup) => backup.id === previousSelectedId)) {
      state.selectedBackupId = previousSelectedId
      elements.backupSelect.value = previousSelectedId
    } else {
      state.selectedBackupId = ''
      elements.backupSelect.value = ''
    }
  }

  function refreshActionControls() {
    elements.restoreButton.disabled = !(state.selectedBackupId && elements.restorePhrase.value === 'RESTORE')
    elements.deleteBackupButton.disabled = !(state.selectedBackupId && elements.deleteBackupPhrase.value === 'DELETE BACKUP')
  }

  return {
    handleRestore,
    handleDeleteBackup,
    handleBackupSelection,
    loadBackups,
    refreshActionControls,
    renderOperationReviewCards,
    renderVerifySummary,
  }
}
