# Desktop installer (static download)

Web UI links to `/downloads/learnbuddy-setup-win-x64.exe`.

## Stage installer (cross-platform)

From `learnbuddy/` after `pnpm build:desktop`:

```bash
pnpm build:web
```

(`build:web` = stage installer + Vite build. Only Vite: `pnpm build:web:only`.)

One-shot (desktop + web):

```bash
pnpm build:release
```

Manual source path:

```bash
node scripts/stage-desktop-installer.mjs --source apps/desktop/release-fresh/learnbuddy\ Setup\ 0.1.0.exe
```

Or set `VITE_DESKTOP_DOWNLOAD_URL` in `apps/web/.env.production` to a CDN URL.
