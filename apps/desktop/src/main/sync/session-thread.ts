/** Build Web UI thread replay payload from desktop session JSONL. */
import { buildWebuiThreadPayload } from "@catbuddy/shared";
import type { SessionDetail, WebuiThreadPersistedPayload } from "@catbuddy/shared";

export function buildWebuiThreadFromSession(
  session: SessionDetail | null,
): WebuiThreadPersistedPayload | null {
  return buildWebuiThreadPayload(session);
}
