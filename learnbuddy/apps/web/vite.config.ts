import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const uiRoot = path.resolve(repoRoot, "packages/ui/src");

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "");
  const target = env.VITE_GATEWAY_URL ?? "http://127.0.0.1:8765";
  const wsTarget = target.replace(/^http/, "ws");

  return {
    root: __dirname,
    plugins: [react()],
    resolve: {
      alias: [
        { find: "@", replacement: uiRoot },
        { find: /^@learnbuddy\/ui$/, replacement: path.resolve(repoRoot, "packages/ui/src/index.ts") },
        { find: /^@learnbuddy\/ui\//, replacement: `${path.resolve(repoRoot, "packages/ui/src")}/` },
        { find: "@learnbuddy/shared/brand", replacement: path.resolve(repoRoot, "packages/shared/src/brand.mjs") },
        { find: /^@learnbuddy\/shared$/, replacement: path.resolve(repoRoot, "packages/shared/src/index.ts") },
        { find: "@learnbuddy/client", replacement: path.resolve(repoRoot, "packages/client/src/index.ts") },
        { find: "@learnbuddy/platform", replacement: path.resolve(repoRoot, "packages/platform/src/index.ts") },
      ],
    },
    server: {
      host: "127.0.0.1",
      port: 5173,
      strictPort: true,
      hmr: { host: "127.0.0.1", port: 5174 },
      proxy: {
        "/webui": { target, changeOrigin: true },
        "/api": { target, changeOrigin: true },
        "/auth": { target, changeOrigin: true },
        "/": {
          target: wsTarget,
          ws: true,
          changeOrigin: true,
          bypass(req) {
            if (req.headers.upgrade?.toLowerCase() === "websocket") return;
            return req.url;
          },
        },
      },
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
    },
  };
});
