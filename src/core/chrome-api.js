export function callbackApi(method, ...args) {
  return new Promise((resolve, reject) => {
    try {
      method(...args, (result) => {
        const runtimeError = getRuntimeError()
        if (runtimeError) {
          reject(runtimeError)
          return
        }

        resolve(result)
      })
    } catch (error) {
      reject(error)
    }
  })
}

export function getBookmarkTree(bookmarksApi) {
  return callbackApi(bookmarksApi.getTree.bind(bookmarksApi))
}

export function createBookmarkNode(bookmarksApi, createDetails) {
  return callbackApi(bookmarksApi.create.bind(bookmarksApi), createDetails)
}

export function moveBookmarkNode(bookmarksApi, id, destination) {
  return callbackApi(bookmarksApi.move.bind(bookmarksApi), id, destination)
}

export function updateBookmarkNode(bookmarksApi, id, changes) {
  return callbackApi(bookmarksApi.update.bind(bookmarksApi), id, changes)
}

export function removeBookmarkNode(bookmarksApi, id) {
  return callbackApi(bookmarksApi.remove.bind(bookmarksApi), id)
}

export function removeBookmarkTreeNode(bookmarksApi, id) {
  return callbackApi(bookmarksApi.removeTree.bind(bookmarksApi), id)
}

export function storageGet(storageApi, keys) {
  return callbackApi(storageApi.get.bind(storageApi), keys)
}

export function storageSet(storageApi, values) {
  return callbackApi(storageApi.set.bind(storageApi), values)
}

export function getRuntimeError() {
  const message = globalThis.chrome?.runtime?.lastError?.message
  return message ? new Error(message) : null
}
