import { createHttpBridge } from '../bridge/src/http-bridge.js'

const TOKEN = '80fec2b6-4ad7-48e2-b686-3e7310821b37'
const bridge = createHttpBridge(7842)

const result = await bridge.enqueue('scan_bookmarks', {}, TOKEN)
bridge.close()

process.stdout.write(JSON.stringify(result, null, 2))
