import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  base: '/buddhist-translator/',
  plugins: [react(), tailwindcss()],
  server: {
    port: 5178,
    proxy: {
      '/notion-api': {
        target: 'https://api.notion.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/notion-api/, ''),
      },
    },
  },
  preview: {
    port: 5178,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
