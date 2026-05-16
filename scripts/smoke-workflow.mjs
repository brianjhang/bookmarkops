import assert from 'node:assert/strict'

import { applyBookmarkPlan } from '../src/core/apply-engine.js'
import { getAgentConfig, requireAgentSession, rotateAgentToken, setAgentConfig } from '../src/core/agent-operator.js'
import { BACKUP_RETENTION_LIMIT, createBackup, deleteBackup, getBackupById, listBackups, restoreBackup } from '../src/core/backup-manager.js'
import { dryRunBookmarkPlan } from '../src/core/dry-runner.js'
import { validateBookmarkPlan } from '../src/core/plan-validator.js'

globalThis.chrome = {
  runtime: {},
}

const tree = [
  {
    id: '0',
    title: '',
    children: [
      {
        id: '1',
        parentId: '0',
        title: 'Bookmarks Bar',
        children: [
          {
            id: '4',
            parentId: '1',
            title: 'Old',
            url: 'https://old.example/',
          },
          {
            id: '9',
            parentId: '1',
            title: '',
            url: 'https://untitled.example/',
          },
          {
            id: '5',
            parentId: '1',
            title: 'Delete Me',
            url: 'https://delete.example/',
          },
          {
            id: '6',
            parentId: '1',
            title: 'Empty Folder',
            children: [],
          },
          {
            id: '7',
            parentId: '1',
            title: 'Current Folder',
            children: [
              {
                id: '8',
                parentId: '7',
                title: 'Move Me',
                url: 'https://move.example/',
              },
            ],
          },
        ],
      },
      {
        id: '2',
        parentId: '0',
        title: 'Other Bookmarks',
        children: [],
      },
      {
        id: '3',
        parentId: '0',
        title: 'Mobile Bookmarks',
        children: [],
      },
    ],
  },
]

const plan = {
  bookmarkopsVersion: '0.0.1',
  summary: 'Workflow smoke plan',
  riskLevel: 'medium',
  createdBy: 'smoke-test',
  createdAt: '2026-05-08T00:00:00.000Z',
  operations: [
    {
      type: 'createFolder',
      path: ['Bookmarks Bar', 'AI'],
    },
    {
      type: 'moveBookmark',
      id: '8',
      expectedTitle: 'Move Me',
      expectedUrl: 'https://move.example/',
      expectedParentPath: ['Bookmarks Bar', 'Current Folder'],
      destination: ['Bookmarks Bar', 'AI'],
    },
    {
      type: 'renameNode',
      id: '4',
      expectedTitle: 'Old',
      newTitle: 'Renamed',
    },
    {
      type: 'renameNode',
      id: '9',
      expectedTitle: 'Untitled',
      newTitle: 'Recovered Title',
    },
    {
      type: 'deleteBookmark',
      id: '5',
      expectedTitle: 'Delete Me',
      expectedUrl: 'https://delete.example/',
      expectedParentPath: ['Bookmarks Bar'],
    },
    {
      type: 'deleteEmptyFolder',
      id: '6',
      expectedTitle: 'Empty Folder',
      expectedParentPath: ['Bookmarks Bar'],
    },
  ],
}

const unsafePlan = {
  ...plan,
  operations: [
    {
      type: 'deleteBookmark',
      id: '5',
      expectedTitle: 'Delete Me',
      expectedUrl: 'https://delete.example/',
    },
  ],
}

const bookmarksApi = createBookmarksApi(tree)
const storageApi = createStorageApi()
const initialTree = await callback(bookmarksApi.getTree)

const legacyAgentStorage = createStorageApi()
await callback((done) => legacyAgentStorage.set({
  'bookmarkops.agentConfig': {
    enabled: false,
    token: '',
    updatedAt: null,
  },
}, done))
const migratedAgentConfig = await getAgentConfig(legacyAgentStorage)
assert.equal(migratedAgentConfig.enabled, true)
assert.equal(migratedAgentConfig.manualMode, false)
assert.equal(Boolean(migratedAgentConfig.token), true)

const defaultAgentConfig = await getAgentConfig(storageApi)
assert.equal(defaultAgentConfig.enabled, true)
assert.equal(defaultAgentConfig.manualMode, false)
assert.equal(Boolean(defaultAgentConfig.token), true)
await requireAgentSession(storageApi, defaultAgentConfig.token)
await assert.rejects(
  () => requireAgentSession(storageApi, ''),
  /Valid agent session token is required/,
)

const savedAgentConfig = await setAgentConfig(storageApi, {
  enabled: true,
  token: 'manual-token',
  manualMode: true,
})
assert.equal(savedAgentConfig.enabled, true)
assert.equal(savedAgentConfig.hasToken, true)
assert.equal(savedAgentConfig.sessionToken, undefined)
assert.equal(savedAgentConfig.maskedSessionToken, 'manu••••oken')
assert.equal(savedAgentConfig.manualMode, true)
await requireAgentSession(storageApi, 'manual-token')
const rotatedAgentConfig = await rotateAgentToken(storageApi)
assert.equal(rotatedAgentConfig.hasToken, true)
assert.notEqual(rotatedAgentConfig.maskedSessionToken, 'manu••••oken')
await assert.rejects(
  () => requireAgentSession(storageApi, 'manual-token'),
  /Valid agent session token is required/,
)

const unsafeValidation = validateBookmarkPlan(unsafePlan, { bookmarkTree: initialTree })
assert.equal(unsafeValidation.ok, false)
assert.match(unsafeValidation.errors.join('\n'), /expectedParentPath/)

const validation = validateBookmarkPlan(plan, { bookmarkTree: initialTree })
assert.equal(validation.ok, true)
assert.deepEqual(validation.warnings, [])

const dryRun = dryRunBookmarkPlan(plan, initialTree)
assert.equal(dryRun.ok, true)
assert.equal(dryRun.summary.ready, 6)
assert.equal(dryRun.preview.length, 6)
assert.equal(dryRun.preview[2].before.title, 'Old')
assert.equal(dryRun.preview[2].after.title, 'Renamed')
assert.equal(dryRun.preview[3].before.title, 'Untitled')
assert.equal(dryRun.preview[3].checks[0].name, 'expectedTitle')
assert.equal(dryRun.preview[3].checks[0].ok, true)
assert.equal(dryRun.preview[4].after.removed, true)
assert.equal(dryRun.preview[4].risk, 'high')
assert.equal(findNode(initialTree, '8').parentId, '7')

const applyResult = await applyBookmarkPlan({
  plan,
  bookmarksApi,
  storageApi,
  approval: {
    source: 'dashboard',
    phrase: 'APPLY',
  },
})

assert.equal(applyResult.ok, true)
assert.equal(applyResult.backup.stats.bookmarkCount, 4)
assert.equal(applyResult.backup.metadata.reason, 'before-apply')
assert.equal(applyResult.backup.metadata.bookmarkCount, 4)
assert.equal(applyResult.backup.metadata.checksum.startsWith('sha256:') || applyResult.backup.metadata.checksum.startsWith('fnv1a:'), true)
assert.equal(applyResult.verify.failed.length, 0)

const afterApply = await callback(bookmarksApi.getTree)
assert.equal(findNode(afterApply, '4').title, 'Renamed')
assert.equal(findNode(afterApply, '9').title, 'Recovered Title')
assert.equal(findNode(afterApply, '5'), null)
assert.equal(findNode(afterApply, '6'), null)
assert.equal(findNode(afterApply, '8').parentId, findFolder(afterApply, ['Bookmarks Bar', 'AI']).id)

const backup = await getBackupById({
  storageApi,
  backupId: applyResult.backup.id,
})
assert.equal(backup.id, applyResult.backup.id)

const restoreResult = await restoreBackup({
  bookmarksApi,
  storageApi,
  backupId: applyResult.backup.id,
})

assert.equal(restoreResult.ok, true)
assert.equal(restoreResult.preRestoreBackup.reason, 'before-restore')
assert.equal(restoreResult.preRestoreBackup.metadata.reason, 'before-restore')
const afterRestore = await callback(bookmarksApi.getTree)
assert.equal(findBookmarkByUrl(afterRestore, 'https://delete.example/').title, 'Delete Me')
assert.equal(findBookmarkByUrl(afterRestore, 'https://untitled.example/').title, '')
assert.equal(findFolder(afterRestore, ['Bookmarks Bar', 'Empty Folder']).children.length, 0)
assert.equal(findBookmarkByUrl(afterRestore, 'https://old.example/').title, 'Old')

const deleteBackupResult = await deleteBackup({
  storageApi,
  backupId: applyResult.backup.id,
})
assert.equal(deleteBackupResult.deleted, true)
assert.equal(deleteBackupResult.backupId, applyResult.backup.id)
assert.equal(await getBackupById({
  storageApi,
  backupId: applyResult.backup.id,
}), null)

const retentionStorageApi = createStorageApi()
const retentionBookmarksApi = createBookmarksApi(tree)
for (let index = 0; index < BACKUP_RETENTION_LIMIT + 2; index += 1) {
  await createBackup({
    bookmarksApi: retentionBookmarksApi,
    storageApi: retentionStorageApi,
    reason: 'manual',
    createdAt: new Date(Date.UTC(2026, 4, 8, 0, 0, index)).toISOString(),
  })
}
const retainedBackups = await listBackups({ storageApi: retentionStorageApi })
assert.equal(retainedBackups.length, BACKUP_RETENTION_LIMIT)
assert.equal(retainedBackups[0].createdAt, '2026-05-08T00:00:11.000Z')
assert.equal(retainedBackups.at(-1).createdAt, '2026-05-08T00:00:02.000Z')

const failingBookmarksApi = createBookmarksApi(tree, { failUpdateId: '4' })
const failFastResult = await applyBookmarkPlan({
  plan: {
    ...plan,
    operations: [
      {
        type: 'renameNode',
        id: '4',
        expectedTitle: 'Old',
        newTitle: 'Will Fail',
      },
      {
        type: 'renameNode',
        id: '9',
        expectedTitle: 'Untitled',
        newTitle: 'Must Not Run',
      },
    ],
  },
  bookmarksApi: failingBookmarksApi,
  storageApi: createStorageApi(),
  approval: {
    source: 'dashboard',
    phrase: 'APPLY',
  },
})
assert.equal(failFastResult.ok, false)
assert.equal(failFastResult.applied[0].status, 'failed')
assert.equal(failFastResult.applied[1].status, 'skipped')

console.log('Task 2-3 workflow smoke test passed: validate, dryRun, backup, apply, verify, restore, delete backup.')

function createBookmarksApi(initialTree, options = {}) {
  let nextId = 100
  const state = JSON.parse(JSON.stringify(initialTree))

  return {
    getTree(callback) {
      callback(JSON.parse(JSON.stringify(state)))
    },
    create(details, callback) {
      const parent = findNode(state, details.parentId)
      if (!parent) throw new Error(`Parent not found: ${details.parentId}`)
      if (!Array.isArray(parent.children)) parent.children = []
      const node = {
        id: String(nextId++),
        parentId: String(parent.id),
        title: details.title || '',
      }
      if (details.url) node.url = details.url
      if (!details.url) node.children = []
      parent.children.push(node)
      callback(JSON.parse(JSON.stringify(node)))
    },
    move(id, destination, callback) {
      const node = findNode(state, id)
      const parent = findParent(state, id)
      const nextParent = findNode(state, destination.parentId)
      if (!node || !parent || !nextParent) throw new Error('Move target missing.')
      parent.children = parent.children.filter((child) => String(child.id) !== String(id))
      node.parentId = String(nextParent.id)
      if (!Array.isArray(nextParent.children)) nextParent.children = []
      nextParent.children.push(node)
      callback(JSON.parse(JSON.stringify(node)))
    },
    update(id, changes, callback) {
      if (String(id) === String(options.failUpdateId)) throw new Error(`Injected update failure for ${id}`)
      const node = findNode(state, id)
      if (!node) throw new Error(`Node not found: ${id}`)
      Object.assign(node, changes)
      callback(JSON.parse(JSON.stringify(node)))
    },
    remove(id, callback) {
      const parent = findParent(state, id)
      if (!parent) throw new Error(`Parent not found for ${id}`)
      parent.children = parent.children.filter((child) => String(child.id) !== String(id))
      callback()
    },
    removeTree(id, callback) {
      const parent = findParent(state, id)
      if (!parent) throw new Error(`Parent not found for ${id}`)
      parent.children = parent.children.filter((child) => String(child.id) !== String(id))
      callback()
    },
  }
}

function createStorageApi() {
  const store = {}
  return {
    get(keys, callback) {
      if (typeof keys === 'string') {
        callback({ [keys]: store[keys] })
        return
      }
      callback({ ...store })
    },
    set(values, callback) {
      Object.assign(store, JSON.parse(JSON.stringify(values)))
      callback()
    },
  }
}

function callback(method) {
  return new Promise((resolve) => method((value) => resolve(value)))
}

function findNode(tree, id) {
  const stack = Array.isArray(tree) ? [...tree] : [tree]
  while (stack.length) {
    const node = stack.shift()
    if (String(node.id) === String(id)) return node
    if (Array.isArray(node.children)) stack.push(...node.children)
  }
  return null
}

function findParent(tree, id) {
  const stack = Array.isArray(tree) ? [...tree] : [tree]
  while (stack.length) {
    const node = stack.shift()
    if (Array.isArray(node.children) && node.children.some((child) => String(child.id) === String(id))) {
      return node
    }
    if (Array.isArray(node.children)) stack.push(...node.children)
  }
  return null
}

function findFolder(tree, path) {
  let cursor = Array.isArray(tree) ? tree[0] : tree
  for (const part of path) {
    cursor = (cursor.children || []).find((child) => child.title === part && !child.url)
  }
  return cursor || null
}

function findBookmarkByUrl(tree, url) {
  const stack = Array.isArray(tree) ? [...tree] : [tree]
  while (stack.length) {
    const node = stack.shift()
    if (node.url === url) return node
    if (Array.isArray(node.children)) stack.push(...node.children)
  }
  return null
}
