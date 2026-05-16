import { createHttpBridge } from '../bridge/src/http-bridge.js'
import { readFileSync } from 'node:fs'

const TOKEN = '80fec2b6-4ad7-48e2-b686-3e7310821b37'
const plan = JSON.parse(readFileSync('/tmp/bookmarkops-plan.json', 'utf8'))

console.log(`Submitting plan: "${plan.summary}"`)
console.log(`Operations: ${plan.operations.length}`)

const bridge = createHttpBridge(7842)

try {
  const result = await bridge.enqueue('submit_plan', { plan }, TOKEN)
  console.log('\n✓ Plan submitted!')
  console.log('Validation:', result.validation?.ok ? '✓ passed' : '✗ failed')
  console.log('Dry Run:   ', result.dryRun?.ok ? '✓ passed' : '✗ failed')
  if (!result.validation?.ok) console.log('Errors:', JSON.stringify(result.validation?.errors, null, 2))
  if (result.dryRun?.preview) {
    const preview = result.dryRun.preview
    const ok = preview.filter(p => p.status === 'ready').length
    const blocked = preview.filter(p => p.status === 'blocked').length
    console.log(`Preview:    ${ok} ready, ${blocked} blocked`)
  }
  console.log('\n→ 請到 BookmarkOps Dashboard 的 Pending Approval 區塊，點「Refresh」後審核並核准。')
} catch (err) {
  console.error('✗ Error:', err.message)
} finally {
  bridge.close()
}
