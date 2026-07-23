import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Rule 4: everything is bundled and local. The PWA plugin precaches the
// entire build output so the app works fully offline after first load.
export default defineConfig({
  // Served from GitHub Pages at /<repo-name>/.
  base: '/MyFashionDesigns/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'Your Drawings Real Life',
        short_name: 'Drawings RL',
        description: 'Draw fashion designs directly onto the figure.',
        display: 'standalone',
        orientation: 'any',
        background_color: '#faf7f2',
        theme_color: '#faf7f2',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,json,webmanifest}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024
      }
    })
  ],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1600
  }
})
