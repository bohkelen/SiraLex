import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Nkokan",
        short_name: "Nkokan",
        description: "Offline-first Maninka dictionary (Phase 2 harness)",
        start_url: "/",
        display: "standalone",
        background_color: "#0b0f19",
        theme_color: "#0b0f19",
        icons: [
          {
            src: "/icons/icon.svg",
            sizes: "any",
            type: "image/svg+xml"
          }
        ]
      }
    })
  ]
});

