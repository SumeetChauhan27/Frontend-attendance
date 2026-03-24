import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(() => {
  return {
    base: '/',
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon.svg'],
        manifest: {
          name: 'Terna Engineering College Attendance Portal',
          short_name: 'Attendance',
          description: 'QR-based attendance portal',
          theme_color: '#5d2fd2',
          background_color: '#f2f2fb',
          display: 'standalone',
          start_url: '/',
          icons: [
            {
              src: 'icon.svg',
              sizes: '512x512',
              type: 'image/svg+xml',
              purpose: 'any',
            },
          ],
        },
      }),
    ],
    server: {
      host: true,
      proxy: {
        '/api': 'http://localhost:5000',
      },
    },
    build: {
      // Target modern browsers for smaller output
      target: 'es2020',
      // Increase warning threshold (face-api.js is legitimately large)
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            // React ecosystem — tiny, fast, cached separately
            if (id.includes('node_modules/react') ||
                id.includes('node_modules/react-dom') ||
                id.includes('node_modules/react-router-dom') ||
                id.includes('node_modules/scheduler')) {
              return 'react-vendor'
            }
            // TensorFlow + face-api — huge, lazy-loaded, cache separately
            if (id.includes('@tensorflow') || id.includes('face-api')) {
              return 'face-chunk'
            }
            // QR scanning / generation
            if (id.includes('@zxing') || id.includes('qrcode')) {
              return 'qr-chunk'
            }
            // PapaParse + spreadsheet utilities
            if (id.includes('papaparse')) {
              return 'csv-chunk'
            }
          },
        },
      },
    },
  }
})
