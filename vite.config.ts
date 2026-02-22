import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { createRequire } from "node:module";
import { defineConfig } from "vite";

const require = createRequire(import.meta.url);

export default defineConfig(() => {
  const plugins = [react(), tailwindcss()];
  try {
    const { VitePWA } = require("vite-plugin-pwa");
    plugins.push(
      VitePWA({
        registerType: "autoUpdate",

        includeAssets: ["icon2.png"],
        manifest: {
          name: "Today's Recipe",
          short_name: "Today's Recipe",
          description:
            "Get Middle Eastern and Western fast food recipes from ingredients or a photo",
          theme_color: "#667eea",
          background_color: "#667eea",
          display: "standalone",
          orientation: "portrait",
          start_url: "/",
          scope: "/",
          id: "/",
          icons: [
            {
              src: "/icon2.png",
              type: "image/png",
              sizes: "192x192",
              purpose: "any",
            },
            {
              src: "/icon2.png",
              type: "image/png",
              sizes: "512x512",
              purpose: "any maskable",
            },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
          navigateFallback: "/index.html",
        },
      }),
    );
  } catch {
    // vite-plugin-pwa not installed; PWA features disabled until you run: npm install
  }
  return {
    plugins,
    // Do NOT inject GEMINI_API_KEY into the client — it would be leaked. API calls go through Netlify Functions / server.
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== "true",
    },
  };
});
