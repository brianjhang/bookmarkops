import {
  createBookmarkNode,
  getBookmarkTree,
  moveBookmarkNode,
  removeBookmarkNode,
  updateBookmarkNode,
} from './chrome-api.js'
import { createBackup } from './backup-manager.js'
import { findFolderByPath, isFolder } from './bookmark-tree.js'
import { dryRunBookmarkPlan } from './dry-runner.js'
import { verifyPlanAgainstTree } from './verifier.js'

export async function applyBookmarkPlan({
  plan,
  bookmarksApi = globalThis.chrome?.bookmarks,
  storageApi = globalThis.chrome?.storage?.local,
  approval,
} = {}) {
  assertDashboardApproval(approval, 'APPLY')

  const currentTree = await getBookmarkTree(bookmarksApi)
  const dryRun = dryRunBookmarkPlan(plan, currentTree)
  if (!dryRun.ok) {
    return {
      ok: false,
      backup: null,
      dryRun,
      applied: [],
      verify: null,
      error: 'DryRun has blocked operations. Apply is unavailable.',
    }
  }

  const backup = await createBackup({
    bookmarksApi,
    storageApi,
    reason: 'before-apply',
  })

  const applied = []

  for (const [index, operation] of plan.operations.entries()) {
    const result = await applyOperation(bookmarksApi, operation, index)
    applied.push(result)

    if (result.status === 'failed') {
      for (const [skippedIndex, skippedOperation] of plan.operations.entries()) {
        if (skippedIndex <= index) continue
        applied.push(appliedResult(
          skippedIndex,
          skippedOperation,
          'skipped',
          null,
          `Skipped because operation ${index + 1} failed: ${result.message}`,
        ))
      }
      break
    }
  }

  const afterTree = await getBookmarkTree(bookmarksApi)
  const verify = verifyPlanAgainstTree(plan, afterTree, applied)

  return {
    ok: verify.failed.length === 0,
    backup,
    dryRun,
    applied,
    verify,
  }
}

export function assertDashboardApproval(approval, phrase) {
  if (!approval || approval.source !== 'dashboard' || approval.phrase !== phrase) {
    throw new Error(`Dashboard approval phrase ${phrase} is required.`)
  }
}

async function applyOperation(bookmarksApi, operation, index) {
  try {
    if (operation.type === 'createFolder') {
      const tree = await getBookmarkTree(bookmarksApi)
      const existing = findFolderByPath(tree, operation.path)
      if (existing) {
        return appliedResult(index, operation, 'skipped', existing, 'Folder already exists.')
      }

      const parentPath = operation.path.slice(0, -1)
      const title = operation.path[operation.path.length - 1]
      const parent = findFolderByPath(tree, parentPath)
      if (!parent) {
        return appliedResult(index, operation, 'failed', null, 'Parent folder is missing.')
      }

      const created = await createBookmarkNode(bookmarksApi, {
        parentId: parent.id,
        title,
      })

      return appliedResult(index, operation, 'applied', created, 'Folder created.')
    }

    if (operation.type === 'moveBookmark') {
      const tree = await getBookmarkTree(bookmarksApi)
      const destination = findFolderByPath(tree, operation.destination)
      if (!destination) {
        return appliedResult(index, operation, 'failed', null, 'Destination folder is missing.')
      }

      const moved = await moveBookmarkNode(bookmarksApi, operation.id, {
        parentId: destination.id,
      })

      return appliedResult(index, operation, 'applied', moved, 'Bookmark moved.')
    }

    if (operation.type === 'renameNode') {
      const updated = await updateBookmarkNode(bookmarksApi, operation.id, {
        title: operation.newTitle,
      })

      return appliedResult(index, operation, 'applied', updated, 'Node renamed.')
    }

    if (operation.type === 'deleteBookmark') {
      await removeBookmarkNode(bookmarksApi, operation.id)
      return appliedResult(index, operation, 'applied', null, 'Bookmark deleted.')
    }

    if (operation.type === 'deleteEmptyFolder') {
      const tree = await getBookmarkTree(bookmarksApi)
      const folder = findNodeById(tree, operation.id)

      if (!isFolder(folder)) {
        return appliedResult(index, operation, 'failed', null, 'Target is not a folder.')
      }

      if (Array.isArray(folder.children) && folder.children.length > 0) {
        return appliedResult(index, operation, 'failed', null, 'Folder is not empty.')
      }

      await removeBookmarkNode(bookmarksApi, operation.id)
      return appliedResult(index, operation, 'applied', null, 'Empty folder deleted.')
    }

    return appliedResult(index, operation, 'failed', null, 'Unsupported operation.')
  } catch (error) {
    return appliedResult(
      index,
      operation,
      'failed',
      null,
      error instanceof Error ? error.message : 'Operation failed.',
    )
  }
}

function findNodeById(tree, id) {
  const stack = Array.isArray(tree) ? [...tree] : []
  while (stack.length) {
    const node = stack.shift()
    if (String(node.id) === String(id)) return node
    if (Array.isArray(node.children)) {
      stack.push(...node.children)
    }
  }
  return null
}

function appliedResult(index, operation, status, node, message) {
  return {
    index,
    type: operation.type,
    status,
    targetId: operation.id || node?.id || null,
    createdId: node?.id || null,
    message,
  }
}
