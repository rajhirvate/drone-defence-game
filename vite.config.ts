import { defineConfig, type Plugin } from 'vite'
import { GAME_DESCRIPTION, GAME_TITLE } from './src/config.ts'

function gameMeta(): Plugin {
  const manifest = JSON.stringify(
    {
      name: GAME_TITLE,
      short_name: GAME_TITLE,
      description: GAME_DESCRIPTION,
      start_url: '.',
      scope: '.',
      display: 'standalone',
      orientation: 'any',
      background_color: '#070914',
      theme_color: '#070914',
      icons: [
        { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
        { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      ],
    },
    null,
    2,
  )

  return {
    name: 'game-meta',
    transformIndexHtml(html) {
      return html
        .replaceAll('%GAME_TITLE%', GAME_TITLE)
        .replaceAll('%GAME_DESCRIPTION%', GAME_DESCRIPTION)
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0]
        if (url === '/manifest.webmanifest') {
          res.setHeader('Content-Type', 'application/manifest+json')
          res.end(manifest)
          return
        }
        next()
      })
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'manifest.webmanifest',
        source: manifest,
      })
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [gameMeta()],
  server: { host: '0.0.0.0', port: 5173 },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    target: 'es2022',
    chunkSizeWarningLimit: 1600,
  },
})
