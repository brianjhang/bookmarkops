import {
  cloneBookmarkTree,
  createTreeIndex,
  displayPlanPath,
  ensureFolderPathInTree,
  findFolderByPath,
  getNodeParentPath,
  isBookmark,
  isFolder,
  normalizeTitle,
  pathsEqual,
  relativePath,
  removeNodeFromParent,
} from './bookmark-tree.js'
import { validateBookmarkPlan } from './plan-validator.js'

export function dryRunBookmarkPlan(plan, bookmarkTree) {
  const validation = validateBookmarkPlan(plan, { bookmarkTree })
  if (!validation.ok) {
    return {
      ok: false,
      validation,
      preview: [],
      summary: createSummary([]),
      tree: cloneBookmarkTree(bookmarkTree),
    }
  }

  const tree = cloneBookmarkTree(bookmarkTree)
  const preview = []

  for (const [index, operation] of plan.operations.entries()) {
    const result = dryRunOperation(tree, operation, index)
    preview.push(result)
  }

  return {
    ok: preview.every((item) => item.status !== 'blocked'),
    validation,
    preview,
    summary: createSummary(preview),
    tree,
  }
}

export function groupPreviewByStatus(preview) {
  return preview.reduce(
    (groups, item) => {
      groups[item.status].push(item)
      return groups
    },
    {
      ready: [],
      skipped: [],
      blocked: [],
    },
  )
}

function dryRunOperation(tree, operation, index) {
  if (operation.type === 'createFolder') {
    const before = Boolean(findFolderByPath(tree, operation.path))
    ensureFolderPathInTree(tree, operation.path)
    return previewResult({
      index,
      operation,
      status: before ? 'skipped' : 'ready',
      message: before ? 'Folder already exists.' : `Folder would be created at ${displayPlanPath(operation.path)}.`,
      before: null,
      after: {
        title: operation.path.at(-1) || '',
        path: displayPlanPath(operation.path),
        parentPath: displayPlanPath(operation.path.slice(0, -1)),
        created: !before,
        removed: false,
      },
      checks: [],
    })
  }

  const treeIndex = createTreeIndex(tree)
  const node = treeIndex.byId.get(String(operation.id))
  const expected = checkExpectedNode(treeIndex, node, operation)
  const before = describeNode(treeIndex, node)
  const relatedBookmarks = getRelatedBookmarks(treeIndex, node)

  if (!expected.ok) {
    return previewResult({
      index,
      operation,
      status: 'blocked',
      message: expected.message,
      before,
      after: null,
      checks: expected.checks,
      relatedBookmarks,
    })
  }

  if (operation.type === 'moveBookmark') {
    const destination = findFolderByPath(tree, operation.destination)
    if (!destination) {
      return previewResult({
        index,
        operation,
        status: 'blocked',
        message: `Destination folder is missing: ${displayPlanPath(operation.destination)}.`,
        before,
        after: null,
        checks: expected.checks,
        relatedBookmarks,
      })
    }

    const currentParentPath = getNodeParentPath(treeIndex, operation.id)
    if (pathsEqual(currentParentPath, operation.destination)) {
      return previewResult({
        index,
        operation,
        status: 'skipped',
        message: 'Bookmark is already in the destination folder.',
        before,
        after: before,
        checks: expected.checks,
        relatedBookmarks,
      })
    }

    removeNodeFromParent(treeIndex, operation.id)
    if (!Array.isArray(destination.children)) {
      destination.children = []
    }
    node.parentId = String(destination.id)
    destination.children.push(node)

    return previewResult({
      index,
      operation,
      status: 'ready',
      message: `Bookmark would move to ${displayPlanPath(operation.destination)}.`,
      before,
      after: {
        ...before,
        path: displayPlanPath([...operation.destination, normalizeTitle(node.title)]),
        parentPath: displayPlanPath(operation.destination),
        removed: false,
      },
      checks: expected.checks,
      relatedBookmarks,
    })
  }

  if (operation.type === 'renameNode') {
    if (node.title === operation.newTitle) {
      return previewResult({
        index,
        operation,
        status: 'skipped',
        message: 'Node already has the requested title.',
        before,
        after: before,
        checks: expected.checks,
        relatedBookmarks,
      })
    }

    node.title = operation.newTitle

    return previewResult({
      index,
      operation,
      status: 'ready',
      message: `Node would be renamed to "${operation.newTitle}".`,
      before,
      after: {
        ...before,
        title: operation.newTitle,
        path: before ? replaceLastPathPart(before.path, operation.newTitle) : null,
        removed: false,
      },
      checks: expected.checks,
      relatedBookmarks,
    })
  }

  if (operation.type === 'deleteBookmark') {
    removeNodeFromParent(treeIndex, operation.id)

    return previewResult({
      index,
      operation,
      status: 'ready',
      message: 'Bookmark would be deleted.',
      before,
      after: before ? {
        ...before,
        removed: true,
      } : null,
      checks: expected.checks,
      relatedBookmarks,
    })
  }

  if (operation.type === 'deleteEmptyFolder') {
    if (Array.isArray(node.children) && node.children.length > 0) {
      return previewResult({
        index,
        operation,
        status: 'blocked',
        message: 'Folder is not empty.',
        before,
        after: before,
        checks: expected.checks,
        relatedBookmarks,
      })
    }

    removeNodeFromParent(treeIndex, operation.id)

    return previewResult({
      index,
      operation,
      status: 'ready',
      message: 'Empty folder would be deleted.',
      before,
      after: before ? {
        ...before,
        removed: true,
      } : null,
      checks: expected.checks,
      relatedBookmarks,
    })
  }

  return previewResult({
    index,
    operation,
    status: 'blocked',
    message: `Unsupported operation: ${operation.type}.`,
    before,
    after: null,
    checks: expected.checks,
    relatedBookmarks,
  })
}

function checkExpectedNode(index, node, operation) {
  const checks = []

  if (!node) {
    return {
      ok: false,
      message: `Target id ${operation.id} is missing.`,
      checks: [
        {
          name: 'targetExists',
          ok: false,
          expected: String(operation.id),
          actual: null,
        },
      ],
    }
  }

  if ((operation.type === 'moveBookmark' || operation.type === 'deleteBookmark') && !isBookmark(node)) {
    return {
      ok: false,
      message: `Target id ${operation.id} is not a bookmark.`,
      checks,
    }
  }

  if (operation.type === 'deleteEmptyFolder' && !isFolder(node)) {
    return {
      ok: false,
      message: `Target id ${operation.id} is not a folder.`,
      checks,
    }
  }

  if (operation.expectedTitle !== undefined) {
    const actual = normalizeTitle(node.title)
    const ok = actual === operation.expectedTitle
    checks.push({
      name: 'expectedTitle',
      ok,
      expected: operation.expectedTitle,
      actual,
    })
  }

  if (operation.expectedUrl !== undefined) {
    const ok = node.url === operation.expectedUrl
    checks.push({
      name: 'expectedUrl',
      ok,
      expected: operation.expectedUrl,
      actual: node.url || null,
    })
  }

  if (Array.isArray(operation.expectedParentPath)) {
    const actual = getNodeParentPath(index, operation.id)
    const ok = pathsEqual(actual, operation.expectedParentPath)
    checks.push({
      name: 'expectedParentPath',
      ok,
      expected: displayPlanPath(operation.expectedParentPath),
      actual: displayPlanPath(actual),
    })
  }

  const failedCheck = checks.find((check) => !check.ok)
  if (failedCheck) {
    return {
      ok: false,
      message: `Expected check failed for id ${operation.id}: ${failedCheck.name}.`,
      checks,
    }
  }

  return {
    ok: true,
    message: 'Expected fields match.',
    checks,
  }
}

function previewResult({
  index,
  operation,
  status,
  message,
  before = null,
  after = null,
  checks = [],
  relatedBookmarks = [],
}) {
  return {
    index,
    type: operation.type,
    status,
    message,
    description: operation.description || '',
    targetId: operation.id || null,
    operation,
    before,
    after,
    checks,
    relatedBookmarks,
    risk: riskForOperation(operation),
  }
}

function describeNode(index, node) {
  if (!node) return null
  const pathParts = relativePath(index.pathById.get(String(node.id)) || [])
  const parentPathParts = getNodeParentPath(index, node.id)

  return {
    id: String(node.id),
    type: isBookmark(node) ? 'bookmark' : 'folder',
    title: normalizeTitle(node.title),
    url: isBookmark(node) ? node.url : null,
    path: displayPlanPath(pathParts),
    parentPath: displayPlanPath(parentPathParts),
    removed: false,
  }
}

function getRelatedBookmarks(index, node) {
  if (!isBookmark(node)) return []

  return [...index.byId.values()]
    .filter((candidate) => isBookmark(candidate) && candidate.url === node.url)
    .map((candidate) => describeNode(index, candidate))
}

function replaceLastPathPart(path, nextTitle) {
  if (!path) return null
  const slashIndex = path.lastIndexOf('/')
  if (slashIndex === -1) return nextTitle
  return `${path.slice(0, slashIndex + 1)}${String(nextTitle).replaceAll('/', '\\/')}`
}

function riskForOperation(operation) {
  if (operation.type === 'deleteBookmark' || operation.type === 'deleteEmptyFolder') return 'high'
  if (operation.type === 'moveBookmark') return 'medium'
  return 'low'
}

function createSummary(preview) {
  return preview.reduce(
    (summary, item) => {
      summary.total += 1
      summary[item.status] += 1
      return summary
    },
    {
      total: 0,
      ready: 0,
      skipped: 0,
      blocked: 0,
    },
  )
}
