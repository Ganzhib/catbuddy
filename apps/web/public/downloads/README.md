# Desktop installer (legacy local staging)

The production Web UI downloads installers from GitHub Releases. Stable latest-release URLs are
defined in `packages/shared/src/desktop-download.ts`.

This directory and the staging command below are retained only for local testing or a self-hosted
download override via `VITE_DESKTOP_DOWNLOAD_URL*`.

## Stage installer (cross-platform)

From `catbuddy/` after `pnpm build:desktop`:

```bash
node scripts/stage-desktop-installer.mjs
```

Then build Web normally:

```bash
pnpm build:web
```

Manual source path:

```bash
node scripts/stage-desktop-installer.mjs --source apps/desktop/release-fresh/catbuddy\ Setup\ 0.1.0.exe
```

Supported overrides are `VITE_DESKTOP_DOWNLOAD_URL_WINDOWS`,
`VITE_DESKTOP_DOWNLOAD_URL_MAC_ARM64`, and `VITE_DESKTOP_DOWNLOAD_URL_MAC_X64`. The legacy
`VITE_DESKTOP_DOWNLOAD_URL` variable still overrides the Windows URL.
