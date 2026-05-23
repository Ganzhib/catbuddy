import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import electron from "vite-plugin-electron";
import electronRenderer from "vite-plugin-electron-renderer";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ignorePackageEmit } from "../../scripts/vite-ignore-package-emit.mjs";
import { launchElectronDev } from "./scripts/launch-electron-dev.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const uiRoot = path.resolve(repoRoot, "packages/ui/src");

function copyDirRecursive(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(from, to);
    } else {
      fs.copyFileSync(from, to);
    }
  }
}

function copyMainAssetsPlugin() {
  const assetsSrc = path.join(__dirname, "src/main/assets");
  const assetsDest = path.join(__dirname, "dist-electron/assets");
  const preloadSrc = path.join(__dirname, "src/preload");
  const preloadDest = path.join(__dirname, "dist-electron/preload");

  function copy() {
    if (fs.existsSync(assetsSrc)) {
      copyDirRecursive(assetsSrc, assetsDest);
    }
    if (fs.existsSync(preloadSrc)) {
      copyDirRecursive(preloadSrc, preloadDest);
    }
    for (const envName of [".env.production"]) {
      const envSrc = path.join(__dirname, envName);
      if (fs.existsSync(envSrc)) {
        fs.copyFileSync(envSrc, path.join(__dirname, "dist-electron", envName));
      }
    }
  }

  return {
    name: "copy-main-assets",
    buildStart() {
      copy();
    },
    closeBundle() {
      copy();
    },
  };
}

export default defineConfig({
  root: path.resolve(__dirname, "src/renderer"),
  publicDir: path.resolve(__dirname, "public"),
  plugins: [
    react(),
    electron([
      {
        entry: path.resolve(__dirname, "src/main/index.ts"),
        onstart() {
          void launchElectronDev(__dirname);
        },
        vite: {
          build: {
            // Must be absolute: vite `root` is src/renderer, relative outDir ends up wrong.
            outDir: path.resolve(__dirname, "dist-electron"),
            emptyOutDir: false,
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
    copyMainAssetsPlugin(),
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
    },
  },
  build: {
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "src/renderer/index.html"),
      },
    },
  },
});
