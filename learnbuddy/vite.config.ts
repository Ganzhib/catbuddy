import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import electron from "vite-plugin-electron";
import electronRenderer from "vite-plugin-electron-renderer";
import fs from "node:fs";
import path from "node:path";

// 复制纯 CJS 的 preload 脚本（不需要编译）
function copyPreloadPlugin() {
  const src = path.join(__dirname, "electron/preload.cjs");
  const dest = path.join(__dirname, "dist-electron/preload.cjs");

  function copyPreload() {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }

  return {
    name: "copy-preload",
    // Dev: electron may start before closeBundle — sync preload early.
    buildStart() {
      copyPreload();
    },
    closeBundle() {
      copyPreload();
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: "electron/main.ts",
        vite: {
          build: {
            outDir: "dist-electron",
            rollupOptions: {
              external: [
                "electron",
                "ws",
                "bufferutil",
                "utf-8-validate",
              ],
            },
          },
          resolve: {
            alias: { "@shared": path.resolve(__dirname, "shared") },
          },
        },
      },
    ]),
    electronRenderer(),
    copyPreloadPlugin(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
  server: {
    proxy: {
      "/relay-api": {
        target: "http://127.0.0.1:18765",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/relay-api/, ""),
      },
      "/relay-ws": {
        target: "http://127.0.0.1:18765",
        ws: true,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/relay-ws/, ""),
      },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        "relay-web": path.resolve(__dirname, "relay-web.html"),
      },
    },
  },
});
