import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ignorePackageEmit } from "../../scripts/vite-ignore-package-emit.mjs";
import { gatewayPreflightPlugin } from "../../scripts/gateway-preflight.mjs";
import { setupCatbuddyViteDev } from "../../packages/shared/src/vite-dev.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const uiRoot = path.resolve(repoRoot, "packages/ui/src");

export default defineConfig(({ mode }) => {
  const { useCatbuddyGateway, catbuddyGatewayTarget, envDefine, proxy } =
    setupCatbuddyViteDev(mode, "web");

  return {
    root: __dirname,
    define: envDefine,
    plugins: [react(), gatewayPreflightPlugin(useCatbuddyGateway, catbuddyGatewayTarget)],
    resolve: {
      alias: [
        { find: "@", replacement: uiRoot },
        { find: /^@catbuddy\/ui$/, replacement: path.resolve(repoRoot, "packages/ui/src/index.ts") },
        { find: /^@catbuddy\/ui\//, replacement: `${path.resolve(repoRoot, "packages/ui/src")}/` },
        { find: "@catbuddy/shared/brand", replacement: path.resolve(repoRoot, "packages/shared/src/brand.mjs") },
        { find: /^@catbuddy\/shared$/, replacement: path.resolve(repoRoot, "packages/shared/src/index.ts") },
        { find: "@catbuddy/client", replacement: path.resolve(repoRoot, "packages/client/src/index.ts") },
        { find: "@catbuddy/platform", replacement: path.resolve(repoRoot, "packages/platform/src/index.ts") },
      ],
    },
    server: {
      host: "127.0.0.1",
      port: 5173,
      strictPort: true,
      hmr: { host: "127.0.0.1", port: 5174 },
      watch: {
        ignored: [ignorePackageEmit],
      },
      proxy,
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
  };
});
