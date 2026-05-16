import { getBookmarkTree } from './chrome-api.js'

const DEFAULT_ROOT_TITLE = 'Chrome Bookmarks'
const DEFAULT_UNTITLED_TITLE = 'Untitled'
const USAGE_BUCKETS = ['frequent', 'recent', 'stale', 'dormant', 'unknown']

export async function scanBookmarks({
  bookmarksApi = globalThis.chrome?.bookmarks,
  generatedAt = new Date().toISOString(),
} = {}) {
  if (!bookmarksApi || typeof bookmarksApi.getTree !== 'function') {
    throw new Error('chrome.bookmarks.getTree() is unavailable.')
  }

  const tree = await getBookmarkTree(bookmarksApi)
  return analyzeBookmarkTree(tree, { generatedAt })
}

export function analyzeBookmarkTree(
  bookmarkTree,
  { generatedAt = new Date().toISOString() } = {},
) {
  if (!Array.isArray(bookmarkTree)) {
    throw new Error('Bookmark tree must be an array.')
  }

  const nodes = []
  const bookmarks = []
  const folders = []
  const urlCounts = new Map()
  let maxDepth = 0
  let emptyTitleBookmarkCount = 0
  const usageBuckets = createUsageBucketCounts()
  const generatedAtMs = Date.parse(generatedAt)
  const usageNowMs = Number.isFinite(generatedAtMs) ? generatedAtMs : Date.now()

  const visitNode = (node, parentPathParts, depth) => {
    if (!node || typeof node !== 'object') return

    const isBookmark = typeof node.url === 'string' && node.url.length > 0
    const rawTitle = typeof node.title === 'string' ? node.title.trim() : ''
    const title = rawTitle || (depth === 0 ? DEFAULT_ROOT_TITLE : DEFAULT_UNTITLED_TITLE)
    const pathParts = [...parentPathParts, title]
    const usage = isBookmark
      ? classifyBookmarkUsage(node.dateLastUsed, usageNowMs)
      : {
          dateLastUsed: null,
          daysSinceLastUsed: null,
          usageBucket: null,
        }
    const nodeRecord = {
      id: normalizeId(node.id),
      parentId: node.parentId == null ? null : normalizeId(node.parentId),
      index: Number.isInteger(node.index) ? node.index : null,
      type: isBookmark ? 'bookmark' : 'folder',
      path: formatPath(pathParts),
      pathParts,
      parentPath: formatPath(parentPathParts),
      title,
      url: isBookmark ? node.url : null,
      depth,
      dateAdded: normalizeChromeDate(node.dateAdded),
      dateGroupModified: isBookmark ? null : normalizeChromeDate(node.dateGroupModified),
      dateLastUsed: usage.dateLastUsed,
      daysSinceLastUsed: usage.daysSinceLastUsed,
      usageBucket: usage.usageBucket,
    }

    nodes.push(nodeRecord)
    maxDepth = Math.max(maxDepth, depth)

    if (isBookmark) {
      bookmarks.push(pickBookmarkFields(nodeRecord))
      urlCounts.set(nodeRecord.url, (urlCounts.get(nodeRecord.url) || 0) + 1)

      if (!rawTitle) {
        emptyTitleBookmarkCount += 1
      }

      usageBuckets[nodeRecord.usageBucket] += 1
    } else {
      folders.push(pickFolderFields(nodeRecord))
    }

    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        visitNode(child, pathParts, depth + 1)
      }
    }
  }

  for (const rootNode of bookmarkTree) {
    visitNode(rootNode, [], 0)
  }

  const duplicateUrlCount = [...urlCounts.values()].filter((count) => count > 1).length

  return {
    reportType: 'bookmarkops.safety_scan',
    version: 1,
    generatedAt,
    stats: {
      generatedAt,
      rootCount: bookmarkTree.length,
      totalNodeCount: nodes.length,
      folderCount: folders.length,
      bookmarkCount: bookmarks.length,
      uniqueUrlCount: urlCounts.size,
      duplicateUrlCount,
      emptyTitleBookmarkCount,
      maxDepth,
      usageBuckets,
    },
    nodes,
    folders,
    bookmarks,
  }
}

function pickBookmarkFields(nodeRecord) {
  return {
    id: nodeRecord.id,
    path: nodeRecord.path,
    parentPath: nodeRecord.parentPath,
    title: nodeRecord.title,
    url: nodeRecord.url,
    dateAdded: nodeRecord.dateAdded,
    dateLastUsed: nodeRecord.dateLastUsed,
    daysSinceLastUsed: nodeRecord.daysSinceLastUsed,
    usageBucket: nodeRecord.usageBucket,
  }
}

function pickFolderFields(nodeRecord) {
  return {
    id: nodeRecord.id,
    path: nodeRecord.path,
    parentPath: nodeRecord.parentPath,
    title: nodeRecord.title,
    dateAdded: nodeRecord.dateAdded,
    dateGroupModified: nodeRecord.dateGroupModified,
  }
}

function normalizeId(value) {
  return value == null ? '' : String(value)
}

function formatPath(parts) {
  if (!parts.length) return '/'
  return `/${parts.map(escapePathPart).join('/')}`
}

function escapePathPart(value) {
  return String(value).replaceAll('/', '\\/')
}

function normalizeChromeDate(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function classifyBookmarkUsage(dateLastUsed, nowMs = Date.now()) {
  const normalized = normalizeChromeDate(dateLastUsed)
  if (!normalized) {
    return {
      dateLastUsed: null,
      daysSinceLastUsed: null,
      usageBucket: 'unknown',
    }
  }

  const dateMs = Date.parse(normalized)
  const safeNowMs = Number.isFinite(nowMs) ? nowMs : Date.now()
  const daysSinceLastUsed = Math.max(0, Math.floor((safeNowMs - dateMs) / 86_400_000))

  let usageBucket = 'dormant'
  if (daysSinceLastUsed <= 30) {
    usageBucket = 'frequent'
  } else if (daysSinceLastUsed <= 90) {
    usageBucket = 'recent'
  } else if (daysSinceLastUsed <= 365) {
    usageBucket = 'stale'
  }

  return {
    dateLastUsed: normalized,
    daysSinceLastUsed,
    usageBucket,
  }
}

function createUsageBucketCounts() {
  return USAGE_BUCKETS.reduce((counts, bucket) => {
    counts[bucket] = 0
    return counts
  }, {})
}

