import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/n8n-api': {
        target: 'http://127.0.0.1:5678',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/n8n-api/, ''),
        timeout: 900000,
        proxyTimeout: 900000
      }
    }
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
    proxy: {
      '/n8n-api': {
        target: 'http://127.0.0.1:5678',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/n8n-api/, ''),
        timeout: 900000,
        proxyTimeout: 900000
      }
    }
  }
});
