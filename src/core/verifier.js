import { createTreeIndex, findFolderByPath, getNodeParentPath, pathsEqual } from './bookmark-tree.js'

export function verifyPlanAgainstTree(plan, bookmarkTree, applied = []) {
  const index = createTreeIndex(bookmarkTree)
  const failed = []
  const skipped = applied.filter((item) => item.status === 'skipped')
  const unexpected = applied.filter((item) => item.status === 'failed')

  for (const [operationIndex, operation] of plan.operations.entries()) {
    const appliedResult = applied.find((item) => item.index === operationIndex)
    const verifyResult = verifyOperation(index, operation, appliedResult)

    if (!verifyResult.ok) {
      failed.push({
        index: operationIndex,
        type: operation.type,
        message: verifyResult.message,
      })
    }
  }

  return {
    ok: failed.length === 0 && unexpected.length === 0,
    failed,
    skipped,
    unexpected,
  }
}

function verifyOperation(index, operation, appliedResult) {
  if (appliedResult?.status === 'failed') {
    return {
      ok: false,
      message: appliedResult.message,
    }
  }

  if (operation.type === 'createFolder') {
    return {
      ok: Boolean(findFolderByPathFromIndex(index, operation.path)),
      message: 'Folder was not found after apply.',
    }
  }

  if (operation.type === 'moveBookmark') {
    const node = index.byId.get(String(operation.id))
    if (!node) {
      return {
        ok: false,
        message: 'Bookmark missing after move.',
      }
    }

    const moved = pathsEqual(getNodeParentPath(index, operation.id), operation.destination)
    const identityMatches = node.title === operation.expectedTitle && node.url === operation.expectedUrl
    return {
      ok: moved && identityMatches,
      message: 'Bookmark was not found in the expected destination after apply.',
    }
  }

  if (operation.type === 'renameNode') {
    const node = index.byId.get(String(operation.id))
    return {
      ok: Boolean(node && node.title === operation.newTitle),
      message: 'Node title does not match after rename.',
    }
  }

  if (operation.type === 'deleteBookmark' || operation.type === 'deleteEmptyFolder') {
    return {
      ok: !index.byId.has(String(operation.id)),
      message: 'Deleted node is still present after apply.',
    }
  }

  return {
    ok: false,
    message: `Unsupported operation: ${operation.type}.`,
  }
}

function findFolderByPathFromIndex(index, path) {
  return findFolderByPath([index.root], path)
}
