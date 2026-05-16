import { generateAgentOnboardingInsights } from '../core/insight-generator.js'

export function createScanSlice(ctx) {
  const { state, elements, t, sendMessage, setStatus, setStage, recordActivity, setStat, TYPES } = ctx

  async function handleScan() {
    setStatus(t('scanning'))
    setStage('analyze', 'active', t('scanning'))
    const scanResult = await sendMessage({ type: TYPES.scan })
    state.scanResult = scanResult
    renderStats(scanResult.stats)
    renderUsageHealth(scanResult.stats)
    renderBookmarkMap()
    setStage('analyze', 'done', t('done'))
    recordActivity(t('actScanDone', { bookmarkCount: scanResult.stats.bookmarkCount, folderCount: scanResult.stats.folderCount }))
    setStatus(t('ready'))
  }

  async function handleAgentStart() {
    if (!ctx.hasExtensionRuntime()) return

    elements.reanalyzeButton.disabled = true
    elements.agentStartButton.disabled = true
    setStatus(t('agentWorking'))
    setStage('analyze', 'active', t('scanning'))
    recordActivity(t('agentStartActivity'))

    try {
      const scanResult = await sendMessage({ type: TYPES.scan })
      state.scanResult = scanResult
      state.agentInsights = generateAgentOnboardingInsights(scanResult)
      renderStats(scanResult.stats)
      renderUsageHealth(scanResult.stats)
      renderBookmarkMap()
      renderAgentFindings(state.agentInsights)
      setStage('analyze', 'done', t('done'))

      setStage('report', 'active', t('preparing'))
      const report = await sendMessage({ type: TYPES.report, format: 'json' })
      setStage('report', 'done', t('stageReport'))
      recordActivity(t('actScanDone', { bookmarkCount: report.stats.bookmarkCount, folderCount: report.stats.folderCount }))

      setStage('pendingApproval', 'idle', t('waiting'))
      setStage('execute', 'idle', t('locked'))
      setStage('verified', 'idle', t('idle'))

      // Save health score for popup display
      const healthScore = state.agentInsights?.summary?.healthScore ?? null
      if (healthScore !== null) {
        chrome.storage.local.set({ 'bookmarkops.lastHealthScore': healthScore })
      }
      updateHealthScoreDisplay(state.agentInsights)

      setStatus(t('ready'))
    } catch (error) {
      setStatus(t('stageBlocked'), 'error')
      recordActivity(error instanceof Error ? error.message : t('agentOnboardingFailed'), 'error')
    } finally {
      elements.reanalyzeButton.disabled = false
      elements.agentStartButton.disabled = false
    }
  }

  function updateHealthScoreDisplay(insights) {
    const score = insights?.summary?.healthScore ?? null
    const dormantCount = insights?.summary?.dormantCount ?? 0
    const dupeCount = insights?.summary?.duplicateUrlCount ?? 0

    if (score === null) {
      elements.healthScore.textContent = '--'
      elements.healthScore.dataset.tone = 'unknown'
      elements.healthScore.setAttribute('aria-label', `${t('healthScoreLabel')}: --`)
      elements.healthScoreContext.textContent = ''
      return
    }

    const tone = score >= 80 ? 'good' : score >= 60 ? 'warning' : 'danger'
    const toneLabel = score >= 80 ? t('healthScoreGood') : score >= 60 ? t('healthScoreWarning') : t('healthScoreDanger')
    elements.healthScore.textContent = String(score)
    elements.healthScore.dataset.tone = tone
    elements.healthScore.setAttribute('aria-label', `${t('healthScoreLabel')}: ${score} (${toneLabel})`)
    elements.healthScoreContext.textContent = t('healthScoreContext', { dormantCount, dupeCount })
  }

  function renderStats(stats) {
    setStat('bookmarkCount', stats.bookmarkCount)
    setStat('folderCount', stats.folderCount)
    setStat('backupCount', state.backups.length)
  }

  function renderUsageHealth(stats = {}) {
    elements.usageHealth.innerHTML = ''
    const buckets = stats.usageBuckets || {}
    const total = Math.max(0, stats.bookmarkCount || 0)
    const bucketOrder = [
      ['frequent', 'frequentHelp'],
      ['recent', 'recentHelp'],
      ['stale', 'staleHelp'],
      ['dormant', 'dormantHelp'],
      ['unknown', 'unknownHelp'],
    ]

    const fragment = document.createDocumentFragment()
    for (const [bucket, helpKey] of bucketOrder) {
      const count = buckets[bucket] || 0
      const card = document.createElement('div')
      card.className = `usage-card ${bucket}`
      const label = document.createElement('span')
      label.textContent = t(bucket)
      const value = document.createElement('strong')
      value.textContent = ctx.formatNumber(count)
      const helper = document.createElement('em')
      helper.textContent = `${total ? Math.round((count / total) * 100) : 0}% | ${t(helpKey)}`
      card.append(label, value, helper)
      fragment.append(card)
    }

    elements.usageHealth.append(fragment)

    if (total > 0) {
      const dormantCount = buckets.dormant || 0
      const unknownCount = buckets.unknown || 0
      if (dormantCount > 0 || unknownCount > 0) {
        const insight = document.createElement('p')
        insight.className = 'usage-health-insight'
        insight.textContent = t('usageHealthInsight', {
          dormantCount: ctx.formatNumber(dormantCount),
          unknownCount: ctx.formatNumber(unknownCount),
        })
        elements.usageHealth.append(insight)
      }
    }
  }

  function renderBookmarkMap() {
    const scan = state.scanResult
    elements.bookmarkMapOutput.innerHTML = ''

    if (!scan?.nodes?.length) {
      elements.bookmarkMapOutput.textContent = t('mapEmpty')
      elements.bookmarkMapOutput.classList.add('empty-state')
      return
    }

    elements.bookmarkMapOutput.classList.remove('empty-state')
    const folderNodes = scan.nodes.filter((node) => node.type === 'folder')

    const duplicateUrls = new Set(
      [...scan.bookmarks
        .reduce((counts, bookmark) => {
          counts.set(bookmark.url, (counts.get(bookmark.url) || 0) + 1)
          return counts
        }, new Map())
        .entries()]
        .filter(([, count]) => count > 1)
        .map(([url]) => url),
    )

    const nodesByParentPath = ctx.groupBy(scan.nodes.slice(1), (node) => node.parentPath)
    const root = folderNodes[0]
    if (!root) {
      elements.bookmarkMapOutput.textContent = t('mapEmpty')
      return
    }
    elements.bookmarkMapOutput.append(renderFolderNode(root, nodesByParentPath, scan, duplicateUrls))
  }

  function buildFolderAIContext(folderTitle, bookmarks) {
    const lines = [`My bookmarks: ${folderTitle} (${bookmarks.length} items)`, '']
    for (const bm of bookmarks) {
      lines.push(`- ${bm.title || '(untitled)'}: ${bm.url}`)
    }
    return lines.join('\n')
  }

  function buildRecommendationAIContext(recommendation) {
    const recTitle = localizeRecommendationTitle(recommendation.id, recommendation.title)
    const recSummary = localizeRecommendationSummary(recommendation)
    const lines = [`BookmarkOps finding: ${recTitle}`, recSummary, '']
    const examples = recommendation.examples || []
    const allBookmarks = state.scanResult?.bookmarks || []

    if (examples.length > 0) {
      lines.push('Examples:')
      for (const ex of examples.slice(0, 5)) {
        if (typeof ex !== 'string' && ex.url) {
          // Duplicate URL: show every instance with title, folder, usage
          lines.push(`\n- ${ex.url} (${ex.count} copies):`)
          const instances = allBookmarks.filter((bm) => bm.url === ex.url)
          for (const bm of instances) {
            lines.push(`  • "${bm.title || '(untitled)'}" in ${bm.parentPath || '?'} [${bm.usageBucket || 'unknown'}]`)
          }
        } else {
          // String example (URL or title): enrich with folder + usage if found
          const url = typeof ex === 'string' ? ex : ex.url
          const matches = allBookmarks.filter((bm) => bm.url === url || bm.title === url)
          if (matches.length > 0) {
            lines.push(`- ${url}`)
            for (const bm of matches) {
              lines.push(`  • "${bm.title || '(untitled)'}" in ${bm.parentPath || '?'} [${bm.usageBucket || 'unknown'}]`)
            }
          } else {
            lines.push(`- ${url}`)
          }
        }
      }
    }
    return lines.join('\n')
  }

  function makeCopyForAIButton(getText, name, count) {
    const btn = document.createElement('button')
    btn.className = 'copy-for-ai-btn'
    btn.type = 'button'
    btn.textContent = t('copyForAI')
    btn.title = t('copyForAITooltip')
    btn.addEventListener('click', async (e) => {
      e.stopPropagation()
      await navigator.clipboard.writeText(getText())
      recordActivity(t('actCopiedForAI', { count, name }))
      btn.textContent = t('copied')
      setTimeout(() => { btn.textContent = t('copyForAI') }, 2000)
    })
    return btn
  }

  const AI_TOOL_URLS = {
    claude: 'https://claude.ai/new',
    chatgpt: 'https://chatgpt.com/',
    gemini: 'https://gemini.google.com/',
  }

  const DEFAULT_AI_TOOL = 'chatgpt'

  async function resolveLaunchURL() {
    const result = await chrome.storage.local.get(['bookmarkops.preferredAITool', 'bookmarkops.customAIURL'])
    const tool = result['bookmarkops.preferredAITool'] || DEFAULT_AI_TOOL
    if (tool === 'custom') {
      const url = result['bookmarkops.customAIURL'] || ''
      return url.startsWith('https://') && !url.startsWith('chrome-extension://') ? url : AI_TOOL_URLS[DEFAULT_AI_TOOL]
    }
    return AI_TOOL_URLS[tool] || AI_TOOL_URLS[DEFAULT_AI_TOOL]
  }

  async function getLaunchButtonLabel() {
    const result = await chrome.storage.local.get('bookmarkops.preferredAITool')
    const tool = result['bookmarkops.preferredAITool'] || DEFAULT_AI_TOOL
    if (tool === 'claude') return t('launchWithClaude')
    if (tool === 'chatgpt') return t('launchWithChatGPT')
    if (tool === 'gemini') return t('launchWithGemini')
    return t('launchWithAI')
  }

  function makeLaunchWithAIButton(getText, name) {
    const btn = document.createElement('button')
    btn.className = 'launch-with-ai-btn'
    btn.type = 'button'
    btn.textContent = t('launchWithAI')
    getLaunchButtonLabel().then((label) => { btn.textContent = label })
    // Update label whenever user changes preferred tool in settings
    document.addEventListener('preferredAIToolChanged', () => {
      getLaunchButtonLabel().then((label) => { btn.textContent = label })
    })
    btn.addEventListener('click', async (e) => {
      e.stopPropagation()
      const url = await resolveLaunchURL()
      await navigator.clipboard.writeText(getText())
      chrome.tabs.create({ url })
      recordActivity(t('launchHint', { name }))
    })
    return btn
  }

  function renderFolderNode(folder, nodesByParentPath, scan, duplicateUrls) {
    const children = nodesByParentPath.get(folder.path) || []
    const childFolders = children.filter((node) => node.type === 'folder')
    const childBookmarks = children.filter((node) => node.type === 'bookmark')
    const details = document.createElement('details')
    details.className = 'folder-node'
    details.open = folder.depth < 3

    const summary = document.createElement('summary')
    const title = document.createElement('strong')
    title.textContent = folder.title
    const counts = document.createElement('span')
    counts.textContent = `${childBookmarks.length} ${t('bookmarksLabel')} | ${childFolders.length} ${t('foldersLabel')} | ${t('depthLabel')} ${folder.depth}`
    const getText = () => buildFolderAIContext(folder.title, childBookmarks)
    const copyBtn = makeCopyForAIButton(getText, folder.title, childBookmarks.length)
    summary.append(title, counts, renderFolderBadges(folder, childBookmarks, duplicateUrls), copyBtn)
    details.append(summary)

    for (const childFolder of childFolders) {
      details.append(renderFolderNode(childFolder, nodesByParentPath, scan, duplicateUrls))
    }

    return details
  }

  function renderFolderBadges(folder, childBookmarks, duplicateUrls) {
    const badges = document.createElement('span')
    badges.className = 'folder-badges'

    const badgeTypes = []
    if (folder.depth >= 4) badgeTypes.push([t('deepFolder'), 'badge-deep'])
    if (/inbox|新收集|未整理|收件/i.test(folder.title)) badgeTypes.push([t('inboxPile'), 'badge-inbox'])
    if (childBookmarks.some((bookmark) => bookmark.title === 'Untitled')) badgeTypes.push([t('emptyTitle'), 'badge-empty-title'])
    if (childBookmarks.some((bookmark) => duplicateUrls.has(bookmark.url))) badgeTypes.push([t('duplicateUrl'), 'badge-duplicate'])
    if (childBookmarks.some((bookmark) => bookmark.usageBucket === 'dormant')) badgeTypes.push([t('dormantItems'), 'badge-dormant'])

    for (const [label, cls] of badgeTypes) {
      const badge = document.createElement('em')
      badge.className = cls
      badge.textContent = label
      badges.append(badge)
    }

    return badges
  }

  function renderAgentFindings(insights) {
    elements.agentFindingsOutput.innerHTML = ''
    elements.agentFindingsOutput.classList.remove('empty-state')
    const recommendations = insights?.recommendations || []
    elements.agentHealthScore.textContent = `${t('healthScore')}: ${insights?.summary?.healthScore ?? '--'}`

    if (!recommendations.length) {
      elements.agentFindingsOutput.classList.add('empty-state')
      elements.agentFindingsOutput.textContent = t('agentFindingsClean')
      return
    }

    const summary = document.createElement('div')
    summary.className = 'agent-findings-summary'
    const summaryItems = [
      [ctx.formatNumber(insights.summary.bookmarkCount), t('bookmarksLabel'), true],
      [ctx.formatNumber(insights.summary.folderCount), t('foldersLabel'), false],
      [ctx.formatNumber(recommendations.length), t('recommendationCount'), false],
    ]
    for (const [count, label, isPrimary] of summaryItems) {
      const el = document.createElement('div')
      el.className = `finding-stat${isPrimary ? ' finding-stat-primary' : ''}`
      const num = document.createElement('strong')
      num.textContent = count
      const lbl = document.createElement('span')
      lbl.textContent = label
      el.append(num, lbl)
      summary.append(el)
    }
    elements.agentFindingsOutput.append(summary)

    const list = document.createElement('div')
    list.className = 'recommendation-list'
    for (const recommendation of recommendations) {
      list.append(renderRecommendationCard(recommendation))
    }
    elements.agentFindingsOutput.append(list)
  }

  function renderRecommendationCard(recommendation) {
    const card = document.createElement('article')
    card.className = 'recommendation-card'
    card.dataset.severity = recommendation.severity || 'low'

    const header = document.createElement('header')
    const title = document.createElement('strong')
    title.textContent = localizeRecommendationTitle(recommendation.id, recommendation.title)
    const badge = document.createElement('span')
    badge.className = `risk-badge ${recommendation.severity || 'low'}`
    badge.textContent = recommendation.severity || 'low'
    header.append(title, badge)

    const count = document.createElement('div')
    count.className = 'recommendation-count'
    count.textContent = ctx.formatNumber(recommendation.count)

    const summary = document.createElement('p')
    summary.textContent = localizeRecommendationSummary(recommendation)
    const action = document.createElement('p')
    action.className = 'helper-text'
    action.textContent = localizeRecommendationAction(recommendation)
    card.append(header, count, summary, action)

    if (Array.isArray(recommendation.examples) && recommendation.examples.length > 0) {
      const examples = document.createElement('ul')
      examples.className = 'recommendation-examples'
      for (const example of recommendation.examples.slice(0, 3)) {
        const item = document.createElement('li')
        item.textContent = typeof example === 'string'
          ? example
          : `${example.url} (${example.count})`
        examples.append(item)
      }
      const copyBtn = makeCopyForAIButton(
        () => buildRecommendationAIContext(recommendation),
        localizeRecommendationTitle(recommendation.id, recommendation.title),
        recommendation.count,
      )
      card.append(examples, copyBtn)
    }

    return card
  }

  function localizeRecommendationTitle(id, fallback) {
    const value = t(`recommendation.${id}.title`)
    return value && !value.startsWith('recommendation.') ? value : fallback
  }

  function localizeRecommendationSummary(recommendation) {
    const template = t(`recommendation.${recommendation.id}.summary`)
    if (!template || template.startsWith('recommendation.')) return recommendation.summary
    return template
      .replace('{count}', ctx.formatNumber(recommendation.count))
      .replace('{duplicateUrlCount}', ctx.formatNumber(recommendation.stats?.duplicateUrlCount || recommendation.count))
  }

  function localizeRecommendationAction(recommendation) {
    const value = t(`recommendation.${recommendation.id}.action`)
    return value && !value.startsWith('recommendation.') ? value : recommendation.suggestedAction
  }

  return {
    handleScan,
    handleAgentStart,
    renderStats,
    renderUsageHealth,
    renderBookmarkMap,
    updateHealthScoreDisplay,
  }
}
