import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/ws': {
        target: 'ws://localhost:18080',
        ws: true,
      },
    },
  },
  test: {
    environment: 'happy-dom',
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
})
