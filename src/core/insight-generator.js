const INBOX_PATTERN = /inbox|新收集|未整理|收件|稍後|later|read.?later/i

export const DEFAULT_RULES = [
  ({ bookmarks, stats }) => createDuplicateUrlRecommendation(bookmarks, stats),
  ({ stats }) => createEmptyTitleRecommendation(stats),
  ({ stats }) => createDormantRecommendation(stats),
  ({ stats }) => createUnknownUsageRecommendation(stats),
  ({ folders, stats }) => createDeepFolderRecommendation(folders, stats),
  ({ folders }) => createInboxRecommendation(folders),
]

export function generateAgentOnboardingInsights(scanResult, rules = DEFAULT_RULES) {
  const stats = scanResult?.stats || {}
  const bookmarks = Array.isArray(scanResult?.bookmarks) ? scanResult.bookmarks : []
  const folders = Array.isArray(scanResult?.folders) ? scanResult.folders : []
  const ctx = { stats, bookmarks, folders }
  const recommendations = rules.map((rule) => rule(ctx)).filter(Boolean)

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      bookmarkCount: stats.bookmarkCount || 0,
      folderCount: stats.folderCount || 0,
      duplicateUrlCount: stats.duplicateUrlCount || 0,
      emptyTitleBookmarkCount: stats.emptyTitleBookmarkCount || 0,
      maxDepth: stats.maxDepth || 0,
      healthScore: calculateHealthScore(stats),
    },
    recommendations,
  }
}

function createDuplicateUrlRecommendation(bookmarks, stats) {
  const groups = groupDuplicateUrls(bookmarks)
  if (groups.length === 0) return null

  return {
    id: 'duplicate-urls',
    severity: 'medium',
    title: 'Duplicate URL cleanup candidates',
    count: groups.length,
    summary: `${groups.length} URL groups appear more than once.`,
    suggestedAction: 'Review same-folder duplicates first. Keep the clearest title and delete only after DryRun review.',
    examples: groups.slice(0, 5).map((group) => ({
      url: group.url,
      count: group.items.length,
      titles: group.items.map((item) => item.title).slice(0, 3),
    })),
    stats: {
      duplicateUrlCount: stats.duplicateUrlCount || groups.length,
    },
  }
}

function createEmptyTitleRecommendation(stats) {
  const count = stats.emptyTitleBookmarkCount || 0
  if (count === 0) return null

  return {
    id: 'empty-titles',
    severity: 'medium',
    title: 'Bookmarks with empty titles',
    count,
    summary: `${count} bookmarks have empty titles and are hard to recognize.`,
    suggestedAction: 'Let Agent propose safe rename operations from URL/domain context, then review every rename before Apply.',
  }
}

function createDormantRecommendation(stats) {
  const buckets = stats.usageBuckets || {}
  const stale = buckets.stale || 0
  const dormant = buckets.dormant || 0
  const count = stale + dormant
  if (count === 0) return null

  return {
    id: 'low-usage-bookmarks',
    severity: dormant > stale ? 'high' : 'medium',
    title: 'Low-usage bookmark candidates',
    count,
    summary: `${stale} stale and ${dormant} dormant bookmarks may no longer be useful.`,
    suggestedAction: 'Use these as low-value candidates for review. Do not auto-delete them because last-used data can be missing or incomplete.',
  }
}

function createUnknownUsageRecommendation(stats) {
  const buckets = stats.usageBuckets || {}
  const unknown = buckets.unknown || 0
  const total = stats.bookmarkCount || 0
  if (!total || unknown / total < 0.3) return null

  return {
    id: 'unknown-usage',
    severity: 'low',
    title: 'Many bookmarks have no last-used data',
    count: unknown,
    summary: `${unknown} bookmarks have no usable last-used timestamp.`,
    suggestedAction: 'Treat unknown usage as review-only evidence, not a deletion reason.',
  }
}

function createDeepFolderRecommendation(folders, stats) {
  const deepFolders = folders.filter((folder) => getPathDepth(folder.path) >= 5)
  if (deepFolders.length === 0) return null

  return {
    id: 'deep-folders',
    severity: stats.maxDepth >= 6 ? 'medium' : 'low',
    title: 'Deep folder structure',
    count: deepFolders.length,
    summary: `The deepest folder path reaches depth ${stats.maxDepth || 0}.`,
    suggestedAction: 'Consider consolidating deep folders into fewer top-level groups.',
    examples: deepFolders.slice(0, 5).map((folder) => folder.path),
  }
}

function createInboxRecommendation(folders) {
  const inboxFolders = folders.filter((folder) => INBOX_PATTERN.test(folder.title) || INBOX_PATTERN.test(folder.path))
  if (inboxFolders.length === 0) return null

  return {
    id: 'inbox-piles',
    severity: 'medium',
    title: 'Inbox or collection piles',
    count: inboxFolders.length,
    summary: `${inboxFolders.length} folders look like collection piles.`,
    suggestedAction: 'Start with Inbox-style folders because they usually contain the highest cleanup leverage.',
    examples: inboxFolders.slice(0, 5).map((folder) => folder.path),
  }
}

function groupDuplicateUrls(bookmarks) {
  const groups = bookmarks.reduce((map, bookmark) => {
    if (!bookmark.url) return map
    if (!map.has(bookmark.url)) map.set(bookmark.url, [])
    map.get(bookmark.url).push(bookmark)
    return map
  }, new Map())

  return [...groups.entries()]
    .filter(([, items]) => items.length > 1)
    .map(([url, items]) => ({ url, items }))
}

function calculateHealthScore(stats) {
  const total = stats.bookmarkCount || 0
  if (!total) return 100

  const buckets = stats.usageBuckets || {}
  const frequent = buckets.frequent || 0
  const recent = buckets.recent || 0
  const stale = buckets.stale || 0
  const dormant = buckets.dormant || 0
  const unknown = buckets.unknown || 0
  const positive = ((frequent * 1) + (recent * 0.75)) / total
  const drag = ((stale * 0.25) + (dormant * 0.45) + (unknown * 0.15)) / total
  return Math.max(0, Math.min(100, Math.round((positive - drag + 0.65) * 100)))
}

function getPathDepth(path) {
  return String(path || '').split('/').filter(Boolean).length
}
