import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Ask before reloading into a new version: a reload would drop taps in flight.
      registerType: "prompt",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "BrickCheck",
        short_name: "BrickCheck",
        description: "Check your LEGO sets piece by piece, together.",
        theme_color: "#d01012",
        background_color: "#fafafa",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // The app shell works offline; every route falls back to index.html.
        navigateFallback: "index.html",
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        // Supabase (API, auth, realtime) is never cached: only part and set images are.
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.origin === "https://cdn.rebrickable.com",
            handler: "CacheFirst",
            options: {
              cacheName: "rebrickable-images",
              expiration: {
                maxEntries: 3000,
                maxAgeSeconds: 60 * 60 * 24 * 60,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  build: {
    rolldownOptions: {
      output: {
        // Libraries change less often than the app: separate chunks stay cached across deploys.
        codeSplitting: {
          groups: [
            {
              name: "react",
              test: /node_modules[\\/](react|react-dom|scheduler|react-router)[\\/]/,
            },
            { name: "supabase", test: /node_modules[\\/]@supabase[\\/]/ },
          ],
        },
      },
    },
  },
  // Listen on the LAN so the app can be tested on a phone.
  server: { host: true },
});
