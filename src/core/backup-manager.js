import {
  createBookmarkNode,
  getBookmarkTree,
  removeBookmarkNode,
  removeBookmarkTreeNode,
  storageGet,
  storageSet,
} from './chrome-api.js'
import { analyzeBookmarkTree } from './scanner.js'

const BACKUPS_KEY = 'bookmarkops.backups'
export const BACKUP_RETENTION_LIMIT = 10

export async function createBackup({
  bookmarksApi = globalThis.chrome?.bookmarks,
  storageApi = globalThis.chrome?.storage?.local,
  reason = 'before-apply',
  createdAt = new Date().toISOString(),
  retentionLimit = BACKUP_RETENTION_LIMIT,
} = {}) {
  assertApis(bookmarksApi, storageApi)

  const tree = await getBookmarkTree(bookmarksApi)
  const scan = analyzeBookmarkTree(tree, { generatedAt: createdAt })
  const metadata = await createBackupMetadata({
    createdAt,
    reason,
    tree,
    stats: scan.stats,
  })
  const backup = {
    id: `backup-${createdAt.replaceAll(':', '-').replaceAll('.', '-')}`,
    createdAt,
    reason,
    tree,
    stats: scan.stats,
    metadata,
  }
  const backups = await listBackups({ storageApi })
  backups.unshift(backup)
  await storageSet(storageApi, { [BACKUPS_KEY]: backups.slice(0, retentionLimit) })

  return backup
}

export async function listBackups({ storageApi = globalThis.chrome?.storage?.local } = {}) {
  if (!storageApi) throw new Error('chrome.storage.local is unavailable.')

  const result = await storageGet(storageApi, BACKUPS_KEY)
  return Array.isArray(result?.[BACKUPS_KEY]) ? result[BACKUPS_KEY] : []
}

export async function getBackupById({ storageApi = globalThis.chrome?.storage?.local, backupId } = {}) {
  const backups = await listBackups({ storageApi })
  return backups.find((backup) => backup.id === backupId) || null
}

export async function deleteBackup({ storageApi = globalThis.chrome?.storage?.local, backupId } = {}) {
  if (!storageApi) throw new Error('chrome.storage.local is unavailable.')
  if (!backupId) throw new Error('backupId is required.')

  const backups = await listBackups({ storageApi })
  const backup = backups.find((item) => item.id === backupId)
  if (!backup) {
    throw new Error(`Backup not found: ${backupId}`)
  }

  await storageSet(storageApi, {
    [BACKUPS_KEY]: backups.filter((item) => item.id !== backupId),
  })

  return {
    deleted: true,
    backupId,
    backup: summarizeBackup(backup),
  }
}

export async function restoreBackup({
  bookmarksApi = globalThis.chrome?.bookmarks,
  storageApi = globalThis.chrome?.storage?.local,
  backupId,
} = {}) {
  assertApis(bookmarksApi, storageApi)
  if (!backupId) throw new Error('backupId is required.')

  const backup = await getBackupById({ storageApi, backupId })
  if (!backup) {
    throw new Error(`Backup not found: ${backupId}`)
  }

  const currentTree = await getBookmarkTree(bookmarksApi)
  const currentRoot = currentTree[0]
  const backupRoot = backup.tree[0]

  if (!currentRoot || !backupRoot) {
    throw new Error('Cannot restore without bookmark roots.')
  }

  const preRestoreBackup = await createBackup({
    bookmarksApi,
    storageApi,
    reason: 'before-restore',
  })

  for (const backupTopFolder of backupRoot.children || []) {
    const currentTopFolder = findMatchingTopFolder(currentRoot, backupTopFolder)
    if (!currentTopFolder) {
      continue
    }

    await clearFolderChildren(bookmarksApi, currentTopFolder)
    await recreateChildren(bookmarksApi, currentTopFolder.id, backupTopFolder.children || [])
  }

  const restoredTree = await getBookmarkTree(bookmarksApi)
  return {
    ...verifyRestoreAgainstBackup(backup, restoredTree),
    preRestoreBackup: summarizeBackup(preRestoreBackup),
  }
}

export function verifyRestoreAgainstBackup(backup, restoredTree) {
  const backupScan = analyzeBookmarkTree(backup.tree, { generatedAt: backup.createdAt })
  const restoredScan = analyzeBookmarkTree(restoredTree, { generatedAt: new Date().toISOString() })
  const expected = createComparableSet(backupScan)
  const actual = createComparableSet(restoredScan)
  const failed = []
  const unexpected = []

  for (const item of expected) {
    if (!actual.has(item)) {
      failed.push(item)
    }
  }

  for (const item of actual) {
    if (!expected.has(item)) {
      unexpected.push(item)
    }
  }

  return {
    ok: failed.length === 0 && unexpected.length === 0,
    backupId: backup.id,
    failed,
    skipped: [],
    unexpected,
    stats: restoredScan.stats,
  }
}

async function clearFolderChildren(bookmarksApi, folder) {
  for (const child of [...(folder.children || [])]) {
    if (Array.isArray(child.children)) {
      await removeBookmarkTreeNode(bookmarksApi, child.id)
    } else {
      await removeBookmarkNode(bookmarksApi, child.id)
    }
  }
}

async function recreateChildren(bookmarksApi, parentId, children) {
  for (const child of children) {
    const createDetails = {
      parentId,
      title: child.title || '',
    }

    if (child.url) {
      createDetails.url = child.url
    }

    const created = await createBookmarkNode(bookmarksApi, createDetails)

    if (Array.isArray(child.children) && child.children.length > 0) {
      await recreateChildren(bookmarksApi, created.id, child.children)
    }
  }
}

function findMatchingTopFolder(currentRoot, backupTopFolder) {
  return (currentRoot.children || []).find(
    (child) => String(child.id) === String(backupTopFolder.id) || child.title === backupTopFolder.title,
  )
}

function createComparableSet(scan) {
  const values = new Set()

  for (const folder of scan.folders) {
    values.add(`folder:${folder.path}:${folder.title}`)
  }

  for (const bookmark of scan.bookmarks) {
    values.add(`bookmark:${bookmark.path}:${bookmark.title}:${bookmark.url}`)
  }

  return values
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

function assertApis(bookmarksApi, storageApi) {
  if (!bookmarksApi) throw new Error('chrome.bookmarks is unavailable.')
  if (!storageApi) throw new Error('chrome.storage.local is unavailable.')
}

async function createBackupMetadata({ createdAt, reason, tree, stats }) {
  const serialized = JSON.stringify(tree)
  return {
    createdAt,
    reason,
    nodeCount: stats.totalNodeCount,
    bookmarkCount: stats.bookmarkCount,
    folderCount: stats.folderCount,
    byteSize: new TextEncoder().encode(serialized).byteLength,
    checksum: await checksum(serialized),
  }
}

async function checksum(value) {
  const bytes = new TextEncoder().encode(value)
  if (globalThis.crypto?.subtle?.digest) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
    return `sha256:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`
  }

  let hash = 2166136261
  for (const byte of bytes) {
    hash ^= byte
    hash = Math.imul(hash, 16777619)
  }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, '0')}`
}
