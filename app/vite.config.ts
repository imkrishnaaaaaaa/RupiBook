import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'
import { readFileSync } from 'node:fs'

// package.json is the one place the app's version is written by hand —
// everywhere else (in-app "About" text, Android's build.gradle) reads it
// from here instead of repeating the string, so bumping it can't miss a spot.
const pkg = JSON.parse(readFileSync(path.resolve(__dirname, './package.json'), 'utf-8')) as { version: string }

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg'],
      manifest: {
        name: 'RupiBook',
        short_name: 'RupiBook',
        description: 'Personal expense tracking with budgets, analytics and offline logging.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0a0c11',
        theme_color: '#0a0c11',
        lang: 'en-IN',
        categories: ['finance', 'productivity'],
        icons: [
          { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        // ponytail: no runtimeCaching of *.supabase.co — expense data must not
        // sit in Cache Storage past logout, and stale API replays break trust.
        // Offline reads come from React Query's memory cache instead.
      },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
