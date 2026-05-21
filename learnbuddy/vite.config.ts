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
              external: ["electron"],
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
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
