import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Khi phát triển, Vite chuyển tiếp API, WebSocket và /health sang Backend An Tâm (cổng 8080)
// để trình duyệt chỉ làm việc với một origin. Bản build được Backend phục vụ trực tiếp.
const backend = process.env.ANTAM_BACKEND || 'http://127.0.0.1:8080';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '127.0.0.1',
    proxy: {
      '/api': { target: backend },
      '/health': { target: backend },
      '/ws': { target: backend.replace(/^http/, 'ws'), ws: true }
    }
  }
});
