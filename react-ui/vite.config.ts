import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@/components': resolve(__dirname, './src/components'),
      '@/hooks': resolve(__dirname, './src/hooks'),
      '@/utils': resolve(__dirname, './src/utils'),
      '@/stores': resolve(__dirname, './src/stores'),
      '@/types': resolve(__dirname, './src/types'),
      '@/styles': resolve(__dirname, './src/styles')
    }
  },
  server: {
    port: 3001,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false
      },
      '/get-key': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false
      },
      '/light-types': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false
      },
      '/wled-settings': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false
      },
      '/yeelight-settings': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    minify: 'esbuild',
    target: 'esnext'
  }
})
