/** Desktop IPC helpers for cross-device relay. */

export interface RelayStatusPayload {
  enabled: boolean;
  connected: boolean;
  deviceId?: string;
  pairingCode?: string;
  lastError?: string;
}

export function isRelayIpcAvailable(): boolean {
  return typeof window !== "undefined" && !!window.learnbuddy?.getRelayStatus;
}

export async function getRelayStatus(): Promise<RelayStatusPayload | null> {
  if (!isRelayIpcAvailable()) return null;
  return window.learnbuddy!.getRelayStatus!();
}

/** Tell the executor to accept Web messages for this session (full key, e.g. desktop:1730_abc). */
export async function subscribeRelaySession(
  sessionKey: string,
): Promise<{ sessionKey: string } | null> {
  if (!sessionKey || !window.learnbuddy?.relaySubscribeSession) return null;
  return window.learnbuddy.relaySubscribeSession({ sessionKey });
}

/** Subscribe all persisted sessions on the desktop. */
export async function syncAllRelaySessions(): Promise<string[] | null> {
  if (!window.learnbuddy?.relaySyncAllSessions) return null;
  const res = await window.learnbuddy.relaySyncAllSessions();
  return res?.keys ?? null;
}
