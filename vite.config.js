import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 将 /api 请求代理到本地后端（默认 8787）。
// OAuth 回调地址登记在 5173 端口，靠此代理转发到后端处理。
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: false,
      },
    },
  },
});
