import { createHttpBridge } from '../bridge/src/http-bridge.js'

const TOKEN = '80fec2b6-4ad7-48e2-b686-3e7310821b37'
const bridge = createHttpBridge(7842)

const result = await bridge.enqueue('get_report', { format: 'json' }, TOKEN)
bridge.close()

process.stdout.write(typeof result === 'string' ? result : JSON.stringify(result, null, 2))
