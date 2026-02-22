import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon.svg'],
        manifest: {
          name: "Today's Recipe",
          short_name: "Today's Recipe",
          description: 'Get Middle Eastern and Western fast food recipes from ingredients or a photo',
          theme_color: '#667eea',
          background_color: '#667eea',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          scope: '/',
          id: '/',
          icons: [
            { src: '/icon.svg', type: 'image/svg+xml', sizes: 'any', purpose: 'any' },
            { src: '/icon.svg', type: 'image/svg+xml', sizes: 'any', purpose: 'maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          navigateFallback: '/index.html',
        },
      }),
    ],
    // Do NOT inject GEMINI_API_KEY into the client — it would be leaked. API calls go through Netlify Functions / server.
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
