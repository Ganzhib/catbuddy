# Experimental MessageFrame push stack

Not used by production Gateway (`src/index.ts` + `ws-session.ts`).

- **Production**: Session WS (`register` / `ui_event` / `inbound_message`) — see `docs/CROSS_DEVICE_GATEWAY.md`.
- **This folder**: MessageFrame (`auth` / `push` / `ack`) prototype for future scale-out.

Excluded from `tsc` build (`tsconfig.json`). Unit tests may import `connection-manager.ts` only.
