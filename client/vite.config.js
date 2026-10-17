import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development the API runs on :5000. Proxying keeps cookies same-origin (no CORS or SameSite headaches).
const API = process.env.VITE_DEV_API || 'http://localhost:5001';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': API,
      '/uploads': API,
      '/socket.io': { target: API, ws: true },
    },
  },
  test: { environment: 'jsdom', globals: true, setupFiles: './src/test/setup.js', css: false },
});
