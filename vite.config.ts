import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [],
        workbox: {
          maximumFileSizeToCacheInBytes: 25 * 1024 * 1024,
        },
        manifest: {
          name: 'ES TRIMS LIMITED',
          short_name: 'ES TRIMS LTD',
          description: 'A comprehensive online inventory management system.',
          theme_color: '#2563eb',
          background_color: '#ffffff',
          display: 'standalone',
          icons: [
            {
              src: 'https://lh3.googleusercontent.com/d/14Hu8k6jVbcjgZUGJTeCqETFfi9E_JncE',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'https://lh3.googleusercontent.com/d/14Hu8k6jVbcjgZUGJTeCqETFfi9E_JncE',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        }
      })
    ],
    build: {
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'vendor-firebase': ['firebase/app', 'firebase/firestore', 'firebase/auth'],
            'vendor-charts': ['recharts'],
            'vendor-utils': ['xlsx', 'papaparse', 'date-fns', 'clsx', 'tailwind-merge'],
            'vendor-ui': ['lucide-react', 'motion'],
          },
        },
      },
    },
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
