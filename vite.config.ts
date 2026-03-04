import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  base: '/buddhist-translator/',
  plugins: [react(), tailwindcss()],
  server: {
    port: 5178,
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
