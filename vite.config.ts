import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // 第3引数 '' で VITE_ 以外（シェルの環境変数を含む）も読む。フロントには露出しない
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    server: {
      // ローカル開発では /api を FastAPI (uvicorn) に転送し、本番と同じ同一オリジン構成にする
      proxy: {
        '/api': {
          target: env.API_PROXY_TARGET || 'http://127.0.0.1:8000',
          changeOrigin: false,
        },
      },
    },
  };
});
