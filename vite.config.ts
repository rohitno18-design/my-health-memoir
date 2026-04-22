import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // TEMPORARY: selfDestroying mode kills the old cached SW on user devices.
    // After user confirms fresh code loads, revert to full PWA config.
    VitePWA({
      selfDestroying: true,
      devOptions: {
        enabled: true
      },
      manifest: {
        name: 'I M Smrti',
        short_name: 'I M Smrti',
        description: 'Universal Health OS — Your complete medical record, always with you.',
        theme_color: '#0f172a',
        background_color: '#f8fafc',
        display: 'standalone',
        orientation: 'portrait',
        display_override: ['standalone', 'minimal-ui'],
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})

