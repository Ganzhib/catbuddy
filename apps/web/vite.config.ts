import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ignorePackageEmit } from "../../scripts/vite-ignore-package-emit.mjs";
import { gatewayPreflightPlugin } from "../../scripts/gateway-preflight.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const uiRoot = path.resolve(repoRoot, "packages/ui/src");

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "");
  const useCatbuddyGateway =
    env.VITE_USE_GATEWAY === "true"
    || (mode === "development" && env.VITE_USE_GATEWAY !== "false");
  const catbuddyGatewayTarget =
    env.VITE_GATEWAY_HTTP_URL ?? env.VITE_GATEWAY_URL ?? "http://127.0.0.1:18765";
  const nanobotTarget = env.VITE_GATEWAY_URL ?? "http://127.0.0.1:8765";
  const gatewayTarget = useCatbuddyGateway ? catbuddyGatewayTarget : nanobotTarget;
  const wsTarget = gatewayTarget.replace(/^http/, "ws");

  if (mode === "development") {
    console.log(
      `[catbuddy/web] gateway proxy → ${gatewayTarget} (catbuddy=${useCatbuddyGateway})`,
    );
    if (useCatbuddyGateway) {
      console.log(
        "[catbuddy/web] 需先启动 Gateway: pnpm gateway:dev  或一键 pnpm dev:web:full",
      );
    }
  }

  let gatewayWsProxyWarned = false;
  const onGatewayWsProxyError = (err: NodeJS.ErrnoException) => {
    if (gatewayWsProxyWarned) return;
    if (err.code !== "ECONNREFUSED" && err.code !== "ECONNRESET") return;
    gatewayWsProxyWarned = true;
    console.error(
      "\n[catbuddy/web] Gateway WebSocket 不可用（" + err.code + "）。\n"
        + "  请先另开终端: pnpm gateway:dev\n"
        + "  或一键:       pnpm dev:web:full\n"
        + "  自检:         curl http://127.0.0.1:18765/health\n",
    );
  };

  const proxy: Record<string, object> = {
    "/gateway-api": {
      target: catbuddyGatewayTarget,
      changeOrigin: true,
      rewrite: (p: string) => p.replace(/^\/gateway-api/, ""),
    },
    "/gateway-ws": {
      target: catbuddyGatewayTarget,
      ws: true,
      changeOrigin: true,
      rewrite: (p: string) => p.replace(/^\/gateway-ws/, ""),
      configure: (proxy) => {
        proxy.on("error", onGatewayWsProxyError);
      },
    },
    "/webui": { target: gatewayTarget, changeOrigin: true },
    "/api": { target: gatewayTarget, changeOrigin: true },
    "/auth": { target: gatewayTarget, changeOrigin: true },
  };

  if (!useCatbuddyGateway) {
    proxy["/"] = {
      target: wsTarget,
      ws: true,
      changeOrigin: true,
      bypass(req: { headers: { upgrade?: string }; url?: string }) {
        if (req.headers.upgrade?.toLowerCase() === "websocket") return;
        return req.url;
      },
    };
  }

  return {
    root: __dirname,
    plugins: [react(), gatewayPreflightPlugin(useCatbuddyGateway)],
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
