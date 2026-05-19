import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.json' with { type: 'json' }

export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    rollupOptions: {
      input: {
        popup: fileURLToPath(new URL('./index.html', import.meta.url)),
        dashboard: fileURLToPath(new URL('./dashboard.html', import.meta.url)),
      },
      output: {
        // Strip the internal repo basename from rollup-derived chunk / asset
        // names so the literal string never leaks into dist/.
        chunkFileNames: (chunkInfo) => {
          const safe = (chunkInfo.name || 'chunk').replace(/bookmarkops-internal/g, 'bookmarkops')
          return `assets/${safe}-[hash].js`
        },
        assetFileNames: (assetInfo) => {
          const raw = assetInfo.name || ''
          const safe = raw.replace(/bookmarkops-internal/g, 'bookmarkops')
          if (!safe) return 'assets/[name]-[hash][extname]'
          const dot = safe.lastIndexOf('.')
          if (dot < 0) return `assets/${safe}-[hash]`
          return `assets/${safe.slice(0, dot)}-[hash]${safe.slice(dot)}`
        },
      },
    },
  },
})
