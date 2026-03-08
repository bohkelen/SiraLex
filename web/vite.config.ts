import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig({
  base: "./",
  plugins: [
    ...(process.env.REPORT
      ? [
          visualizer({
            filename: "dist/stats.html",
            gzipSize: true,
            brotliSize: true,
            template: "treemap",
          }),
        ]
      : []),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "SiraLex",
        short_name: "SiraLex",
        description: "Offline-first dictionary",
        start_url: ".",
        scope: ".",
        display: "standalone",
        background_color: "#0b0f19",
        theme_color: "#0b0f19",
        icons: [
          {
            src: "icons/icon.svg",
            sizes: "192x192",
            type: "image/svg+xml",
            purpose: "any"
          },
          {
            src: "icons/icon.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "any"
          },
          {
            src: "icons/icon.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "maskable"
          }
        ]
      }
    })
  ]
});

