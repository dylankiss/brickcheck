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
      manifest: {
        name: "BrickCheck",
        short_name: "BrickCheck",
        description: "Check your LEGO sets piece by piece, together.",
        theme_color: "#d01012",
        background_color: "#fafafa",
        display: "standalone",
        start_url: "/",
        categories: ["utilities", "lifestyle"],
        // Long-press shortcuts on the installed icon (Android, desktop).
        shortcuts: [
          {
            name: "Add a set",
            short_name: "Add set",
            url: "/new",
            icons: [
              { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
            ],
          },
          {
            name: "Missing in all sets",
            short_name: "Missing",
            url: "/missing",
            icons: [
              { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
            ],
          },
        ],
        // Explicit identity and scope, so browsers that route links to
        // installed apps know every path of this origin belongs to it.
        id: "/",
        scope: "/",
        // Chromium: a link that launches the app reuses the open window.
        launch_handler: { client_mode: "navigate-existing" },
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
        // Nothing is cached at runtime. Supabase (API, auth, realtime) must never be.
        // Rebrickable images send no CORS headers, so a service worker could only
        // store them as opaque responses, which browsers count as ~7 MB each
        // against the quota. They are cached by the browser's HTTP cache instead
        // (the CDN sends max-age=31536000), which also serves them offline.
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
