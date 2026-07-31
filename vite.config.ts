import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const apiTarget = env.NOVAAPM_API_PROXY_TARGET || 'http://127.0.0.1:8080';
  return {
    plugins: [react()],
    server: {
      port: 3001,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: false,
        },
        '/grafana': {
          target: apiTarget,
          changeOrigin: false,
          ws: true,
        },
      },
    },
  };
});
