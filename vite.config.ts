import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import pkg from './package.json'
import { iconPurgePlugin } from './icon-purge'

export default defineConfig({
  plugins: [react(), tailwindcss(), iconPurgePlugin()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  server: {
    port: 3000,
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name]-${pkg.name}-${pkg.version}-[hash:8].js`,
        chunkFileNames: `assets/[name]-${pkg.name}-${pkg.version}-[hash:8].js`,
        assetFileNames: `assets/[name]-${pkg.name}-${pkg.version}-[hash:8][extname]`,
        manualChunks(id) {
          if (id.includes('node_modules/@xterm')) return 'xterm';
          if (id.includes('node_modules/@dnd-kit')) return 'dndkit';
        },
      },
    },
  },
})
