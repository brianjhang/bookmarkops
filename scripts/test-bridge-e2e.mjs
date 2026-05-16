// End-to-end test: bridge → extension → Chrome bookmarks
import { createHttpBridge } from '../bridge/src/http-bridge.js'

const TOKEN = '80fec2b6-4ad7-48e2-b686-3e7310821b37'

console.log('Starting bridge on :7842 ...')
const bridge = createHttpBridge(7842)

console.log('Sending scan_bookmarks request — waiting for Chrome extension to pick it up ...')
console.log('(Make sure BookmarkOps Dashboard is open in Chrome)\n')

try {
  const result = await bridge.enqueue('scan_bookmarks', {}, TOKEN)
  console.log('✓ Extension responded!')
  console.log(`  Bookmarks: ${result.stats?.bookmarkCount ?? '?'}`)
  console.log(`  Folders:   ${result.stats?.folderCount ?? '?'}`)
  console.log(`  Health:    ${JSON.stringify(result.stats?.usageBuckets ?? {})}`)
} catch (err) {
  console.error('✗ Failed:', err.message)
} finally {
  bridge.close()
  process.exit(0)
}
