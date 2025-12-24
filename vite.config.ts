import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'

// 브라우저 전용 모드: BROWSER_ONLY=true 또는 --mode browser
const isBrowserOnly = process.env.BROWSER_ONLY === 'true'

export default defineConfig({
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
    // Electron 플러그인 (브라우저 전용 모드에서는 비활성화)
    ...(!isBrowserOnly ? [
      electron([
        {
          // Main-Process entry file of the Electron App.
          entry: 'electron/main.ts',
          onstart(options) {
            // Start Electron App
            options.startup()
            console.log('Dev server started')
          },
          vite: {
            build: {
              rollupOptions: {
                external: [
                  'electron',
                  '@prisma/client',
                  '.prisma/client',
                  /^node:/,  // Node.js built-in modules
                ],
              },
            },
          },
        },
        {
          entry: 'electron/preload.ts',
          onstart(options) {
            // Notify the Renderer-Process to reload the page when the Preload-Scripts build is complete,
            // instead of restarting the entire Electron App.
            options.reload()
          },
        },
      ]),
      renderer(),
    ] : []),
  ],
  server: {
    port: 5173,
    strictPort: true,
  },
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },
})
