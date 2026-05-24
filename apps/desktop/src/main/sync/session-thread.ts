/** Build Web UI thread replay payload from desktop session JSONL. */
import type { SessionDetail, WebuiThreadPersistedPayload } from "@catbuddy/shared";

export function buildWebuiThreadFromSession(
  session: SessionDetail | null,
): WebuiThreadPersistedPayload | null {
  if (!session) return null;

  const result: WebuiThreadPersistedPayload = {
    schemaVersion: 1,
    sessionKey: session.key,
    savedAt: session.updatedAt,
    messages: [],
  };

  for (const m of session.messages) {
    if (m.role === "tool") {
      result.messages.push({
        id: String(m.id),
        role: "assistant",
        kind: "trace",
        traces: [`${m.name}: ${m.content}`],
        createdAt: new Date(m.timestamp).getTime(),
        content: "",
      });
    } else {
      result.messages.push({
        id: String(m.id),
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
        createdAt: new Date(m.timestamp).getTime(),
      });
    }
  }

  return result;
}
