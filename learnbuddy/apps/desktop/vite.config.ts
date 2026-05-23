import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import electron from "vite-plugin-electron";
import electronRenderer from "vite-plugin-electron-renderer";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ignorePackageEmit } from "../../scripts/vite-ignore-package-emit.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const uiRoot = path.resolve(repoRoot, "packages/ui/src");

function copyPreloadPlugin() {
  const src = path.join(__dirname, "electron/preload.cjs");
  const dest = path.join(__dirname, "dist-electron/preload.cjs");

  function copyPreload() {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }

  return {
    name: "copy-preload",
    buildStart() {
      copyPreload();
    },
    closeBundle() {
      copyPreload();
    },
  };
}

export default defineConfig({
  root: __dirname,
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
            alias: {
              "@learnbuddy/shared/brand": path.resolve(repoRoot, "packages/shared/src/brand.mjs"),
              "@learnbuddy/shared": path.resolve(repoRoot, "packages/shared/src/index.ts"),
              "@learnbuddy/gateway-sdk-desktop": path.resolve(
                repoRoot,
                "gateway/packages/sdk-desktop/src/index.ts",
              ),
            },
          },
        },
      },
    ]),
    electronRenderer(),
    copyPreloadPlugin(),
  ],
  resolve: {
    alias: [
      { find: "@", replacement: uiRoot },
      { find: /^@learnbuddy\/ui$/, replacement: path.resolve(repoRoot, "packages/ui/src/index.ts") },
      { find: /^@learnbuddy\/ui\//, replacement: `${path.resolve(repoRoot, "packages/ui/src")}/` },
      { find: "@learnbuddy/shared/brand", replacement: path.resolve(repoRoot, "packages/shared/src/brand.mjs") },
      { find: /^@learnbuddy\/shared$/, replacement: path.resolve(repoRoot, "packages/shared/src/index.ts") },
      { find: "@learnbuddy/client", replacement: path.resolve(repoRoot, "packages/client/src/index.ts") },
      { find: "@learnbuddy/platform", replacement: path.resolve(repoRoot, "packages/platform/src/index.ts") },
      {
        find: "@learnbuddy/gateway-sdk-desktop",
        replacement: path.resolve(repoRoot, "gateway/packages/sdk-desktop/src/index.ts"),
      },
    ],
  },
  server: {
    watch: {
      ignored: [ignorePackageEmit],
    },
    proxy: {
      "/gateway-api": {
        target: "http://127.0.0.1:18765",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/gateway-api/, ""),
      },
      "/gateway-ws": {
        target: "http://127.0.0.1:18765",
        ws: true,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/gateway-ws/, ""),
      },
      "/gateway-api": {
        target: "http://127.0.0.1:18765",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/gateway-api/, ""),
      },
      "/gateway-ws": {
        target: "http://127.0.0.1:18765",
        ws: true,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/gateway-ws/, ""),
      },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
      },
    },
  },
});
