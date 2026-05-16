import { createTreeIndex, getNodeParentPath, isBookmark, isFolder, normalizeTitle, pathsEqual } from './bookmark-tree.js'

export const PLAN_OPERATION_TYPES = [
  'createFolder',
  'moveBookmark',
  'renameNode',
  'deleteBookmark',
  'deleteEmptyFolder',
]

const COMMON_PLAN_FIELDS = ['bookmarkopsVersion', 'summary', 'riskLevel', 'createdBy', 'createdAt', 'dryRun', 'operations']
const OP_FIELDS = {
  createFolder: ['type', 'path', 'description'],
  moveBookmark: ['type', 'id', 'expectedTitle', 'expectedUrl', 'expectedParentPath', 'destination', 'description'],
  renameNode: ['type', 'id', 'expectedTitle', 'newTitle', 'description'],
  deleteBookmark: ['type', 'id', 'expectedTitle', 'expectedUrl', 'expectedParentPath', 'description'],
  deleteEmptyFolder: ['type', 'id', 'expectedTitle', 'expectedParentPath', 'description'],
}

export function validateBookmarkPlan(plan, { bookmarkTree = null } = {}) {
  const errors = []
  const warnings = []

  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
    return failure(['Plan must be a JSON object.'])
  }

  rejectUnknownFields(plan, COMMON_PLAN_FIELDS, 'plan', errors)
  requireString(plan, 'bookmarkopsVersion', 'plan', errors)
  requireString(plan, 'summary', 'plan', errors)
  requireString(plan, 'createdBy', 'plan', errors)
  requireString(plan, 'createdAt', 'plan', errors)

  if (!['low', 'medium', 'high'].includes(plan.riskLevel)) {
    errors.push('plan.riskLevel must be low, medium, or high.')
  }

  if (!Array.isArray(plan.operations) || plan.operations.length === 0) {
    errors.push('plan.operations must contain at least one operation.')
  }

  const index = bookmarkTree ? createTreeIndex(bookmarkTree) : null

  if (Array.isArray(plan.operations)) {
    plan.operations.forEach((operation, operationIndex) => {
      validateOperation(operation, operationIndex, errors, warnings, index)
    })
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    operationCount: Array.isArray(plan.operations) ? plan.operations.length : 0,
    supportedOperations: PLAN_OPERATION_TYPES,
  }
}

export function assertValidPlan(plan, options) {
  const validation = validateBookmarkPlan(plan, options)
  if (!validation.ok) {
    throw new Error(validation.errors.join(' '))
  }

  return validation
}

function validateOperation(operation, operationIndex, errors, warnings, index) {
  const label = `operations[${operationIndex}]`

  if (!operation || typeof operation !== 'object' || Array.isArray(operation)) {
    errors.push(`${label} must be an object.`)
    return
  }

  const { type } = operation
  if (!PLAN_OPERATION_TYPES.includes(type)) {
    errors.push(`${label}.type is unsupported.`)
    return
  }

  rejectUnknownFields(operation, OP_FIELDS[type], label, errors)

  if (type === 'createFolder') {
    requirePath(operation, 'path', label, errors)
    return
  }

  requireString(operation, 'id', label, errors)
  requireString(operation, 'expectedTitle', label, errors)

  if (type === 'moveBookmark') {
    requireString(operation, 'expectedUrl', label, errors)
    requirePath(operation, 'expectedParentPath', label, errors)
    requirePath(operation, 'destination', label, errors)
  }

  if (type === 'renameNode') {
    requireString(operation, 'newTitle', label, errors)
  }

  if (type === 'deleteBookmark') {
    requireString(operation, 'expectedUrl', label, errors)
    requirePath(operation, 'expectedParentPath', label, errors)
  }

  if (type === 'deleteEmptyFolder') {
    requirePath(operation, 'expectedParentPath', label, errors)
  }

  if (index && operation.id) {
    validateExpectedNode(operation, label, errors, warnings, index)
  }
}

function validateExpectedNode(operation, label, errors, warnings, index) {
  const node = index.byId.get(String(operation.id))
  if (!node) {
    warnings.push(`${label}: target id ${operation.id} is not present in the latest scan.`)
    return
  }

  if (operation.type === 'moveBookmark' || operation.type === 'deleteBookmark') {
    if (!isBookmark(node)) {
      errors.push(`${label}: target id ${operation.id} is not a bookmark.`)
    }
  }

  if (operation.type === 'deleteEmptyFolder') {
    if (!isFolder(node)) {
      errors.push(`${label}: target id ${operation.id} is not a folder.`)
    }
  }

  if (
    typeof operation.expectedTitle === 'string'
    && typeof node.title === 'string'
    && normalizeTitle(node.title) !== operation.expectedTitle
  ) {
    warnings.push(`${label}: expectedTitle does not match the latest scan.`)
  }

  if (
    typeof operation.expectedUrl === 'string'
    && typeof node.url === 'string'
    && node.url !== operation.expectedUrl
  ) {
    warnings.push(`${label}: expectedUrl does not match the latest scan.`)
  }

  if (
    Array.isArray(operation.expectedParentPath)
    && !pathsEqual(getNodeParentPath(index, operation.id), operation.expectedParentPath)
  ) {
    warnings.push(`${label}: expectedParentPath does not match the latest scan.`)
  }
}

function rejectUnknownFields(object, allowedFields, label, errors) {
  for (const field of Object.keys(object)) {
    if (!allowedFields.includes(field)) {
      errors.push(`${label}.${field} is not allowed.`)
    }
  }
}

function requireString(object, field, label, errors) {
  if (typeof object[field] !== 'string' || object[field].trim() === '') {
    errors.push(`${label}.${field} must be a non-empty string.`)
  }
}

function requirePath(object, field, label, errors) {
  const path = object[field]
  if (!Array.isArray(path) || path.length === 0 || path.some((part) => typeof part !== 'string' || part.trim() === '')) {
    errors.push(`${label}.${field} must be a non-empty string array.`)
  }
}

function failure(errors) {
  return {
    ok: false,
    errors,
    warnings: [],
    operationCount: 0,
    supportedOperations: PLAN_OPERATION_TYPES,
  }
}
