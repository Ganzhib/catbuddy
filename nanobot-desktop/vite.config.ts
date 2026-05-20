import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import electron from "vite-plugin-electron";
import electronRenderer from "vite-plugin-electron-renderer";
import path from "node:path";

// 复制纯 CJS 的 preload 脚本（不需要编译）
function copyPreloadPlugin() {
  return {
    name: "copy-preload",
    closeBundle() {
      const fs = require("node:fs");
      fs.copyFileSync(
        path.join(__dirname, "/electron/preload.cjs"),
        path.join(__dirname, "/dist-electron/preload.cjs")
      );
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
