const ROOT_TITLE = 'Chrome Bookmarks'

export function cloneBookmarkTree(tree) {
  return JSON.parse(JSON.stringify(tree))
}

export function normalizeTitle(title, depth = 1) {
  const value = typeof title === 'string' ? title.trim() : ''
  if (value) return value
  return depth === 0 ? ROOT_TITLE : 'Untitled'
}

export function normalizePlanPath(pathParts) {
  if (!Array.isArray(pathParts)) return []

  const normalized = pathParts
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)

  if (normalized[0] === ROOT_TITLE) {
    return normalized.slice(1)
  }

  return normalized
}

export function displayPlanPath(pathParts) {
  const normalized = normalizePlanPath(pathParts)
  return normalized.length ? `/${[ROOT_TITLE, ...normalized].join('/')}` : `/${ROOT_TITLE}`
}

export function createTreeIndex(tree) {
  const byId = new Map()
  const parentById = new Map()
  const pathById = new Map()
  const root = Array.isArray(tree) ? tree[0] : null

  const visit = (node, parent, parentPath, depth) => {
    if (!node || typeof node !== 'object') return

    const title = normalizeTitle(node.title, depth)
    const path = [...parentPath, title]
    byId.set(String(node.id), node)
    pathById.set(String(node.id), path)

    if (parent) {
      parentById.set(String(node.id), parent)
    }

    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        visit(child, node, path, depth + 1)
      }
    }
  }

  if (root) {
    visit(root, null, [], 0)
  }

  return {
    byId,
    parentById,
    pathById,
    root,
  }
}

export function isBookmark(node) {
  return Boolean(node && typeof node.url === 'string' && node.url.length > 0)
}

export function isFolder(node) {
  return Boolean(node && !isBookmark(node))
}

export function getNodeParentPath(index, id) {
  const parent = index.parentById.get(String(id))
  if (!parent) return []

  return relativePath(index.pathById.get(String(parent.id)) || [])
}

export function relativePath(pathParts) {
  if (!Array.isArray(pathParts)) return []
  return pathParts[0] === ROOT_TITLE ? pathParts.slice(1) : pathParts
}

export function pathsEqual(actualPath, expectedPath) {
  const actual = normalizePlanPath(actualPath)
  const expected = normalizePlanPath(expectedPath)
  return actual.length === expected.length && actual.every((part, index) => part === expected[index])
}

export function findFolderByPath(tree, pathParts) {
  const path = normalizePlanPath(pathParts)
  const root = Array.isArray(tree) ? tree[0] : null
  if (!root) return null
  if (path.length === 0) return root

  let cursor = root

  for (const part of path) {
    const next = (cursor.children || []).find(
      (child) => isFolder(child) && normalizeTitle(child.title) === part,
    )

    if (!next) return null
    cursor = next
  }

  return cursor
}

export function ensureFolderPathInTree(tree, pathParts, idFactory = createDryRunIdFactory()) {
  const path = normalizePlanPath(pathParts)
  const root = Array.isArray(tree) ? tree[0] : null
  if (!root) throw new Error('Bookmark tree root is missing.')
  if (path.length === 0) return root

  let cursor = root

  for (const part of path) {
    if (!Array.isArray(cursor.children)) {
      cursor.children = []
    }

    let next = cursor.children.find(
      (child) => isFolder(child) && normalizeTitle(child.title) === part,
    )

    if (!next) {
      next = {
        id: idFactory(),
        parentId: String(cursor.id),
        title: part,
        children: [],
      }
      cursor.children.push(next)
    }

    cursor = next
  }

  return cursor
}

export function removeNodeFromParent(index, id) {
  const parent = index.parentById.get(String(id))
  if (!parent || !Array.isArray(parent.children)) return false

  const childIndex = parent.children.findIndex((child) => String(child.id) === String(id))
  if (childIndex === -1) return false

  parent.children.splice(childIndex, 1)
  return true
}

export function createDryRunIdFactory(prefix = 'dry-run') {
  let nextId = 1
  return () => `${prefix}-${nextId++}`
}
